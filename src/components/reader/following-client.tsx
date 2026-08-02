"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import fieldReporter from "../../../assets/Jornalism images/Photo-by-Numbercfoto-via-Iwaria.jpg";
import { Button } from "@/components/ui/button";
import { publishedArticles } from "@/lib/reader-data";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type FollowedProfile = {
  id: string;
  full_name: string;
  role: string;
  bio: string | null;
};

export function FollowingClient() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profiles, setProfiles] = useState<FollowedProfile[]>([]);
  const [articleSlugsByAuthor, setArticleSlugsByAuthor] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;

    async function loadFollowing() {
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

      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const ids = followRows?.map((row) => row.following_id as string) ?? [];

      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const [{ data: profileRows }, { data: articleRows }] = await Promise.all([
        supabase.from("public_profiles").select("id, full_name, role, bio").in("id", ids),
        supabase.from("articles").select("author_id, slug").in("author_id", ids),
      ]);

      if (!active) {
        return;
      }

      const grouped: Record<string, string[]> = {};
      for (const article of articleRows ?? []) {
        const authorId = article.author_id as string;
        grouped[authorId] = [...(grouped[authorId] ?? []), article.slug as string];
      }

      setProfiles((profileRows ?? []) as FollowedProfile[]);
      setArticleSlugsByAuthor(grouped);
      setLoading(false);
    }

    void loadFollowing();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-normal text-primary">
          Following
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight">
          Follow reporters whose coverage you want to see first.
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Following is saved to your CampusPress account.
        </p>
      </div>

      {loading ? (
        <p className="rounded-md border bg-card px-6 py-6 text-muted-foreground">
          Loading followed authors...
        </p>
      ) : signedIn && profiles.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="flex flex-col gap-4">
            {profiles.map((profile) => {
              const articles = publishedArticles.filter((article) =>
                (articleSlugsByAuthor[profile.id] ?? []).includes(article.slug),
              );

              return (
                <article className="rounded-md border bg-card p-6" key={profile.id}>
                  <div>
                    <h2 className="text-2xl font-semibold">{profile.full_name}</h2>
                    <p className="mt-1 text-sm text-primary">
                      {profile.role === "journalist" ? "Student journalist" : profile.role}
                    </p>
                  </div>
                  <p className="mt-4 leading-7 text-muted-foreground">
                    {profile.bio ?? "CampusPress author."}
                  </p>
                  <div className="mt-6 flex flex-col gap-2">
                    {articles.map((article) => (
                      <Link
                        className="text-sm font-semibold text-foreground hover:text-primary"
                        href={`/articles/${article.slug}`}
                        key={article.slug}
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
            <Image
              alt="A field reporter holding a camera."
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              src={fieldReporter}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-8 rounded-md border bg-card p-6 md:grid-cols-[1fr_1fr] md:items-center">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">
              {signedIn ? "No followed authors yet" : "Sign in to follow authors"}
            </h2>
            <p className="text-muted-foreground">
              {signedIn
                ? "Open an article and use Follow to add that author here."
                : "Following is attached to your CampusPress account, not this browser."}
            </p>
            <Link className="w-fit" href={signedIn ? "/feed" : "/auth"}>
              <Button>{signedIn ? "Browse feed" : "Sign in or create account"}</Button>
            </Link>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
            <Image
              alt="A field reporter holding a camera."
              className="object-cover"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              src={fieldReporter}
            />
          </div>
        </div>
      )}
    </section>
  );
}
