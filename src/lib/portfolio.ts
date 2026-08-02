import { createAnonSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase-server";

export type PortfolioArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  plainText: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  publishedAt: string | null;
};

export type PortfolioBadge = {
  name: string;
  description: string;
  evidence: string;
  tone: "standard" | "verified";
};

type PortfolioBadgeTone = PortfolioBadge["tone"];

export type PortfolioCredibility = {
  workingSignalAverage: number | null;
  completedWorkingSignals: number;
  publishedArticlesWithEvidence: number;
  openAiExcludedSignals: number;
};

export type RolePortfolioProfile = {
  id: string;
  fullName: string;
  username: string;
  role: "reader" | "journalist" | "editor" | "admin" | "subadmin";
  bio: string | null;
  avatarUrl: string | null;
  departmentCode: string;
  verified: boolean;
  verifiedAt: string | null;
  articleCount: number;
  credibilityScore: number;
  createdAt: string;
  followerCount: number;
  tenureLabel: string;
};

export type ReaderActivity = {
  likedArticles: Array<{
    title: string;
    slug: string;
    likedAt: string;
  }>;
  comments: Array<{
    body: string;
    articleTitle: string;
    articleSlug: string;
    createdAt: string;
  }>;
  sharesLikedArticles: boolean;
  sharesComments: boolean;
};

export type EditorStats = {
  reviewedCount: number;
  approvedCount: number;
  revisionRequestedCount: number;
};

export type RolePortfolio =
  | {
      kind: "reader";
      profile: RolePortfolioProfile;
      badges: PortfolioBadge[];
      readerActivity: ReaderActivity;
    }
  | {
      kind: "journalist";
      profile: RolePortfolioProfile;
      articles: PortfolioArticle[];
      badges: PortfolioBadge[];
      credibility: PortfolioCredibility;
    }
  | {
      kind: "editor";
      profile: RolePortfolioProfile;
      badges: PortfolioBadge[];
      editorStats: EditorStats;
    }
  | {
      kind: "admin";
      profile: RolePortfolioProfile;
      badges: PortfolioBadge[];
    };

export type JournalistPortfolio = Extract<RolePortfolio, { kind: "journalist" }>;

type ProfileRow = {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  department_code: string;
  verified: boolean;
  verified_at: string | null;
  article_count: number;
  credibility_score: number;
  created_at: string;
};

type ResolvedProfileRow = ProfileRow & {
  username: string;
  role: RolePortfolioProfile["role"];
};

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  plain_text: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  published_at: string | null;
};

type AnalysisRow = {
  article_id: string;
  status: string;
  score: number | null;
  raw_output: { key?: string } | null;
  created_at: string;
};

type AchievementJoinRow = {
  awarded_at: string;
  achievements:
    | {
        name: string;
        slug: string;
        description: string;
        badge_tone?: string | null;
      }
    | Array<{
        name: string;
        slug: string;
        description: string;
        badge_tone?: string | null;
      }>
    | null;
};

type AwardedPortfolioBadge = {
  name: string;
  slug: string;
  description: string;
  tone: PortfolioBadgeTone;
  awardedAt: string;
};

type PublicSettingsRow = {
  show_liked_articles: boolean;
  show_public_comments: boolean;
};

type LikedArticleRow = {
  created_at: string;
  articles:
    | {
        title?: string | null;
        slug?: string | null;
        status?: string | null;
      }
    | Array<{
        title?: string | null;
        slug?: string | null;
        status?: string | null;
      }>
    | null;
};

type CommentActivityRow = {
  body: string;
  created_at: string;
  articles:
    | {
        title?: string | null;
        slug?: string | null;
        status?: string | null;
      }
    | Array<{
        title?: string | null;
        slug?: string | null;
        status?: string | null;
      }>
    | null;
};

const openAiSignalKeys = new Set(["openai_editorial", "openai_verification"]);
const portfolioRoles = new Set(["reader", "journalist", "editor", "admin", "subadmin"]);

export async function loadRolePortfolio(username: string): Promise<RolePortfolio | null> {
  const supabase = createServiceSupabaseClient();
  const cleanUsername = username.trim().toLowerCase();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, username, role, bio, avatar_url, department_code, verified, verified_at, article_count, credibility_score, created_at")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (profileError || !profile?.username || !portfolioRoles.has(String(profile.role))) {
    return null;
  }

  const typedProfile = profile as ResolvedProfileRow;
  const [followerCount, awardedBadges] = await Promise.all([
    loadFollowerCount(supabase, typedProfile.id),
    loadAwardedBadges(supabase, typedProfile.id),
  ]);
  const baseProfile = mapProfile(typedProfile, followerCount);
  const baseBadges = buildBaseBadges(typedProfile, awardedBadges);

  if (typedProfile.role === "reader") {
    return {
      kind: "reader",
      profile: baseProfile,
      badges: baseBadges,
      readerActivity: await loadReaderActivity(supabase, typedProfile.id),
    };
  }

  if (typedProfile.role === "editor") {
    return {
      kind: "editor",
      profile: baseProfile,
      badges: baseBadges,
      editorStats: await loadEditorStats(supabase, typedProfile.id),
    };
  }

  if (typedProfile.role === "admin" || typedProfile.role === "subadmin") {
    return {
      kind: "admin",
      profile: baseProfile,
      badges: baseBadges,
    };
  }

  const articles = await loadPublishedArticles(supabase, typedProfile.id);
  const credibility = await loadCredibilityTrackRecord(
    supabase,
    articles.map((article) => article.id),
  );

  return {
    kind: "journalist",
    profile: baseProfile,
    articles: articles.map(mapArticle),
    badges: buildJournalistBadges(typedProfile, articles, credibility, awardedBadges),
    credibility,
  };
}

export async function loadJournalistPortfolio(username: string): Promise<JournalistPortfolio | null> {
  const portfolio = await loadRolePortfolio(username);
  return portfolio?.kind === "journalist" ? portfolio : null;
}

async function loadFollowerCount(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
) {
  const { count, error } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", userId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function loadPublishedArticles(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  authorId: string,
) {
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, plain_text, featured_image_url, featured_image_alt, published_at")
    .eq("author_id", authorId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ArticleRow[];
}

async function loadReaderActivity(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
): Promise<ReaderActivity> {
  const { data: settings, error: settingsError } = await supabase
    .from("profile_public_settings")
    .select("show_liked_articles, show_public_comments")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  const typedSettings = settings as PublicSettingsRow | null;
  const sharesLikedArticles = Boolean(typedSettings?.show_liked_articles);
  const sharesComments = Boolean(typedSettings?.show_public_comments);
  const [likedArticles, comments] = await Promise.all([
    sharesLikedArticles ? loadLikedArticles(supabase, userId) : Promise.resolve([]),
    sharesComments ? loadPublicComments(supabase, userId) : Promise.resolve([]),
  ]);

  return {
    likedArticles,
    comments,
    sharesLikedArticles,
    sharesComments,
  };
}

async function loadLikedArticles(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("article_likes")
    .select("created_at, articles(title, slug, status)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    throw error;
  }

  return ((data ?? []) as LikedArticleRow[])
    .map((row) => {
      const article = Array.isArray(row.articles) ? row.articles[0] : row.articles;
      if (!article?.title || !article.slug || article.status !== "published") {
        return null;
      }

      return {
        title: article.title,
        slug: article.slug,
        likedAt: row.created_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function loadPublicComments(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("comments")
    .select("body, created_at, articles(title, slug, status)")
    .eq("author_id", userId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    throw error;
  }

  return ((data ?? []) as CommentActivityRow[])
    .map((row) => {
      const article = Array.isArray(row.articles) ? row.articles[0] : row.articles;
      if (!article?.title || !article.slug || article.status !== "published") {
        return null;
      }

      return {
        body: row.body,
        articleTitle: article.title,
        articleSlug: article.slug,
        createdAt: row.created_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function loadEditorStats(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  editorId: string,
): Promise<EditorStats> {
  const { data, error } = await supabase
    .from("articles")
    .select("id, status, reviewed_at")
    .eq("editor_id", editorId)
    .not("reviewed_at", "is", null)
    .limit(1000);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ status: string; reviewed_at: string | null }>;

  return {
    reviewedCount: rows.length,
    approvedCount: rows.filter((row) => ["approved", "published"].includes(row.status)).length,
    revisionRequestedCount: rows.filter((row) => row.status === "revision_requested").length,
  };
}

async function loadCredibilityTrackRecord(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  articleIds: string[],
): Promise<PortfolioCredibility> {
  if (articleIds.length === 0) {
    return {
      workingSignalAverage: null,
      completedWorkingSignals: 0,
      publishedArticlesWithEvidence: 0,
      openAiExcludedSignals: 0,
    };
  }

  const { data, error } = await supabase
    .from("ai_analyses")
    .select("article_id, status, score, raw_output, created_at")
    .in("article_id", articleIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const latestRows = latestAnalysisRows((data ?? []) as AnalysisRow[]);
  const completedWorkingScores = latestRows
    .filter((row) => {
      const key = row.raw_output?.key;
      return row.status === "completed" && typeof row.score === "number" && key && !openAiSignalKeys.has(key);
    })
    .map((row) => Number(row.score));
  const articlesWithEvidence = new Set(
    latestRows
      .filter((row) => row.status === "completed" && row.raw_output?.key && !openAiSignalKeys.has(row.raw_output.key))
      .map((row) => row.article_id),
  );

  return {
    workingSignalAverage:
      completedWorkingScores.length === 0
        ? null
        : Math.round(completedWorkingScores.reduce((sum, score) => sum + score, 0) / completedWorkingScores.length),
    completedWorkingSignals: completedWorkingScores.length,
    publishedArticlesWithEvidence: articlesWithEvidence.size,
    openAiExcludedSignals: latestRows.filter((row) => row.raw_output?.key && openAiSignalKeys.has(row.raw_output.key)).length,
  };
}

function latestAnalysisRows(rows: AnalysisRow[]) {
  const latestByArticleAndSignal = new Map<string, AnalysisRow>();

  for (const row of rows) {
    const signalKey = row.raw_output?.key;
    if (!signalKey) {
      continue;
    }

    const mapKey = `${row.article_id}:${signalKey}`;
    if (!latestByArticleAndSignal.has(mapKey)) {
      latestByArticleAndSignal.set(mapKey, row);
    }
  }

  return [...latestByArticleAndSignal.values()];
}

async function loadAwardedBadges(
  supabase: ReturnType<typeof createAnonSupabaseClient>,
  userId: string,
): Promise<AwardedPortfolioBadge[]> {
  const { data, error } = await supabase
    .from("user_achievements")
    .select("awarded_at, achievements(name, slug, description, badge_tone)")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AchievementJoinRow[])
    .map((row) => {
      const achievement = Array.isArray(row.achievements) ? row.achievements[0] : row.achievements;
      if (!achievement) {
        return null;
      }
      const tone = resolveAwardedBadgeTone(achievement.badge_tone);

      return {
        name: achievement.name,
        slug: achievement.slug,
        description: achievement.description,
        tone,
        awardedAt: row.awarded_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function resolveAwardedBadgeTone(value: string | null | undefined): PortfolioBadgeTone {
  if (value === null || value === undefined) {
    return "standard";
  }

  return value === "gold" || value === "verified" ? "verified" : "standard";
}

function buildBaseBadges(
  profile: ResolvedProfileRow,
  awardedBadges: AwardedPortfolioBadge[],
): PortfolioBadge[] {
  const badges = new Map<string, PortfolioBadge>();

  if (profile.verified) {
    badges.set("verified-chrisland-identity", {
      name: "Verified Chrisland Student",
      description: "CampusPress matched this account to a Chrisland student record. This confirms identity, not article quality or university endorsement.",
      evidence: profile.verified_at ? `Roster matched on ${formatDate(profile.verified_at)}.` : "Roster matched this profile.",
      tone: "verified",
    });
  } else {
    badges.set("unverified-profile", {
      name: "Unverified",
      description: "No roster match has been recorded for this account yet.",
      evidence: "This account has not received a roster verification match.",
      tone: "standard",
    });
  }

  for (const awarded of awardedBadges) {
    if (!badges.has(awarded.slug)) {
      badges.set(awarded.slug, {
        name: awarded.name,
        description: awarded.description,
        evidence: `Awarded by CampusPress record on ${formatDate(awarded.awardedAt)}.`,
        tone: awarded.tone,
      });
    }
  }

  return [...badges.values()];
}

function buildJournalistBadges(
  profile: ResolvedProfileRow,
  articles: ArticleRow[],
  credibility: PortfolioCredibility,
  awardedBadges: AwardedPortfolioBadge[],
): PortfolioBadge[] {
  const badges = new Map(buildBaseBadges(profile, awardedBadges).map((badge) => [badge.name, badge]));

  if (articles.length > 0) {
    badges.set("Published Reporter", {
      name: "Published Reporter",
      description: "Awarded when a journalist has public published work.",
      evidence: `${articles.length} published ${articles.length === 1 ? "article" : "articles"} on this portfolio.`,
      tone: "standard",
    });
  }

  if (credibility.workingSignalAverage !== null && credibility.workingSignalAverage >= 75) {
    badges.set("Credibility Builder", {
      name: "Credibility Builder",
      description: "Awarded for published work with strong completed credibility signals.",
      evidence: `Working-signal average: ${credibility.workingSignalAverage}% across ${credibility.completedWorkingSignals} completed checks.`,
      tone: "standard",
    });
  }

  return [...badges.values()];
}

function mapProfile(profile: ResolvedProfileRow, followerCount: number): RolePortfolioProfile {
  return {
    id: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    role: profile.role,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    departmentCode: profile.department_code,
    verified: profile.verified,
    verifiedAt: profile.verified_at,
    articleCount: Number(profile.article_count ?? 0),
    credibilityScore: Number(profile.credibility_score ?? 0),
    createdAt: profile.created_at,
    followerCount,
    tenureLabel: tenureLabel(profile.created_at),
  };
}

function mapArticle(article: ArticleRow): PortfolioArticle {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    plainText: article.plain_text,
    featuredImageUrl: article.featured_image_url,
    featuredImageAlt: article.featured_image_alt,
    publishedAt: article.published_at,
  };
}

function tenureLabel(value: string) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) {
    return "Tenure not recorded";
  }

  const days = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  if (days < 30) {
    return `${days || 1} ${days === 1 ? "day" : "days"} on CampusPress`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} ${months === 1 ? "month" : "months"} on CampusPress`;
  }

  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} on CampusPress`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
