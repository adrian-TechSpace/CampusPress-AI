import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleActions } from "@/components/reader/article-actions";
import { ReaderChrome } from "@/components/reader/reader-chrome";
import { getArticle, getAuthor, publishedArticles } from "@/lib/reader-data";
import { createAnonSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return publishedArticles.map((article) => ({ slug: article.slug }));
}

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    const dbArticle = await getPublishedArticle(slug);
    if (dbArticle) {
      return {
        title: `${dbArticle.title} | CampusPress AI`,
        description: dbArticle.excerpt ?? undefined,
      };
    }

    return {
      title: "Article not found | CampusPress AI",
    };
  }

  return {
    title: `${article.title} | CampusPress AI`,
    description: article.deck,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    const dbArticle = await getPublishedArticle(slug);
    if (!dbArticle) {
      notFound();
    }

    return (
      <ReaderChrome>
        <article className="mx-auto max-w-3xl px-6 py-24">
          <header className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-normal text-primary">
              <span>Campus story</span>
              <span className="text-muted-foreground">Published article</span>
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-tight md:text-6xl">
              {dbArticle.title}
            </h1>
            {dbArticle.excerpt ? (
              <p className="text-xl leading-8 text-muted-foreground">{dbArticle.excerpt}</p>
            ) : null}
            <div className="flex flex-col gap-2 border-y py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                By{" "}
                {dbArticle.authorUsername ? (
                  <Link
                    className="font-semibold text-foreground underline-offset-4 hover:underline"
                    href={`/portfolio/${dbArticle.authorUsername}`}
                  >
                    {dbArticle.authorName}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{dbArticle.authorName}</span>
                )}
              </p>
              <p>{dbArticle.publishedAt}</p>
            </div>
          </header>

          {dbArticle.featuredImageUrl ? (
            <figure className="my-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={dbArticle.featuredImageAlt || "Article cover image"}
                className="aspect-[4/3] w-full rounded-md object-cover"
                src={dbArticle.featuredImageUrl}
              />
            </figure>
          ) : null}

          <div
            className="reader-rich-body text-lg leading-8"
            dangerouslySetInnerHTML={{ __html: dbArticle.html }}
          />

          <ArticleActions articleSlug={slug} />
        </article>
      </ReaderChrome>
    );
  }

  const author = getAuthor(article.authorId);

  return (
    <ReaderChrome>
      <article className="mx-auto max-w-3xl px-6 py-24">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-normal text-primary">
            <span>{article.category}</span>
            <span className="text-muted-foreground">{article.readTime}</span>
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-tight md:text-6xl">
            {article.title}
          </h1>
          <p className="text-xl leading-8 text-muted-foreground">{article.deck}</p>
          <div className="flex flex-col gap-2 border-y py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              By <span className="font-semibold text-foreground">{author.name}</span>,{" "}
              {article.publishedAt}
            </p>
            <p>{author.role}</p>
          </div>
        </header>

        <figure className="my-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
            <Image
              alt={article.imageAlt}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 768px) 768px, 100vw"
              src={article.heroImage}
            />
          </div>
          <figcaption className="mt-3 text-sm text-muted-foreground">
            {article.imageCredit}
          </figcaption>
        </figure>

        <div className="flex flex-col gap-8 text-lg leading-8">
          {article.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <aside className="mt-12 rounded-md border bg-card px-6 py-6">
          <p className="text-sm font-semibold text-foreground">Why this was recommended</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This story is part of the published CampusPress reader set and is
            connected to {article.interests.join(" and ")} coverage.
          </p>
        </aside>

        <ArticleActions articleSlug={article.slug} />
      </article>
    </ReaderChrome>
  );
}

async function getPublishedArticle(slug: string) {
  const supabase = createAnonSupabaseClient();
  const { data, error } = await supabase
    .from("articles")
    .select("title, excerpt, plain_text, content, featured_image_url, featured_image_alt, published_at, profiles!articles_author_id_fkey(full_name, username)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const content = data.content as { html?: string; body?: string } | null;
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  return {
    title: data.title as string,
    excerpt: data.excerpt as string | null,
    html: content?.html || plainTextToHtml((data.plain_text as string) ?? ""),
    featuredImageUrl: data.featured_image_url as string | null,
    featuredImageAlt: data.featured_image_alt as string | null,
    authorName: profile?.full_name ?? "CampusPress writer",
    authorUsername: profile?.username ?? null,
    publishedAt: data.published_at
      ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(data.published_at as string))
      : "Published",
  };
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
