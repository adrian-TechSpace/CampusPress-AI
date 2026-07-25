"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import readingExperience from "../../../assets/Jornalism images/onur-kurt-reading-newspaper-unsplash.jpg";
import { ArticleCard } from "@/components/reader/article-card";
import { Button } from "@/components/ui/button";
import { publishedArticles } from "@/lib/reader-data";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export function BookmarksClient() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [bookmarkSlugs, setBookmarkSlugs] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadBookmarks() {
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!active) {
        return;
      }

      setSignedIn(Boolean(userId));

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("bookmarks")
        .select("articles(slug)")
        .eq("user_id", userId);

      if (!active) {
        return;
      }

      const slugs =
        data
          ?.map((row) => {
            const article = row.articles as { slug?: string } | { slug?: string }[] | null;
            return Array.isArray(article) ? article[0]?.slug : article?.slug;
          })
          .filter((slug): slug is string => Boolean(slug)) ?? [];
      setBookmarkSlugs(slugs);
      setLoading(false);
    }

    void loadBookmarks();

    return () => {
      active = false;
    };
  }, []);

  const bookmarkedArticles = publishedArticles.filter((article) =>
    bookmarkSlugs.includes(article.slug),
  );

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-normal text-primary">
          Bookmarks
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight">
          Saved stories stay close without crowding the reader.
        </h1>
      </div>

      {loading ? (
        <p className="rounded-md border bg-card px-6 py-6 text-muted-foreground">
          Loading your bookmarks...
        </p>
      ) : signedIn && bookmarkedArticles.length > 0 ? (
        <div>
          {bookmarkedArticles.map((article) => (
            <ArticleCard article={article} key={article.slug} />
          ))}
        </div>
      ) : (
        <div className="grid gap-8 rounded-md border bg-card p-6 md:grid-cols-[1fr_1fr] md:items-center">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">
              {signedIn ? "No saved stories yet" : "Sign in to view bookmarks"}
            </h2>
            <p className="text-muted-foreground">
              {signedIn
                ? "Open any published article and use Save to add it to this list."
                : "Bookmarks are saved to your CampusPress account, not this device."}
            </p>
            <Link className="w-fit" href={signedIn ? "/feed" : "/auth"}>
              <Button>{signedIn ? "Browse feed" : "Sign in or create account"}</Button>
            </Link>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
            <Image
              alt="A person reading a newspaper beside a window."
              className="object-cover"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              src={readingExperience}
            />
          </div>
        </div>
      )}
    </section>
  );
}
