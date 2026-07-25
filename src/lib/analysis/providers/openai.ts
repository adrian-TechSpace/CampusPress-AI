import type { AnalysisArticle, AnalysisCheckKey, AnalysisProviderResult } from "../types";
import { clipText, estimateTokens, failedResult, splitSentences } from "../utils";

const openAiModel = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini";
const openAiUnavailableMessage =
  "The AI editorial judgment and verification pass are temporarily unavailable.";
const openAiUnavailableDisclosure =
  "This OpenAI-dependent check is implemented, but it is unverified until OpenAI billing is active again.";

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type EditorialPayload = {
  verdict: string;
  confidence: number;
  score: number;
  bias: string;
  credibility: string;
  grammar: string;
  flagged_sentences: Array<{
    text: string;
    reason: string;
  }>;
};

export async function runOpenAiEditorial(
  article: AnalysisArticle,
  breakModel?: AnalysisCheckKey,
): Promise<AnalysisProviderResult> {
  if (!process.env.OPENAI_API_KEY) {
    return failedResult(
      "openai_editorial",
      "openai",
      openAiModel,
      "llm-editorial",
      openAiUnavailableMessage,
      openAiUnavailableDisclosure,
    );
  }

  const prompt = [
    "You are an editorial analysis assistant for a Nigerian university journalism platform.",
    "Analyze the article for grammar quality, bias, credibility, and editorial risk.",
    "Return JSON only. Quote exact sentences from the article when flagging issues.",
    `Title: ${article.title}`,
    `Excerpt: ${article.excerpt ?? ""}`,
    `Article: ${clipText(article.plainText, 12000)}`,
  ].join("\n\n");

  const response = await callResponsesApi(prompt, breakModel === "openai_editorial");
  const parsed = parseJsonPayload<EditorialPayload>(response);

  return {
    key: "openai_editorial",
    provider: "openai",
    modelName: openAiModel,
    modelFamily: "llm-editorial",
    status: "completed",
    verdict: parsed.verdict,
    confidence: clampConfidence(parsed.confidence),
    score: clampScore(parsed.score),
    flaggedSentences: (parsed.flagged_sentences ?? []).slice(0, 10).map((item) => ({
      text: item.text,
      reason: item.reason,
    })),
    rawOutput: { ...parsed, usage: response.usage ?? null },
    errorMessage: null,
    usage: {
      provider: "openai",
      modelName: openAiModel,
      promptTokens: response.usage?.input_tokens ?? estimateTokens(prompt),
      completionTokens: response.usage?.output_tokens ?? estimateTokens(JSON.stringify(parsed)),
      costCents: estimateOpenAiCostCents(response.usage?.input_tokens ?? estimateTokens(prompt), response.usage?.output_tokens ?? estimateTokens(JSON.stringify(parsed))),
      status: "completed",
    },
  };
}

export async function runOpenAiVerification(
  article: AnalysisArticle,
  editorial: AnalysisProviderResult,
  breakModel?: AnalysisCheckKey,
): Promise<AnalysisProviderResult> {
  if (!process.env.OPENAI_API_KEY) {
    return failedResult(
      "openai_verification",
      "openai",
      openAiModel,
      "llm-verification",
      openAiUnavailableMessage,
      openAiUnavailableDisclosure,
    );
  }

  const prompt = [
    "Verify a prior editorial AI analysis against the actual article text.",
    "Return JSON only. Mark unsupported claims and say whether the prior analysis is safe to show to editors.",
    `Article: ${clipText(article.plainText, 12000)}`,
    `Prior analysis: ${JSON.stringify(editorial.rawOutput)}`,
  ].join("\n\n");

  const response = await callResponsesApi(prompt, breakModel === "openai_verification");
  const parsed = parseJsonPayload<EditorialPayload>(response);

  return {
    key: "openai_verification",
    provider: "openai",
    modelName: openAiModel,
    modelFamily: "llm-verification",
    status: "completed",
    verdict: parsed.verdict,
    confidence: clampConfidence(parsed.confidence),
    score: clampScore(parsed.score),
    flaggedSentences: (parsed.flagged_sentences ?? []).slice(0, 10).map((item) => ({
      text: item.text,
      reason: item.reason,
    })),
    rawOutput: { ...parsed, usage: response.usage ?? null },
    errorMessage: null,
    usage: {
      provider: "openai",
      modelName: openAiModel,
      promptTokens: response.usage?.input_tokens ?? estimateTokens(prompt),
      completionTokens: response.usage?.output_tokens ?? estimateTokens(JSON.stringify(parsed)),
      costCents: estimateOpenAiCostCents(response.usage?.input_tokens ?? estimateTokens(prompt), response.usage?.output_tokens ?? estimateTokens(JSON.stringify(parsed))),
      status: "completed",
    },
  };
}

async function callResponsesApi(input: string, useInvalidKey: boolean): Promise<OpenAiResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${useInvalidKey ? "invalid-phase5-test-key" : process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "campuspress_editorial_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              verdict: { type: "string" },
              confidence: { type: "number" },
              score: { type: "number" },
              bias: { type: "string" },
              credibility: { type: "string" },
              grammar: { type: "string" },
              flagged_sentences: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    text: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["text", "reason"],
                },
              },
            },
            required: ["verdict", "confidence", "score", "bias", "credibility", "grammar", "flagged_sentences"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI returned ${response.status}: ${body.slice(0, 200)}`);
  }

  return (await response.json()) as OpenAiResponse;
}

function parseJsonPayload<T>(response: OpenAiResponse): T {
  const outputText =
    response.output_text ??
    response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text" || item.text)?.text;

  if (!outputText) {
    throw new Error("OpenAI response did not include structured output text.");
  }

  return JSON.parse(outputText) as T;
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function estimateOpenAiCostCents(inputTokens: number, outputTokens: number) {
  const inputDollars = (inputTokens / 1_000_000) * 0.4;
  const outputDollars = (outputTokens / 1_000_000) * 1.6;
  return Number(((inputDollars + outputDollars) * 100).toFixed(4));
}

export function fallbackOpenAiFinding(article: AnalysisArticle): EditorialPayload {
  const firstSentence = splitSentences(article.plainText)[0] ?? article.title;
  return {
    verdict: "The LLM analysis did not complete.",
    confidence: 0,
    score: 0,
    bias: "Unavailable",
    credibility: "Unavailable",
    grammar: "Unavailable",
    flagged_sentences: [{ text: firstSentence, reason: "OpenAI analysis unavailable." }],
  };
}
