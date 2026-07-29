"use client";

import { useEffect, useMemo, useState } from "react";

import { ArticleCard } from "@/components/reader/article-card";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  getPersonalizedFeed,
  interests,
  publishedArticles,
  whyArticleAppears,
  type Article,
  type Interest,
} from "@/lib/reader-data";

const starterInterests: Interest[] = ["Campus Life"];

type FeedClientProps = {
  initialArticles?: Article[];
};

export function FeedClient({ initialArticles }: FeedClientProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(starterInterests);
  const articles = useMemo(
    () => (initialArticles && initialArticles.length > 0 ? initialArticles : publishedArticles),
    [initialArticles],
  );

  useEffect(() => {
    let active = true;

    async function loadReaderInterests() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", userId)
          .maybeSingle();

        if (!active || error) {
          return;
        }

        const savedInterests = readProfileInterests(data?.preferences);
        if (savedInterests.length > 0) {
          setSelectedInterests(savedInterests);
        }
      } catch {
        return;
      }
    }

    void loadReaderInterests();

    return () => {
      active = false;
    };
  }, [supabase]);

  const availableInterests = useMemo(
    () =>
      Array.from(
        new Set([
          ...interests,
          ...articles.flatMap((article) => article.interests),
          ...selectedInterests,
        ]),
      ),
    [articles, selectedInterests],
  );

  const feed = getPersonalizedFeed(selectedInterests, articles);

  function toggleInterest(interest: Interest) {
    const next = selectedInterests.includes(interest)
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest];
    const fallback: Interest[] = next.length > 0 ? next : ["Campus Life"];

    setSelectedInterests(fallback);
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24" data-testid="track1-item5-feed-root">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-normal text-primary">
          Personalized Feed
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight">
          Choose what you care about. The order changes immediately.
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Each recommendation includes a plain-English note explaining why it is
          appearing in your feed.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {availableInterests.map((interest) => (
          <Button
            aria-pressed={selectedInterests.includes(interest)}
            key={interest}
            onClick={() => toggleInterest(interest)}
            type="button"
            variant={selectedInterests.includes(interest) ? "default" : "outline"}
          >
            {interest}
          </Button>
        ))}
      </div>

      <div>
        {feed.map(({ article }) => (
          <div data-testid="track1-item5-feed-title" key={article.slug}>
            <ArticleCard
              article={article}
              note={whyArticleAppears(article, selectedInterests)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function readProfileInterests(preferences: unknown): Interest[] {
  if (!preferences || typeof preferences !== "object" || !("interests" in preferences)) {
    return [];
  }

  const value = (preferences as { interests?: unknown }).interests;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((interest): interest is Interest => typeof interest === "string" && interest.trim().length > 0);
}
