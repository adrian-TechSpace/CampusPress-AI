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

export type JournalistPortfolio = {
  profile: {
    id: string;
    fullName: string;
    username: string;
    bio: string | null;
    departmentCode: string;
    verified: boolean;
    verifiedAt: string | null;
    articleCount: number;
    credibilityScore: number;
    createdAt: string;
  };
  articles: PortfolioArticle[];
  badges: PortfolioBadge[];
  credibility: PortfolioCredibility;
};

type ProfileRow = {
  id: string;
  full_name: string;
  username: string | null;
  bio: string | null;
  department_code: string;
  verified: boolean;
  verified_at: string | null;
  article_count: number;
  credibility_score: number;
  created_at: string;
};

type ResolvedProfileRow = ProfileRow & {
  username: string;
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

const openAiSignalKeys = new Set(["openai_editorial", "openai_verification"]);

export async function loadJournalistPortfolio(username: string): Promise<JournalistPortfolio | null> {
  const supabase = createAnonSupabaseClient();
  const cleanUsername = username.trim().toLowerCase();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, username, bio, department_code, verified, verified_at, article_count, credibility_score, created_at")
    .eq("username", cleanUsername)
    .eq("role", "journalist")
    .maybeSingle();

  const profileUsername = profile?.username;
  if (profileError || !profileUsername) {
    return null;
  }

  const typedProfile = { ...(profile as ProfileRow), username: profileUsername };
  const { data: articles, error: articleError } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, plain_text, featured_image_url, featured_image_alt, published_at")
    .eq("author_id", typedProfile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (articleError) {
    throw articleError;
  }

  const articleRows = (articles ?? []) as ArticleRow[];
  const [credibility, awardedBadges] = await Promise.all([
    loadCredibilityTrackRecord(
      createServiceSupabaseClient(),
      articleRows.map((article) => article.id),
    ),
    loadAwardedBadges(supabase, typedProfile.id),
  ]);

  return {
    profile: {
      id: typedProfile.id,
      fullName: typedProfile.full_name,
      username: typedProfile.username,
      bio: typedProfile.bio,
      departmentCode: typedProfile.department_code,
      verified: typedProfile.verified,
      verifiedAt: typedProfile.verified_at,
      articleCount: Number(typedProfile.article_count ?? 0),
      credibilityScore: Number(typedProfile.credibility_score ?? 0),
      createdAt: typedProfile.created_at,
    },
    articles: articleRows.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      plainText: article.plain_text,
      featuredImageUrl: article.featured_image_url,
      featuredImageAlt: article.featured_image_alt,
      publishedAt: article.published_at,
    })),
    badges: buildPortfolioBadges(typedProfile, articleRows, credibility, awardedBadges),
    credibility,
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

function buildPortfolioBadges(
  profile: ResolvedProfileRow,
  articles: ArticleRow[],
  credibility: PortfolioCredibility,
  awardedBadges: AwardedPortfolioBadge[],
): PortfolioBadge[] {
  const badges = new Map<string, PortfolioBadge>();

  if (profile.verified) {
    badges.set("verified-chrisland-identity", {
      name: "Verified Chrisland Student/Staff",
      description: "The university roster cross-check matched this journalist profile.",
      evidence: profile.verified_at ? `Roster matched on ${formatDate(profile.verified_at)}.` : "Roster matched this profile.",
      tone: "verified",
    });
  }

  if (articles.length > 0) {
    badges.set("published-reporter", {
      name: "Published Reporter",
      description: "Awarded when a journalist has public published work.",
      evidence: `${articles.length} published ${articles.length === 1 ? "article" : "articles"} on this portfolio.`,
      tone: "standard",
    });
  }

  if (credibility.workingSignalAverage !== null && credibility.workingSignalAverage >= 75) {
    badges.set("credibility-builder", {
      name: "Credibility Builder",
      description: "Awarded for published work with strong completed credibility signals.",
      evidence: `Working-signal average: ${credibility.workingSignalAverage}% across ${credibility.completedWorkingSignals} completed checks.`,
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
