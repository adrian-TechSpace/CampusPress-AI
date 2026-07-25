import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { runCardiffSentiment, runHuggingFaceFakeNews } from "./providers/huggingface";
import { runLanguageTool } from "./providers/languagetool";
import { runOpenAiEditorial, runOpenAiVerification } from "./providers/openai";
import { runPgTrgmOriginality } from "./providers/originality";
import { runFleschKincaid } from "./providers/readability";
import { runRuleCredibility } from "./providers/rules";
import { runTfidfRelevance } from "./providers/tfidf";
import type {
  AnalysisArticle,
  AnalysisCheckKey,
  AnalysisProviderResult,
  AnalysisReport,
  AnalysisRunOptions,
  AnalysisStatus,
} from "./types";
import { failedResult, withTimeout } from "./utils";

const providerTimeoutMs = 45000;

export async function runArticleAnalysis(
  article: AnalysisArticle,
  options: AnalysisRunOptions,
): Promise<AnalysisReport> {
  const supabase = createServiceSupabaseClient();
  const job = await startJob(supabase, "article-analysis", {
    articleId: article.id,
    requestedBy: options.requestedBy,
  });

  const results: AnalysisProviderResult[] = [];

  const editorial = await runSafely(
    "openai_editorial",
    () => runOpenAiEditorial(article, options.breakModel),
    "openai",
    process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini",
    "llm-editorial",
  );
  results.push(editorial);

  const parallel = await Promise.all([
    runSafely(
      "openai_verification",
      () => runOpenAiVerification(article, editorial, options.breakModel),
      "openai",
      process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini",
      "llm-verification",
    ),
    runSafely(
      "huggingface_fake_news",
      () => runHuggingFaceFakeNews(article, options.breakModel),
      "huggingface",
      process.env.HF_FAKE_NEWS_MODEL || "mrm8488/bert-tiny-finetuned-fake-news-detection",
      "fake-news",
    ),
    runSafely(
      "cardiff_sentiment",
      () => runCardiffSentiment(article, options.breakModel),
      "huggingface",
      process.env.HF_SENTIMENT_MODEL || "cardiffnlp/twitter-roberta-base-sentiment-latest",
      "sentiment",
    ),
    runSafely("pg_trgm_originality", () => runPgTrgmOriginality(supabase, article), "supabase", "pg_trgm.similarity", "originality"),
    runSafely("rule_credibility", () => Promise.resolve(runRuleCredibility(article)), "local", "campuspress-9-point-credibility", "rule-based"),
    runSafely("flesch_kincaid", () => Promise.resolve(runFleschKincaid(article)), "local", "flesch-kincaid", "readability"),
    runSafely("languagetool", () => runLanguageTool(article), "languagetool", "languagetool-public-en-US", "grammar"),
    runSafely("tfidf_relevance", () => runTfidfRelevance(supabase, article), "local", "campuspress-tfidf-v1", "tf-idf"),
  ]);
  results.push(...parallel);

  await persistResults(supabase, article.id, options.requestedBy, results);
  const report = buildReport(article, results);

  await finishJob(supabase, job.id, report.status, {
    articleId: article.id,
    requestedBy: options.requestedBy,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    disagreement: report.disagreement,
  });

  return report;
}

export function buildReport(article: AnalysisArticle, results: AnalysisProviderResult[]): AnalysisReport {
  const completed = results.filter((result) => result.status === "completed");
  const failed = results.filter((result) => result.status === "failed");
  const status: AnalysisStatus = failed.length === 0 ? "completed" : completed.length > 0 ? "partial" : "failed";
  const scoreResults = completed.filter((result) => typeof result.score === "number");
  const combinedScore =
    scoreResults.length > 0
      ? Number((scoreResults.reduce((sum, result) => sum + (result.score ?? 0), 0) / scoreResults.length).toFixed(2))
      : null;
  const confidenceResults = completed.filter((result) => typeof result.confidence === "number");
  const combinedConfidence =
    confidenceResults.length > 0
      ? Number((confidenceResults.reduce((sum, result) => sum + (result.confidence ?? 0), 0) / confidenceResults.length).toFixed(2))
      : null;
  const disagreement = findDisagreement(results);

  return {
    article,
    status,
    combinedVerdict: combinedScore === null ? "Analysis did not complete." : combinedScore >= 75 ? "The ensemble mostly clears this story for editorial review." : "The ensemble recommends manual editorial review before approval.",
    combinedConfidence,
    disagreement,
    results,
  };
}

export async function loadAnalysisReport(articleId: string): Promise<AnalysisReport | null> {
  const supabase = createServiceSupabaseClient();
  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, title, excerpt, plain_text, content, author_id")
    .eq("id", articleId)
    .single();

  if (articleError || !article) {
    return null;
  }

  const { data, error } = await supabase
    .from("ai_analyses")
    .select("provider, model_name, model_family, status, verdict, confidence, score, flagged_sentences, raw_output, error_message, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  const latestByKey = new Map<string, AnalysisProviderResult>();
  for (const row of data ?? []) {
    const raw = (row.raw_output ?? {}) as Record<string, unknown>;
    const key = String(raw.key ?? `${row.provider}-${row.model_family}`) as AnalysisCheckKey;
    if (!latestByKey.has(key)) {
      latestByKey.set(key, {
        key,
        provider: row.provider,
        modelName: row.model_name,
        modelFamily: row.model_family,
        status: row.status as AnalysisStatus,
        verdict: row.verdict ?? "This check did not complete.",
        confidence: row.confidence === null ? null : Number(row.confidence),
        score: row.score === null ? null : Number(row.score),
        flaggedSentences: Array.isArray(row.flagged_sentences) ? row.flagged_sentences : [],
        rawOutput: raw,
        errorMessage: row.error_message,
        disclosure: typeof raw.disclosure === "string" ? raw.disclosure : undefined,
      });
    }
  }

  return buildReport(
    {
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      plainText: article.plain_text,
      contentHtml: typeof article.content?.html === "string" ? article.content.html : "",
      authorId: article.author_id,
    },
    Array.from(latestByKey.values()),
  );
}

async function runSafely(
  key: AnalysisCheckKey,
  run: () => Promise<AnalysisProviderResult>,
  provider: string,
  modelName: string,
  modelFamily: string,
) {
  try {
    return await withTimeout(run(), providerTimeoutMs, `${provider} ${modelFamily}`);
  } catch (error) {
    const isOpenAiCheck = key === "openai_editorial" || key === "openai_verification";
    return failedResult(
      key,
      provider,
      modelName,
      modelFamily,
      isOpenAiCheck
        ? "The AI editorial judgment and verification pass are temporarily unavailable."
        : error instanceof Error
          ? error.message
          : "This check failed for an unknown reason.",
      isOpenAiCheck
        ? "This OpenAI-dependent check is implemented, but it is unverified until OpenAI billing is active again."
        : undefined,
    );
  }
}

async function persistResults(
  supabase: SupabaseClient,
  articleId: string,
  requestedBy: string,
  results: AnalysisProviderResult[],
) {
  const analysisRows = results.map((result) => ({
    article_id: articleId,
    requested_by: requestedBy,
    provider: result.provider,
    model_name: result.modelName,
    model_family: result.modelFamily,
    status: result.status,
    verdict: result.verdict,
    confidence: result.confidence,
    score: result.score,
    flagged_sentences: result.flaggedSentences,
    raw_output: {
      key: result.key,
      disclosure: result.disclosure ?? null,
      output: result.rawOutput,
    },
    error_message: result.errorMessage,
    completed_at: new Date().toISOString(),
  }));

  const { error: analysisError } = await supabase.from("ai_analyses").insert(analysisRows);
  if (analysisError) {
    throw analysisError;
  }

  const usageRows = results
    .filter((result) => result.usage)
    .map((result) => ({
      user_id: requestedBy,
      article_id: articleId,
      provider: result.usage?.provider ?? result.provider,
      model_name: result.usage?.modelName ?? result.modelName,
      prompt_tokens: result.usage?.promptTokens ?? 0,
      completion_tokens: result.usage?.completionTokens ?? 0,
      cost_cents: result.usage?.costCents ?? 0,
      status: result.usage?.status ?? result.status,
    }));

  if (usageRows.length > 0) {
    const { error: usageError } = await supabase.from("ai_usage_log").insert(usageRows);
    if (usageError) {
      throw usageError;
    }
  }
}

async function startJob(supabase: SupabaseClient, jobName: string, metadata: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("job_run_log")
    .insert({
      job_name: jobName,
      status: "running",
      metadata,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

async function finishJob(
  supabase: SupabaseClient,
  jobId: string,
  status: AnalysisStatus,
  metadata: Record<string, unknown>,
) {
  await supabase
    .from("job_run_log")
    .update({
      status,
      ended_at: new Date().toISOString(),
      metadata,
    })
    .eq("id", jobId);
}

function findDisagreement(results: AnalysisProviderResult[]) {
  const relevant = results.filter((result) =>
    ["openai_editorial", "huggingface_fake_news", "rule_credibility"].includes(result.key),
  );
  const negative = relevant.filter((result) => /flagged|manual|serious|misleading|review/i.test(result.verdict));
  const positive = relevant.filter((result) => /clears|did not flag|mostly pass/i.test(result.verdict));
  const present = negative.length > 0 && positive.length > 0;

  return {
    present,
    message: present
      ? `${negative.map((result) => result.modelName).join(", ")} raised concerns while ${positive.map((result) => result.modelName).join(", ")} did not. Manual review recommended.`
      : "No direct disagreement found between the credibility, bias, and fake-news signals.",
    models: relevant.map((result) => result.modelName),
  };
}
