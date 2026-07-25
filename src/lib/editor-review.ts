import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewStatus = "submitted" | "in_review" | "revision_requested";
export type ReviewDecision = "approve" | "reject" | "request_revision";

export type ReviewQueueItem = {
  id: string;
  title: string;
  excerpt: string | null;
  plainText: string;
  contentHtml: string;
  status: ReviewStatus;
  submittedAt: string | null;
  updatedAt: string;
  author: {
    id: string;
    fullName: string;
    departmentCode: string;
    verified: boolean;
  };
  analysis: {
    completedSignals: number;
    failedOpenAiSignals: number;
    averageScore: number | null;
    riskScore: number | null;
    commonFlags: string[];
  };
};

export type ReviewAnalytics = {
  activeSubmissions: number;
  averageReviewHours: number | null;
  commonFlags: Array<{
    label: string;
    count: number;
  }>;
};

export type ReviewQueuePayload = {
  items: ReviewQueueItem[];
  analytics: ReviewAnalytics;
};

type ArticleRow = {
  id: string;
  title: string;
  excerpt: string | null;
  plain_text: string;
  content: { html?: string } | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  author_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  department_code: string;
  verified: boolean;
};

type AnalysisRow = {
  article_id: string;
  status: string;
  score: number | null;
  confidence: number | null;
  verdict: string | null;
  flagged_sentences: Array<{ reason?: string }> | null;
  raw_output: { key?: string } | null;
  created_at: string;
};

const reviewStatuses: ReviewStatus[] = ["submitted", "in_review", "revision_requested"];

export async function loadEditorReviewQueue(supabase: SupabaseClient): Promise<ReviewQueuePayload> {
  const { data: articles, error: articleError } = await supabase
    .from("articles")
    .select("id, title, excerpt, plain_text, content, status, submitted_at, updated_at, author_id")
    .in("status", reviewStatuses)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(50);

  if (articleError) {
    throw articleError;
  }

  const articleRows = ((articles ?? []) as ArticleRow[]).filter((article): article is ArticleRow & { status: ReviewStatus } =>
    reviewStatuses.includes(article.status as ReviewStatus),
  );
  const authorIds = [...new Set(articleRows.map((article) => article.author_id))];
  const articleIds = articleRows.map((article) => article.id);

  const [profilesResult, analysesResult, reviewedResult] = await Promise.all([
    authorIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name, department_code, verified")
          .in("id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    articleIds.length
      ? supabase
          .from("ai_analyses")
          .select("article_id, status, score, confidence, verdict, flagged_sentences, raw_output, created_at")
          .in("article_id", articleIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("articles")
      .select("submitted_at, reviewed_at")
      .not("submitted_at", "is", null)
      .not("reviewed_at", "is", null)
      .in("status", ["approved", "rejected", "revision_requested"])
      .limit(100),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }
  if (analysesResult.error) {
    throw analysesResult.error;
  }
  if (reviewedResult.error) {
    throw reviewedResult.error;
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const analysesByArticle = latestAnalysesByArticle((analysesResult.data ?? []) as AnalysisRow[]);
  const allFlagCounts = new Map<string, number>();

  const items = articleRows.map((article) => {
    const analyses = analysesByArticle.get(article.id) ?? [];
    const summary = summarizeAnalyses(analyses);
    for (const flag of summary.commonFlags) {
      allFlagCounts.set(flag, (allFlagCounts.get(flag) ?? 0) + 1);
    }

    const author = profiles.get(article.author_id);
    return {
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      plainText: article.plain_text,
      contentHtml: typeof article.content?.html === "string" ? article.content.html : "",
      status: article.status,
      submittedAt: article.submitted_at,
      updatedAt: article.updated_at,
      author: {
        id: article.author_id,
        fullName: author?.full_name ?? "Unknown journalist",
        departmentCode: author?.department_code ?? "N/A",
        verified: Boolean(author?.verified),
      },
      analysis: summary,
    } satisfies ReviewQueueItem;
  });

  return {
    items,
    analytics: {
      activeSubmissions: items.length,
      averageReviewHours: averageReviewHours(
        (reviewedResult.data ?? []) as Array<{ submitted_at: string | null; reviewed_at: string | null }>,
      ),
      commonFlags: [...allFlagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count })),
    },
  };
}

export async function applyEditorReviewAction(
  supabase: SupabaseClient,
  editorId: string,
  articleId: string,
  action: ReviewDecision,
  note: string,
) {
  const cleanNote = note.trim();
  if ((action === "request_revision" || action === "reject") && cleanNote.length < 12) {
    throw new Error("Add a clear decision note before sending this update.");
  }

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, title, author_id, status")
    .eq("id", articleId)
    .single();

  if (articleError || !article) {
    throw new Error("CampusPress could not find that submission.");
  }

  const decision = decisionCopy(action, cleanNote, article.title);
  const { data: updated, error: updateError } = await supabase
    .from("articles")
    .update({
      status: decision.status,
      editor_id: editorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .select("id, status")
    .single();

  if (updateError) {
    throw updateError;
  }

  const [messageResult, notificationResult] = await Promise.all([
    supabase.from("messages").insert({
      sender_id: editorId,
      recipient_id: article.author_id,
      article_id: articleId,
      body: decision.messageBody,
    }),
    supabase.from("notifications").insert({
      user_id: article.author_id,
      actor_id: editorId,
      article_id: articleId,
      type: decision.notificationType,
      title: decision.notificationTitle,
      body: decision.notificationBody,
    }),
  ]);

  if (messageResult.error) {
    throw messageResult.error;
  }
  if (notificationResult.error) {
    throw notificationResult.error;
  }

  return {
    articleId: updated.id,
    status: updated.status,
    message: decision.responseMessage,
  };
}

function latestAnalysesByArticle(rows: AnalysisRow[]) {
  const latestByArticleAndKey = new Map<string, AnalysisRow>();

  for (const row of rows) {
    const key = row.raw_output?.key;
    if (!key) {
      continue;
    }

    const mapKey = `${row.article_id}:${key}`;
    if (!latestByArticleAndKey.has(mapKey)) {
      latestByArticleAndKey.set(mapKey, row);
    }
  }

  const grouped = new Map<string, AnalysisRow[]>();
  for (const row of latestByArticleAndKey.values()) {
    const current = grouped.get(row.article_id) ?? [];
    current.push(row);
    grouped.set(row.article_id, current);
  }

  return grouped;
}

function summarizeAnalyses(rows: AnalysisRow[]) {
  const completed = rows.filter((row) => row.status === "completed");
  const scored = completed.filter((row) => typeof row.score === "number");
  const averageScore =
    scored.length > 0
      ? Number((scored.reduce((sum, row) => sum + Number(row.score), 0) / scored.length).toFixed(1))
      : null;
  const commonFlags = rows
    .flatMap((row) => row.flagged_sentences ?? [])
    .map((flag) => flag.reason?.trim())
    .filter((reason): reason is string => Boolean(reason))
    .slice(0, 5);

  return {
    completedSignals: completed.length,
    failedOpenAiSignals: rows.filter((row) => {
      const key = row.raw_output?.key;
      return row.status === "failed" && (key === "openai_editorial" || key === "openai_verification");
    }).length,
    averageScore,
    riskScore: averageScore === null ? null : Number((100 - averageScore).toFixed(1)),
    commonFlags: commonFlags.length > 0 ? commonFlags : ["No major AI flags"],
  };
}

function averageReviewHours(rows: Array<{ submitted_at: string | null; reviewed_at: string | null }>) {
  const durations: number[] = [];

  for (const row of rows) {
    if (!row.submitted_at || !row.reviewed_at) {
      continue;
    }

    const duration = (new Date(row.reviewed_at).getTime() - new Date(row.submitted_at).getTime()) / 36e5;
    if (Number.isFinite(duration) && duration >= 0) {
      durations.push(duration);
    }
  }

  if (durations.length === 0) {
    return null;
  }

  return Number((durations.reduce((sum, duration) => sum + duration, 0) / durations.length).toFixed(1));
}

function decisionCopy(action: ReviewDecision, note: string, title: string) {
  if (action === "approve") {
    return {
      status: "approved",
      notificationType: "article_approved",
      notificationTitle: "Your article was approved",
      notificationBody: `"${title}" was approved by the editorial desk. It is ready for the next publishing step.`,
      messageBody: note || `"${title}" was approved by the editorial desk.`,
      responseMessage: "Article approved.",
    };
  }

  if (action === "reject") {
    return {
      status: "rejected",
      notificationType: "article_rejected",
      notificationTitle: "Your article was not approved",
      notificationBody: `"${title}" was not approved. Read the editor note and use it to improve the next draft.`,
      messageBody: `Editor decision for "${title}": ${note}`,
      responseMessage: "Rejection sent to the journalist.",
    };
  }

  return {
    status: "revision_requested",
    notificationType: "revision_requested",
    notificationTitle: "Revision requested",
    notificationBody: `An editor requested clear, specific next steps for "${title}". Open your messages, revise the article, and submit it again.`,
    messageBody: `Revision request for "${title}": ${note}`,
    responseMessage: "Revision request sent to the journalist.",
  };
}
