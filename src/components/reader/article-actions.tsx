"use client";

import { Bookmark, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type ArticleActionsProps = {
  articleSlug: string;
};

type DbArticle = {
  id: string;
  author_id: string;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
};

export function ArticleActions({ articleSlug }: ArticleActionsProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [article, setArticle] = useState<DbArticle | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    "Sign in to save, follow, like, or comment on this story.",
  );

  useEffect(() => {
    let active = true;

    async function loadReaderState() {
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      const { data: articleData } = await supabase
        .from("articles")
        .select("id, author_id")
        .eq("slug", articleSlug)
        .eq("status", "published")
        .maybeSingle();

      if (!active) {
        return;
      }

      setUserId(currentUserId);
      setArticle(articleData ?? null);

      if (!articleData) {
        setMessage("Reader actions are not ready for this article yet.");
        return;
      }

      const { data: commentRows } = await supabase
        .from("comments")
        .select("id, body, created_at")
        .eq("article_id", articleData.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });

      if (!active) {
        return;
      }

      setComments((commentRows ?? []) as CommentRow[]);

      if (!currentUserId) {
        setMessage("Sign in to save, follow, like, or comment on this story.");
        return;
      }

      const [bookmarkResult, likeResult, followResult] = await Promise.all([
        supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("article_id", articleData.id)
          .maybeSingle(),
        supabase
          .from("article_likes")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("article_id", articleData.id)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("id")
          .eq("follower_id", currentUserId)
          .eq("following_id", articleData.author_id)
          .maybeSingle(),
      ]);

      if (!active) {
        return;
      }

      setBookmarked(Boolean(bookmarkResult.data));
      setLiked(Boolean(likeResult.data));
      setFollowing(Boolean(followResult.data));
      setMessage("Reader tools are ready for your account.");
    }

    void loadReaderState();

    return () => {
      active = false;
    };
  }, [articleSlug]);

  const status = useMemo(() => {
    const parts = [];

    if (bookmarked) {
      parts.push("saved");
    }

    if (liked) {
      parts.push("liked");
    }

    if (following) {
      parts.push("following author");
    }

    return parts.length > 0 ? parts.join(", ") : "ready";
  }, [bookmarked, following, liked]);

  function requireSignedIn(action: string) {
    if (!userId) {
      setMessage(`Sign in or create an account to ${action}.`);
      return false;
    }

    if (!article) {
      setMessage("Reader actions are not ready for this article yet.");
      return false;
    }

    return true;
  }

  async function toggleBookmark() {
    if (!requireSignedIn("save this story")) {
      return;
    }

    const currentArticle = article;
    const currentUserId = userId;

    if (!currentArticle || !currentUserId) {
      return;
    }

    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const result = bookmarked
      ? await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", currentUserId)
          .eq("article_id", currentArticle.id)
      : await supabase.from("bookmarks").insert({
          user_id: currentUserId,
          article_id: currentArticle.id,
        });
    setPending(false);

    if (result.error) {
      setMessage("CampusPress could not update this bookmark. Try again.");
      return;
    }

    setBookmarked(!bookmarked);
    setMessage(bookmarked ? "Bookmark removed." : "Story saved to bookmarks.");
  }

  async function toggleLike() {
    if (!requireSignedIn("like this story")) {
      return;
    }

    const currentArticle = article;
    const currentUserId = userId;

    if (!currentArticle || !currentUserId) {
      return;
    }

    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const result = liked
      ? await supabase
          .from("article_likes")
          .delete()
          .eq("user_id", currentUserId)
          .eq("article_id", currentArticle.id)
      : await supabase.from("article_likes").insert({
          user_id: currentUserId,
          article_id: currentArticle.id,
        });
    setPending(false);

    if (result.error) {
      setMessage("CampusPress could not update this like. Try again.");
      return;
    }

    setLiked(!liked);
    setMessage(liked ? "Like removed." : "Story liked.");
  }

  async function toggleFollow() {
    if (!requireSignedIn("follow this author")) {
      return;
    }

    const currentArticle = article;
    const currentUserId = userId;

    if (!currentArticle || !currentUserId) {
      return;
    }

    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const result = following
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", currentArticle.author_id)
      : await supabase.from("follows").insert({
          follower_id: currentUserId,
          following_id: currentArticle.author_id,
        });
    setPending(false);

    if (result.error) {
      setMessage("CampusPress could not update this follow. Try again.");
      return;
    }

    setFollowing(!following);
    setMessage(following ? "Author removed from following." : "Author followed.");
  }

  async function postComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requireSignedIn("post a comment")) {
      return;
    }

    const currentArticle = article;
    const currentUserId = userId;

    if (!currentArticle || !currentUserId) {
      return;
    }

    const body = draft.trim();

    if (!body) {
      setMessage("Write a comment before posting.");
      return;
    }

    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        article_id: currentArticle.id,
        author_id: currentUserId,
        body,
      })
      .select("id, body, created_at")
      .single();
    setPending(false);

    if (error || !data) {
      setMessage("CampusPress could not post this comment. Try again.");
      return;
    }

    setComments((current) => [...current, data as CommentRow]);
    setDraft("");
    setMessage("Comment posted.");
  }

  return (
    <section className="mt-12 border-t pt-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Reader tools: {status}</p>
          <p className="text-sm font-semibold text-primary" role="status">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            aria-pressed={bookmarked}
            disabled={pending}
            onClick={toggleBookmark}
            type="button"
            variant={bookmarked ? "default" : "outline"}
          >
            <Bookmark />
            {bookmarked ? "Saved" : "Save"}
          </Button>
          <Button
            aria-pressed={liked}
            disabled={pending}
            onClick={toggleLike}
            type="button"
            variant={liked ? "default" : "outline"}
          >
            <Heart />
            {liked ? "Liked" : "Like"}
          </Button>
          <Button
            aria-pressed={following}
            disabled={pending}
            onClick={toggleFollow}
            type="button"
            variant={following ? "default" : "outline"}
          >
            <UserPlus />
            {following ? "Following" : "Follow"}
          </Button>
        </div>
      </div>

      {!userId ? (
        <div className="mt-6 rounded-md border bg-card px-4 py-4 text-sm leading-6 text-muted-foreground">
          <p>Sign in or create an account to use reader actions.</p>
          <a className="mt-3 inline-block font-semibold text-primary" href="/auth">
            Go to sign in
          </a>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Comments</h2>
        </div>
        <form className="flex flex-col gap-3" onSubmit={postComment}>
          <label className="sr-only" htmlFor="comment">
            Add a comment
          </label>
          <textarea
            className="min-h-24 rounded-md border bg-background px-4 py-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="comment"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Share a clear, specific response to this story."
            value={draft}
          />
          <Button className="w-fit" disabled={pending} type="submit">
            Post comment
          </Button>
        </form>
        <div className="flex flex-col gap-3">
          {comments.length === 0 ? (
            <p className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">
              No comments yet. Sign in to add context.
            </p>
          ) : (
            comments.map((comment) => (
              <article
                className="rounded-md border bg-card px-4 py-3 text-sm leading-6"
                key={comment.id}
              >
                <p>{comment.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
