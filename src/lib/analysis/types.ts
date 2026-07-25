export type AnalysisStatus = "pending" | "running" | "completed" | "partial" | "failed";

export type AnalysisCheckKey =
  | "openai_editorial"
  | "openai_verification"
  | "huggingface_fake_news"
  | "cardiff_sentiment"
  | "pg_trgm_originality"
  | "rule_credibility"
  | "flesch_kincaid"
  | "languagetool"
  | "tfidf_relevance";

export type AnalysisArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  plainText: string;
  contentHtml: string;
  authorId: string;
};

export type AnalysisUsage = {
  provider: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  status: "completed" | "failed";
};

export type AnalysisFlag = {
  text: string;
  reason: string;
  offset?: number;
  length?: number;
};

export type AnalysisProviderResult = {
  key: AnalysisCheckKey;
  provider: string;
  modelName: string;
  modelFamily: string;
  status: AnalysisStatus;
  verdict: string;
  confidence: number | null;
  score: number | null;
  flaggedSentences: AnalysisFlag[];
  rawOutput: Record<string, unknown>;
  errorMessage: string | null;
  usage?: AnalysisUsage;
  disclosure?: string;
};

export type AnalysisRunOptions = {
  requestedBy: string;
  breakModel?: AnalysisCheckKey;
};

export type AnalysisReport = {
  article: AnalysisArticle;
  status: AnalysisStatus;
  combinedVerdict: string;
  combinedConfidence: number | null;
  disagreement: {
    present: boolean;
    message: string;
    models: string[];
  };
  results: AnalysisProviderResult[];
};
