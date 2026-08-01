import { NextResponse } from "next/server";
import { authenticateAnalysisRequest } from "@/lib/analysis/auth";
import { runArticleAnalysis } from "@/lib/analysis/orchestrator";
import type { AnalysisArticle, AnalysisCheckKey } from "@/lib/analysis/types";
import { createEditorSubmissionNotifications } from "@/lib/submission-notifications";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId, profile } = await authenticateAnalysisRequest(request);
  if (!userId || !profile) {
    return NextResponse.json({ ok: false, message: "Sign in before requesting article analysis." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    articleId?: string;
    breakModel?: AnalysisCheckKey;
  };

  if (!payload.articleId) {
    return NextResponse.json({ ok: false, message: "Choose an article before requesting analysis." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: article, error } = await supabase
    .from("articles")
    .select("id, title, excerpt, plain_text, content, author_id, status")
    .eq("id", payload.articleId)
    .single();

  if (error || !article) {
    return NextResponse.json({ ok: false, message: "CampusPress could not find that article." }, { status: 404 });
  }

  const canRequest =
    article.author_id === userId || profile.role === "editor" || profile.role === "admin";

  if (!canRequest) {
    return NextResponse.json({ ok: false, message: "You cannot request analysis for this article." }, { status: 403 });
  }

  await createEditorSubmissionNotifications(supabase, article);

  const failureCheckAuthorized =
    Boolean(process.env.CRON_SECRET) &&
    request.headers.get("x-phase5-failure-check") === process.env.CRON_SECRET;

  const report = await runArticleAnalysis(
    {
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      plainText: article.plain_text,
      contentHtml: typeof article.content?.html === "string" ? article.content.html : "",
      authorId: article.author_id,
    } satisfies AnalysisArticle,
    {
      requestedBy: userId,
      breakModel: failureCheckAuthorized ? payload.breakModel : undefined,
    },
  );

  return NextResponse.json({
    ok: true,
    report,
    reportUrl: `/dashboard/editor/analysis/${article.id}`,
  });
}
