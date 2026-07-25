"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ArticleCard } from "@/components/reader/article-card";
import { Input } from "@/components/ui/input";
import { searchArticles } from "@/lib/reader-data";

export function SearchClient() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchArticles(query), [query]);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-normal text-primary">Search</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight">
          Find published campus stories by topic, author, or phrase.
        </h1>
      </div>

      <label className="relative block max-w-3xl" htmlFor="reader-search">
        <span className="sr-only">Search articles</span>
        <Search className="pointer-events-none absolute left-4 top-3 size-4 text-muted-foreground" />
        <Input
          className="pl-12"
          id="reader-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try academics or newsroom"
          value={query}
        />
      </label>

      <div>
        <p className="text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "result" : "results"}
        </p>
        {results.length > 0 ? (
          results.map((article) => <ArticleCard article={article} key={article.slug} />)
        ) : (
          <p className="mt-8 rounded-md border bg-card px-6 py-6 text-muted-foreground">
            No published story matches that search yet.
          </p>
        )}
      </div>
    </section>
  );
}
