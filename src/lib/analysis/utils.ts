import type { AnalysisCheckKey, AnalysisProviderResult } from "./types";

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function clipText(text: string, maxCharacters: number) {
  return text.length > maxCharacters ? `${text.slice(0, maxCharacters)}...` : text;
}

export function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function failedResult(
  key: AnalysisCheckKey,
  provider: string,
  modelName: string,
  modelFamily: string,
  message: string,
  disclosure?: string,
): AnalysisProviderResult {
  return {
    key,
    provider,
    modelName,
    modelFamily,
    status: "failed",
    verdict: "This check did not complete.",
    confidence: null,
    score: null,
    flaggedSentences: [],
    rawOutput: {},
    errorMessage: message,
    usage: {
      provider,
      modelName,
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
      status: "failed",
    },
    disclosure,
  };
}

export async function withTimeout<T>(promise: Promise<T>, milliseconds: number, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
