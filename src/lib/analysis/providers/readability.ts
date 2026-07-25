import { analyzeReadability } from "@/lib/writing-analysis";
import type { AnalysisArticle, AnalysisProviderResult } from "../types";

export function runFleschKincaid(article: AnalysisArticle): AnalysisProviderResult {
  const readability = analyzeReadability(article.plainText);
  const grade = Number(readability.grade.toFixed(2));

  return {
    key: "flesch_kincaid",
    provider: "local",
    modelName: "flesch-kincaid",
    modelFamily: "readability",
    status: "completed",
    verdict: readability.label,
    confidence: 1,
    score: grade,
    flaggedSentences: [],
    rawOutput: readability,
    errorMessage: null,
  };
}
