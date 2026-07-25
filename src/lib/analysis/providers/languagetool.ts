import type { AnalysisArticle, AnalysisProviderResult } from "../types";
import { clipText, estimateTokens } from "../utils";

type LanguageToolMatch = {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: { value: string }[];
  rule?: { id?: string };
};

const disclosure =
  "LanguageTool is useful for grammar and spelling support, but the public checker can miss names, Nigerian English usage, campus-specific terms, and context-sensitive editorial issues.";

export async function runLanguageTool(article: AnalysisArticle): Promise<AnalysisProviderResult> {
  const text = clipText(article.plainText, 12000);
  const form = new URLSearchParams({
    text,
    language: "en-US",
  });

  const response = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`LanguageTool returned ${response.status}`);
  }

  const result = (await response.json()) as { matches?: LanguageToolMatch[] };
  const matches = (result.matches ?? []).slice(0, 30);

  return {
    key: "languagetool",
    provider: "languagetool",
    modelName: "languagetool-public-en-US",
    modelFamily: "grammar",
    status: "completed",
    verdict: matches.length === 0 ? "No LanguageTool grammar issues found." : "LanguageTool found grammar or spelling issues to review.",
    confidence: 0.78,
    score: Math.max(0, 100 - matches.length * 4),
    flaggedSentences: matches.map((match) => ({
      text: text.slice(match.offset, match.offset + match.length),
      reason: match.message,
      offset: match.offset,
      length: match.length,
    })),
    rawOutput: { matches },
    errorMessage: null,
    usage: {
      provider: "languagetool",
      modelName: "languagetool-public-en-US",
      promptTokens: estimateTokens(text),
      completionTokens: 0,
      costCents: 0,
      status: "completed",
    },
    disclosure,
  };
}
