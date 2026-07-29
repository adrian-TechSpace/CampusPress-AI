import Image from "next/image";
import Link from "next/link";

import { getArticleAuthor, type Article } from "@/lib/reader-data";

type ArticleCardProps = {
  article: Article;
  note?: string;
};

export function ArticleCard({ article, note }: ArticleCardProps) {
  const author = getArticleAuthor(article);

  return (
    <article className="grid gap-6 border-b py-8 md:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-normal text-primary">
          <span>{article.category}</span>
          <span className="text-muted-foreground">{article.readTime}</span>
        </div>
        <Link href={`/articles/${article.slug}`}>
          <h2
            className="font-serif text-4xl font-semibold leading-tight text-foreground transition-colors hover:text-primary"
            data-testid="article-card-title"
          >
            {article.title}
          </h2>
        </Link>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">{article.deck}</p>
        <p className="text-sm text-muted-foreground">
          By {author.name}, {article.publishedAt}
        </p>
        {note ? (
          <p className="max-w-2xl rounded-md border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
            {note}
          </p>
        ) : null}
      </div>
      <Link
        aria-label={`Read ${article.title}`}
        className="relative block aspect-[4/3] overflow-hidden rounded-md bg-muted"
        href={`/articles/${article.slug}`}
      >
        {typeof article.heroImage === "string" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={article.imageAlt}
            className="size-full object-cover"
            src={article.heroImage}
          />
        ) : (
          <Image
            alt={article.imageAlt}
            className="object-cover"
            fill
            sizes="(min-width: 768px) 30vw, 100vw"
            src={article.heroImage}
          />
        )}
      </Link>
    </article>
  );
}
