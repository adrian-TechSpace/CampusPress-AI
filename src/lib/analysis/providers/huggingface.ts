import type { AnalysisArticle, AnalysisCheckKey, AnalysisProviderResult } from "../types";
import { clipText, estimateTokens, failedResult } from "../utils";

type HfClassification = {
  label: string;
  score: number;
};

const fakeNewsModel = process.env.HF_FAKE_NEWS_MODEL || "mrm8488/bert-tiny-finetuned-fake-news-detection";
const sentimentModel = process.env.HF_SENTIMENT_MODEL || "cardiffnlp/twitter-roberta-base-sentiment-latest";

const fakeNewsDisclosure =
  "This tiny BERT fake-news classifier is trained for broad English fake-news detection. It is a lightweight signal and may be less reliable for Nigerian campus context, Nigerian English, local names, satire, and institution-specific reporting. Treat it as an editorial signal, not a final verdict.";

const sentimentDisclosure =
  "Cardiff RoBERTa sentiment is trained on English social-media style text, so it may misread formal reporting tone, Nigerian English, and campus-specific context.";

export async function runHuggingFaceFakeNews(
  article: AnalysisArticle,
  breakModel?: AnalysisCheckKey,
): Promise<AnalysisProviderResult> {
  if (!process.env.HF_TOKEN) {
    return failedResult(
      "huggingface_fake_news",
      "huggingface",
      fakeNewsModel,
      "fake-news",
      "HF_TOKEN is not configured.",
      fakeNewsDisclosure,
    );
  }

  const output = await classify(fakeNewsModel, article.plainText, breakModel === "huggingface_fake_news");
  const top = output[0];
  const label = top?.label ?? "unknown";
  const score = Number(((top?.score ?? 0) * 100).toFixed(2));
  const misleading = /fake|false|label_1/i.test(label);

  return {
    key: "huggingface_fake_news",
    provider: "huggingface",
    modelName: fakeNewsModel,
    modelFamily: "fake-news",
    status: "completed",
    verdict: misleading ? "The HuggingFace fake-news model flagged possible misleading content." : "The HuggingFace fake-news model did not flag the story as likely fake.",
    confidence: Number((top?.score ?? 0).toFixed(2)),
    score,
    flaggedSentences: misleading ? [{ text: article.title, reason: `Top label: ${label}` }] : [],
    rawOutput: { labels: output },
    errorMessage: null,
    usage: {
      provider: "huggingface",
      modelName: fakeNewsModel,
      promptTokens: estimateTokens(article.plainText),
      completionTokens: 0,
      costCents: 0,
      status: "completed",
    },
    disclosure: fakeNewsDisclosure,
  };
}

export async function runCardiffSentiment(
  article: AnalysisArticle,
  breakModel?: AnalysisCheckKey,
): Promise<AnalysisProviderResult> {
  if (!process.env.HF_TOKEN) {
    return failedResult(
      "cardiff_sentiment",
      "huggingface",
      sentimentModel,
      "sentiment",
      "HF_TOKEN is not configured.",
      sentimentDisclosure,
    );
  }

  const output = await classify(sentimentModel, article.plainText, breakModel === "cardiff_sentiment");
  const top = output[0];
  const label = normalizeSentiment(top?.label ?? "unknown");

  return {
    key: "cardiff_sentiment",
    provider: "huggingface",
    modelName: sentimentModel,
    modelFamily: "sentiment",
    status: "completed",
    verdict: `The article tone is classified as ${label}.`,
    confidence: Number((top?.score ?? 0).toFixed(2)),
    score: Number(((top?.score ?? 0) * 100).toFixed(2)),
    flaggedSentences: label === "negative" ? [{ text: article.title, reason: "Negative sentiment can indicate loaded or adversarial framing." }] : [],
    rawOutput: { labels: output },
    errorMessage: null,
    usage: {
      provider: "huggingface",
      modelName: sentimentModel,
      promptTokens: estimateTokens(article.plainText),
      completionTokens: 0,
      costCents: 0,
      status: "completed",
    },
    disclosure: sentimentDisclosure,
  };
}

export async function warmHuggingFaceModels() {
  const sample = "CampusPress AI is warming the text classification model for an editorial analysis check.";
  const results = await Promise.allSettled([
    classify(fakeNewsModel, sample, false),
    classify(sentimentModel, sample, false),
  ]);

  return {
    fakeNewsModel,
    sentimentModel,
    results: results.map((result) =>
      result.status === "fulfilled"
        ? { status: "completed", labels: result.value.slice(0, 2) }
        : { status: "failed", error: result.reason instanceof Error ? result.reason.message : "Unknown error" },
    ),
  };
}

async function classify(model: string, text: string, useInvalidModel: boolean) {
  const token = process.env.HF_TOKEN;
  const modelName = useInvalidModel ? "campuspress/invalid-phase5-failure-check" : model;
  const encodedModelName = modelName.split("/").map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${encodedModelName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: clipText(text, 5000),
      parameters: {
        top_k: 3,
        function_to_apply: "softmax",
      },
      options: {
        wait_for_model: true,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HuggingFace ${modelName} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as HfClassification[] | HfClassification[][];
  const labels = Array.isArray(json[0]) ? (json[0] as HfClassification[]) : (json as HfClassification[]);
  return labels.sort((a, b) => b.score - a.score);
}

function normalizeSentiment(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("negative") || lower === "label_0") {
    return "negative";
  }
  if (lower.includes("neutral") || lower === "label_1") {
    return "neutral";
  }
  if (lower.includes("positive") || lower === "label_2") {
    return "positive";
  }
  return lower;
}
