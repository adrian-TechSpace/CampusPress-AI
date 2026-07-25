import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisArticle, AnalysisProviderResult } from "../types";

type SimilarityMatch = {
  article_id: string;
  title: string;
  similarity_score: number;
};

export async function runPgTrgmOriginality(
  supabase: SupabaseClient,
  article: AnalysisArticle,
): Promise<AnalysisProviderResult> {
  const { data, error } = await supabase.rpc("article_similarity_matches", {
    input_article_id: article.id,
    input_text: article.plainText,
    match_limit: 5,
  });

  if (error) {
    throw error;
  }

  const matches = ((data ?? []) as SimilarityMatch[]).map((match) => ({
    ...match,
    similarity_score: Number(match.similarity_score),
  }));
  const top = matches[0]?.similarity_score ?? 0;

  return {
    key: "pg_trgm_originality",
    provider: "supabase",
    modelName: "pg_trgm.similarity",
    modelFamily: "originality",
    status: "completed",
    verdict:
      top >= 0.65
        ? "High similarity to an existing article. Manual originality review required."
        : top >= 0.35
          ? "Some similarity to existing articles. Review the closest matches."
          : "No high-similarity article found.",
    confidence: 0.9,
    score: Number(((1 - Math.min(top, 1)) * 100).toFixed(2)),
    flaggedSentences: top >= 0.35 ? [{ text: article.title, reason: "Similarity found against existing article corpus." }] : [],
    rawOutput: { matches },
    errorMessage: null,
  };
}
