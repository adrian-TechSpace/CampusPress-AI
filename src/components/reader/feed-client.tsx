"use client";

import { useState } from "react";

import { ArticleCard } from "@/components/reader/article-card";
import { Button } from "@/components/ui/button";
import {
  getPersonalizedFeed,
  interests,
  whyArticleAppears,
  type Interest,
} from "@/lib/reader-data";

export function FeedClient() {
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(["Campus Life"]);

  const feed = getPersonalizedFeed(selectedInterests);

  function toggleInterest(interest: Interest) {
    const next = selectedInterests.includes(interest)
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest];
    const fallback: Interest[] = next.length > 0 ? next : ["Campus Life"];

    setSelectedInterests(fallback);
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
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
        {interests.map((interest) => (
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
          <ArticleCard
            article={article}
            key={article.slug}
            note={whyArticleAppears(article, selectedInterests)}
          />
        ))}
      </div>
    </section>
  );
}
