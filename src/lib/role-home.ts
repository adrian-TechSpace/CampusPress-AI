import { loadEditorReviewQueue } from "@/lib/editor-review";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

type RoleHomeProfile = {
  id: string;
  role: string;
  full_name: string;
};

export type RoleHomePayload = JournalistHomePayload | EditorHomePayload | AdminHomePayload;

export type JournalistHomePayload = {
  kind: "journalist";
  profile: {
    fullName: string;
  };
  metrics: {
    drafts: number;
    submitted: number;
    revisionRequested: number;
    published: number;
    totalLikes: number;
    totalComments: number;
  };
  recentArticles: JournalistArticleSummary[];
  aiStatuses: JournalistAiStatus[];
  engagement: JournalistEngagementSummary[];
};

export type JournalistArticleSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
};

export type JournalistAiStatus = {
  articleId: string;
  title: string;
  status: string;
  completedSignals: number;
  pendingSignals: number;
  failedSignals: number;
  latestAt: string | null;
};

export type JournalistEngagementSummary = {
  articleId: string;
  title: string;
  slug: string;
  likes: number;
  comments: number;
  publishedAt: string | null;
};

export type EditorHomePayload = {
  kind: "editor";
  profile: {
    fullName: string;
  };
  metrics: {
    pendingReview: number;
    submitted: number;
    inReview: number;
    revisionRequested: number;
    completedByYou: number;
    averageReviewHours: number | null;
  };
  timeSensitive: EditorArticleSummary[];
  recentDecisions: EditorDecisionSummary[];
  commonFlags: Array<{
    label: string;
    count: number;
  }>;
};

export type EditorArticleSummary = {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  authorName: string;
};

export type EditorDecisionSummary = {
  id: string;
  title: string;
  status: string;
  reviewedAt: string | null;
};

export type AdminHomePayload = {
  kind: "admin";
  profile: {
    fullName: string;
    role: "admin" | "subadmin";
  };
  metrics: {
    pendingAppeals: number;
    recentModerationActions: number;
    rosterRows: number;
    matchedRosterRows: number;
    pendingInvites: number;
  };
  recentModeration: AdminModerationSummary[];
  roster: {
    latestUploadAt: string | null;
    latestJobStatus: string;
    latestJobEndedAt: string | null;
    latestJobError: string | null;
  };
  appeals: {
    pending: number;
    latestSubmittedAt: string | null;
  };
};

export type AdminModerationSummary = {
  id: string;
  action: string;
  targetName: string;
  createdAt: string;
};

type ArticleRow = {
  id: string;
  title: string;
  slug?: string | null;
  status: string;
  updated_at: string;
  submitted_at?: string | null;
  published_at?: string | null;
  reviewed_at?: string | null;
  author_id?: string | null;
};

type AnalysisRow = {
  article_id: string;
  status: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
};

type ModerationRow = {
  id: string;
  action: string;
  target_user_id: string;
  created_at: string;
};

export async function loadRoleHome(profile: RoleHomeProfile): Promise<RoleHomePayload> {
  if (profile.role === "journalist") {
    return loadJournalistHome(profile);
  }

  if (profile.role === "editor") {
    return loadEditorHome(profile);
  }

  if (profile.role === "admin" || profile.role === "subadmin") {
    return loadAdminHome(profile as RoleHomeProfile & { role: "admin" | "subadmin" });
  }

  throw new Error("This role does not have a Track 3 home workspace.");
}

async function loadJournalistHome(profile: RoleHomeProfile): Promise<JournalistHomePayload> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, status, updated_at, submitted_at, published_at")
    .eq("author_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  const articles = ((data ?? []) as ArticleRow[]).map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug ?? "",
    status: article.status,
    updatedAt: article.updated_at,
    submittedAt: article.submitted_at ?? null,
    publishedAt: article.published_at ?? null,
  }));
  const articleIds = articles.map((article) => article.id);
  const publishedArticles = articles.filter((article) => article.status === "published");

  const [analyses, likes, comments] = await Promise.all([
    articleIds.length
      ? supabase
          .from("ai_analyses")
          .select("article_id, status, created_at")
          .in("article_id", articleIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    publishedArticles.length
      ? supabase
          .from("article_likes")
          .select("article_id")
          .in("article_id", publishedArticles.map((article) => article.id))
      : Promise.resolve({ data: [], error: null }),
    publishedArticles.length
      ? supabase
          .from("comments")
          .select("article_id")
          .eq("is_hidden", false)
          .in("article_id", publishedArticles.map((article) => article.id))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (analyses.error) {
    throw analyses.error;
  }
  if (likes.error) {
    throw likes.error;
  }
  if (comments.error) {
    throw comments.error;
  }

  const analysisRows = (analyses.data ?? []) as AnalysisRow[];
  const likesByArticle = countByArticle((likes.data ?? []) as Array<{ article_id: string }>);
  const commentsByArticle = countByArticle((comments.data ?? []) as Array<{ article_id: string }>);
  const aiStatuses = buildJournalistAiStatuses(articles, analysisRows);
  const engagement = publishedArticles
    .map((article) => ({
      articleId: article.id,
      title: article.title,
      slug: article.slug,
      likes: likesByArticle.get(article.id) ?? 0,
      comments: commentsByArticle.get(article.id) ?? 0,
      publishedAt: article.publishedAt,
    }))
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
    .slice(0, 4);

  return {
    kind: "journalist",
    profile: { fullName: profile.full_name },
    metrics: {
      drafts: articles.filter((article) => article.status === "draft").length,
      submitted: articles.filter((article) => article.status === "submitted" || article.status === "in_review").length,
      revisionRequested: articles.filter((article) => article.status === "revision_requested").length,
      published: publishedArticles.length,
      totalLikes: [...likesByArticle.values()].reduce((sum, count) => sum + count, 0),
      totalComments: [...commentsByArticle.values()].reduce((sum, count) => sum + count, 0),
    },
    recentArticles: articles.slice(0, 5),
    aiStatuses,
    engagement,
  };
}

async function loadEditorHome(profile: RoleHomeProfile): Promise<EditorHomePayload> {
  const supabase = createServiceSupabaseClient();
  const [queue, decisions] = await Promise.all([
    loadEditorReviewQueue(supabase),
    supabase
      .from("articles")
      .select("id, title, status, reviewed_at")
      .eq("editor_id", profile.id)
      .not("reviewed_at", "is", null)
      .in("status", ["approved", "rejected", "revision_requested"])
      .order("reviewed_at", { ascending: false })
      .limit(5),
  ]);

  if (decisions.error) {
    throw decisions.error;
  }

  return {
    kind: "editor",
    profile: { fullName: profile.full_name },
    metrics: {
      pendingReview: queue.items.length,
      submitted: queue.items.filter((item) => item.status === "submitted").length,
      inReview: queue.items.filter((item) => item.status === "in_review").length,
      revisionRequested: queue.items.filter((item) => item.status === "revision_requested").length,
      completedByYou: (decisions.data ?? []).length,
      averageReviewHours: queue.analytics.averageReviewHours,
    },
    timeSensitive: queue.items.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      submittedAt: item.submittedAt,
      updatedAt: item.updatedAt,
      authorName: item.author.fullName,
    })),
    recentDecisions: ((decisions.data ?? []) as ArticleRow[]).map((article) => ({
      id: article.id,
      title: article.title,
      status: article.status,
      reviewedAt: article.reviewed_at ?? null,
    })),
    commonFlags: queue.analytics.commonFlags,
  };
}

async function loadAdminHome(profile: RoleHomeProfile & { role: "admin" | "subadmin" }): Promise<AdminHomePayload> {
  const supabase = createServiceSupabaseClient();
  const [actions, appeals, roster, jobs, invites] = await Promise.all([
    supabase
      .from("moderation_actions")
      .select("id, action, target_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("suspension_appeals")
      .select("id, status, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(25),
    supabase
      .from("institution_roster")
      .select("id, matched_profile_id, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(50),
    supabase
      .from("job_run_log")
      .select("status, ended_at, error_message")
      .eq("job_name", "roster-cross-check")
      .order("started_at", { ascending: false })
      .limit(1),
    supabase
      .from("account_invitations")
      .select("id, status")
      .eq("status", "pending")
      .limit(100),
  ]);

  for (const result of [actions, appeals, roster, jobs, invites]) {
    if (result.error) {
      throw result.error;
    }
  }

  const moderationRows = (actions.data ?? []) as ModerationRow[];
  const targetIds = [...new Set(moderationRows.map((row) => row.target_user_id).filter(Boolean))];
  const targetNames = await loadProfileNames(targetIds);
  const appealRows = (appeals.data ?? []) as Array<{ status: string; submitted_at: string | null }>;
  const rosterRows = (roster.data ?? []) as Array<{ matched_profile_id: string | null; uploaded_at: string | null }>;
  const latestJob = ((jobs.data ?? []) as Array<{ status: string; ended_at: string | null; error_message: string | null }>)[0] ?? null;

  return {
    kind: "admin",
    profile: { fullName: profile.full_name, role: profile.role },
    metrics: {
      pendingAppeals: appealRows.filter((row) => row.status === "submitted").length,
      recentModerationActions: moderationRows.length,
      rosterRows: rosterRows.length,
      matchedRosterRows: rosterRows.filter((row) => row.matched_profile_id).length,
      pendingInvites: (invites.data ?? []).length,
    },
    recentModeration: moderationRows.map((row) => ({
      id: row.id,
      action: row.action,
      targetName: targetNames.get(row.target_user_id) ?? "CampusPress user",
      createdAt: row.created_at,
    })),
    roster: {
      latestUploadAt: rosterRows[0]?.uploaded_at ?? null,
      latestJobStatus: latestJob?.status ?? "Not run yet",
      latestJobEndedAt: latestJob?.ended_at ?? null,
      latestJobError: latestJob?.error_message ?? null,
    },
    appeals: {
      pending: appealRows.filter((row) => row.status === "submitted").length,
      latestSubmittedAt: appealRows[0]?.submitted_at ?? null,
    },
  };
}

async function loadProfileNames(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await createServiceSupabaseClient()
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.full_name]));
}

function buildJournalistAiStatuses(articles: JournalistArticleSummary[], rows: AnalysisRow[]) {
  const byArticle = new Map<string, AnalysisRow[]>();
  for (const row of rows) {
    const current = byArticle.get(row.article_id) ?? [];
    current.push(row);
    byArticle.set(row.article_id, current);
  }

  return articles
    .filter((article) => article.status !== "draft")
    .slice(0, 5)
    .map((article) => {
      const articleRows = byArticle.get(article.id) ?? [];
      return {
        articleId: article.id,
        title: article.title,
        status: article.status,
        completedSignals: articleRows.filter((row) => row.status === "completed").length,
        pendingSignals: articleRows.filter((row) => row.status === "pending" || row.status === "running").length,
        failedSignals: articleRows.filter((row) => row.status === "failed").length,
        latestAt: articleRows[0]?.created_at ?? null,
      };
    });
}

function countByArticle(rows: Array<{ article_id: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.article_id, (counts.get(row.article_id) ?? 0) + 1);
  }
  return counts;
}
