import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisArticle, AnalysisProviderResult } from "../types";

type CorpusArticle = {
  id: string;
  title: string;
  plain_text: string;
};

export async function runTfidfRelevance(
  supabase: SupabaseClient,
  article: AnalysisArticle,
): Promise<AnalysisProviderResult> {
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, plain_text")
    .eq("status", "published")
    .neq("id", article.id)
    .limit(40);

  if (error) {
    throw error;
  }

  const corpus = ((data ?? []) as CorpusArticle[]).filter((item) => item.plain_text.trim());
  if (corpus.length === 0) {
    return {
      key: "tfidf_relevance",
      provider: "local",
      modelName: "campuspress-tfidf-v1",
      modelFamily: "tf-idf",
      status: "completed",
      verdict: "No published corpus exists yet for TF-IDF comparison.",
      confidence: 0.5,
      score: 0,
      flaggedSentences: [],
      rawOutput: { matches: [] },
      errorMessage: null,
    };
  }

  const queryTerms = tokenize(article.plainText);
  const documents = corpus.map((item) => tokenize(item.plain_text));
  const scores = corpus
    .map((item, index) => ({
      articleId: item.id,
      title: item.title,
      score: cosineSimilarity(queryTerms, documents[index], documents),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const topScore = scores[0]?.score ?? 0;

  return {
    key: "tfidf_relevance",
    provider: "local",
    modelName: "campuspress-tfidf-v1",
    modelFamily: "tf-idf",
    status: "completed",
    verdict:
      topScore > 0.45
        ? "This story is strongly related to existing campus topics."
        : "This story appears distinct from the current published corpus.",
    confidence: 0.82,
    score: Number((topScore * 100).toFixed(2)),
    flaggedSentences: [],
    rawOutput: { matches: scores },
    errorMessage: null,
  };
}

function tokenize(text: string) {
  const stop = new Set(["the", "and", "for", "that", "with", "from", "this", "are", "was", "were", "into", "about", "have", "has", "had"]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stop.has(term));
}

function cosineSimilarity(queryTerms: string[], documentTerms: string[], corpus: string[][]) {
  const vocabulary = Array.from(new Set([...queryTerms, ...documentTerms]));
  const queryVector = vocabulary.map((term) => tfidf(term, queryTerms, corpus));
  const documentVector = vocabulary.map((term) => tfidf(term, documentTerms, corpus));
  const dot = queryVector.reduce((sum, value, index) => sum + value * documentVector[index], 0);
  const queryMagnitude = Math.sqrt(queryVector.reduce((sum, value) => sum + value * value, 0));
  const documentMagnitude = Math.sqrt(documentVector.reduce((sum, value) => sum + value * value, 0));
  return queryMagnitude && documentMagnitude ? dot / (queryMagnitude * documentMagnitude) : 0;
}

function tfidf(term: string, terms: string[], corpus: string[][]) {
  const termFrequency = terms.filter((item) => item === term).length / Math.max(terms.length, 1);
  const documentFrequency = corpus.filter((document) => document.includes(term)).length;
  const inverseDocumentFrequency = Math.log((corpus.length + 1) / (documentFrequency + 1)) + 1;
  return termFrequency * inverseDocumentFrequency;
}
