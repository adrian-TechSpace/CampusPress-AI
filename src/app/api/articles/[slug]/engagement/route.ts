import { NextResponse } from "next/server";

import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteParams = Promise<{ slug: string }>;

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
};

export async function GET(_request: Request, { params }: { params: RouteParams }) {
  const { slug } = await params;
  const cleanSlug = slug.trim();

  if (!cleanSlug) {
    return NextResponse.json({ ok: false, message: "Choose an article before loading engagement." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, author_id")
    .eq("slug", cleanSlug)
    .eq("status", "published")
    .maybeSingle();

  if (articleError) {
    return NextResponse.json({ ok: false, message: "CampusPress could not load that article." }, { status: 500 });
  }

  if (!article) {
    return NextResponse.json({ ok: false, message: "That published article was not found." }, { status: 404 });
  }

  const [bookmarkResult, likeResult, commentsResult] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("article_id", article.id),
    supabase
      .from("article_likes")
      .select("id", { count: "exact", head: true })
      .eq("article_id", article.id),
    supabase
      .from("comments")
      .select("id, body, created_at")
      .eq("article_id", article.id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true }),
  ]);

  if (bookmarkResult.error || likeResult.error || commentsResult.error) {
    return NextResponse.json({ ok: false, message: "CampusPress could not load article engagement." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    article: {
      id: article.id,
      authorId: article.author_id,
    },
    counts: {
      bookmarks: bookmarkResult.count ?? 0,
      likes: likeResult.count ?? 0,
    },
    comments: (commentsResult.data ?? []) as CommentRow[],
  });
}
