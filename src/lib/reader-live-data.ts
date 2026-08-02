import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { publishedArticles, type Article } from "@/lib/reader-data";

type DbArticleRow = {
  title: string;
  slug: string;
  excerpt: string | null;
  plain_text: string;
  content: { html?: string; body?: string } | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  published_at: string | null;
  profiles:
    | {
        id?: string | null;
        full_name?: string | null;
        role?: string | null;
      }
    | Array<{
        id?: string | null;
        full_name?: string | null;
        role?: string | null;
      }>
    | null;
  categories:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;
};

export async function loadPublishedFeedArticles(limit = 40): Promise<Article[]> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "title, slug, excerpt, plain_text, content, featured_image_url, featured_image_alt, published_at, profiles!articles_author_id_fkey(id, full_name, role), categories(name)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return publishedArticles;
  }

  const liveArticles = ((data ?? []) as DbArticleRow[]).map(dbArticleToReaderArticle);
  const seenSlugs = new Set(liveArticles.map((article) => article.slug));
  const fallbackArticles = publishedArticles.filter((article) => !seenSlugs.has(article.slug));

  return [...liveArticles, ...fallbackArticles].slice(0, limit);
}

function dbArticleToReaderArticle(row: DbArticleRow): Article {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const categoryName = category?.name || "Campus News";
  const body = contentToParagraphs(row.content, row.plain_text);

  return {
    slug: row.slug,
    title: row.title,
    deck: row.excerpt || body[0] || "Published campus story.",
    category: categoryName,
    interests: [categoryName],
    authorId: profile?.id || "campuspress-writer",
    authorName: profile?.full_name || "CampusPress writer",
    authorRole: profile?.role || "Student journalist",
    publishedAt: formatPublishedDate(row.published_at),
    publishedSort: row.published_at ?? undefined,
    readTime: `${Math.max(1, Math.ceil(wordCount(row.plain_text || body.join(" ")) / 220))} min read`,
    heroImage: row.featured_image_url || publishedArticles[0].heroImage,
    imageAlt: row.featured_image_alt || "Article cover image",
    imageCredit: row.featured_image_url ? "CampusPress upload" : "CampusPress photo archive",
    body,
  };
}

function contentToParagraphs(content: DbArticleRow["content"], plainText: string) {
  const htmlBody = typeof content?.body === "string" ? content.body : "";
  const source = htmlBody || plainText;
  const paragraphs = source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : ["Published campus story."];
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function formatPublishedDate(value: string | null) {
  if (!value) {
    return "Published";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}
