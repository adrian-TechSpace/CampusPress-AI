"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";

import logo from "../../../assets/Chrisland university logo.webp";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  getArticleAuthor,
  getPersonalizedFeed,
  publishedArticles,
  whyArticleAppears,
  type Article,
  type Interest,
} from "@/lib/reader-data";

type JournalistProfile = {
  id: string;
  full_name: string;
  role: string;
  bio: string | null;
};

const starterDashboardInterests: Interest[] = ["Campus Life", "Academics"];

type ReaderHomeClientProps = {
  initialArticles?: Article[];
};

export function ReaderHomeClient({ initialArticles = publishedArticles }: ReaderHomeClientProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [userId, setUserId] = useState("");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [journalists, setJournalists] = useState<JournalistProfile[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(starterDashboardInterests);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState({ x: 24, y: 104 });
  const [messagesPosition, setMessagesPosition] = useState({ x: 24, y: 24 });

  const feed = getPersonalizedFeed(selectedInterests, initialArticles);
  const latest = [...initialArticles].slice(0, 4);
  const whoToFollow = journalists.filter((profile) => !followingIds.includes(profile.id)).slice(0, 3);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData.user?.id ?? "";
      if (!active) {
        return;
      }
      setUserId(id);

      if (!id) {
        return;
      }

      const [follows, profiles, readerProfile] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", id),
        supabase
          .from("profiles")
          .select("id, full_name, role, bio")
          .eq("role", "journalist")
          .neq("id", id)
          .limit(8),
        supabase
          .from("profiles")
          .select("preferences")
          .eq("id", id)
          .maybeSingle(),
      ]);

      if (!active) {
        return;
      }

      if (!follows.error) {
        setFollowingIds((follows.data ?? []).map((row) => row.following_id));
      }

      if (!profiles.error) {
        setJournalists((profiles.data ?? []) as JournalistProfile[]);
      }

      if (!readerProfile.error) {
        const savedInterests = readProfileInterests(readerProfile.data?.preferences);
        if (savedInterests.length > 0) {
          setSelectedInterests(savedInterests);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function followJournalist(profileId: string) {
    if (!userId) {
      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: userId,
      following_id: profileId,
    });

    if (!error) {
      setFollowingIds((current) => [...current, profileId]);
    }
  }

  return (
    <div
      className="mx-auto grid max-w-6xl gap-0 px-0 md:px-6 lg:grid-cols-[minmax(0,40rem)_22rem]"
      data-testid="reader-home"
    >
      <section className="min-w-0 border-r">
        <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="grid grid-cols-2 text-center text-sm font-semibold">
            <button className="border-b-2 border-primary px-4 py-3 text-foreground" type="button">
              For you
            </button>
            <button className="border-b px-4 py-3 text-muted-foreground" type="button">
              Following
            </button>
          </div>
        </div>

        <div>
          {feed.map(({ article }) => {
            const author = getArticleAuthor(article);
            return (
              <article className="grid gap-4 border-b px-5 py-6" key={article.slug}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="font-semibold">{author.name}</p>
                  <p className="text-muted-foreground">{article.publishedAt}</p>
                </div>
                <Link href={`/articles/${article.slug}`}>
                  <h2 className="font-serif text-3xl font-semibold leading-tight hover:text-primary">
                    {article.title}
                  </h2>
                </Link>
                <p className="text-base leading-7 text-muted-foreground">{article.deck}</p>
                <Link
                  className="relative block aspect-[16/9] overflow-hidden rounded-md bg-muted"
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
                      sizes="(min-width: 1024px) 40rem, 100vw"
                      src={article.heroImage}
                    />
                  )}
                </Link>
                <p className="rounded-md border bg-card px-3 py-2 text-sm leading-6 text-muted-foreground">
                  {whyArticleAppears(article, selectedInterests)}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="hidden px-6 py-6 lg:grid lg:content-start lg:gap-5">
        <Module title="Today's news">
          {latest.map((article) => (
            <Link className="grid gap-1 border-b py-3 last:border-b-0" href={`/articles/${article.slug}`} key={article.slug}>
              <span className="text-sm font-semibold leading-5">{article.title}</span>
              <span className="text-xs text-muted-foreground">
                {article.category}, {article.readTime}
              </span>
            </Link>
          ))}
        </Module>

        <Module title="What's happening">
          <Activity text="New reporting in Campus Life and Academics is ready for readers." />
          <Activity text="Student journalists are submitting more drafts for review this week." />
          <Activity text="Bookmark and follow actions now sync to your account." />
        </Module>

        <Module title="Who to follow">
          {whoToFollow.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              You are already following the suggested journalists.
            </p>
          ) : (
            whoToFollow.map((profile) => (
              <div className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0" key={profile.id}>
                <div>
                  <p className="text-sm font-semibold">{profile.full_name}</p>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {profile.bio || "Student journalist"}
                  </p>
                </div>
                <Button
                  aria-label={`Follow ${profile.full_name}`}
                  onClick={() => followJournalist(profile.id)}
                  size="sm"
                  type="button"
                >
                  Follow
                </Button>
              </div>
            ))
          )}
        </Module>
      </aside>

      <FloatingBubble
        label="CampusPress AI assistant"
        onClick={() => setAssistantOpen(true)}
        position={assistantPosition}
      >
        <Image alt="Chrisland University crest" className="size-9 object-contain" src={logo} />
      </FloatingBubble>
      <FloatingBubble
        label="Messages"
        onClick={() => setMessagesOpen(true)}
        position={messagesPosition}
      >
        <MessageCircle aria-hidden className="size-6" />
      </FloatingBubble>

      {assistantOpen ? (
        <FloatingPanel
          onClose={() => setAssistantOpen(false)}
          position={assistantPosition}
          setPosition={setAssistantPosition}
          title="CampusPress AI assistant"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            AI assistant is coming soon. Phase 5 will connect this panel to real
            analysis models, so it is intentionally not pretending to answer yet.
          </p>
        </FloatingPanel>
      ) : null}

      {messagesOpen ? (
        <FloatingPanel
          onClose={() => setMessagesOpen(false)}
          position={messagesPosition}
          setPosition={setMessagesPosition}
          title="Messages"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Direct messaging is coming soon. The Phase 1 messages table and RLS are
            ready, but the full conversation UI should be built as its own focused pass.
          </p>
        </FloatingPanel>
      ) : null}
    </div>
  );
}

function Module({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Activity({ text }: { text: string }) {
  return <p className="border-b py-3 text-sm leading-6 text-muted-foreground last:border-b-0">{text}</p>;
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

function FloatingBubble({
  children,
  label,
  onClick,
  position,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  position: { x: number; y: number };
}) {
  return (
    <button
      aria-label={label}
      className="fixed z-40 grid size-14 place-items-center rounded-md border bg-card shadow-sm"
      onClick={onClick}
      style={{ bottom: position.y, right: position.x }}
      type="button"
    >
      {children}
    </button>
  );
}

function FloatingPanel({
  children,
  onClose,
  position,
  setPosition,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  position: { x: number; y: number };
  setPosition: (position: { x: number; y: number }) => void;
  title: string;
}) {
  const dragStart = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  return (
    <section
      className="fixed z-50 grid w-[min(22rem,calc(100vw-2rem))] gap-4 rounded-md border bg-card p-4 shadow-sm"
      style={{ bottom: position.y + 72, right: position.x }}
    >
      <div
        className="flex cursor-move items-center justify-between gap-4 border-b pb-3"
        onPointerDown={(event) => {
          dragStart.current = {
            x: event.clientX,
            y: event.clientY,
            originX: position.x,
            originY: position.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragStart.current) {
            return;
          }
          setPosition({
            x: Math.max(12, dragStart.current.originX - (event.clientX - dragStart.current.x)),
            y: Math.max(12, dragStart.current.originY - (event.clientY - dragStart.current.y)),
          });
        }}
        onPointerUp={() => {
          dragStart.current = null;
        }}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          aria-label={`Close ${title}`}
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          title={`Close ${title}`}
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      {children}
    </section>
  );
}
