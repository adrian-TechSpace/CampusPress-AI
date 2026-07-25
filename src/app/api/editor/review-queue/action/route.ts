import { NextResponse } from "next/server";
import { authenticateAnalysisRequest, canViewAnalysis } from "@/lib/analysis/auth";
import { applyEditorReviewAction, type ReviewDecision } from "@/lib/editor-review";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const validActions = new Set<ReviewDecision>(["approve", "reject", "request_revision"]);

export async function POST(request: Request) {
  const { profile } = await authenticateAnalysisRequest(request);
  if (!profile || !canViewAnalysis(profile)) {
    return NextResponse.json(
      { ok: false, message: "Only editors and administrators can make editorial decisions." },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as {
    articleId?: string;
    action?: ReviewDecision;
    note?: string;
  };

  if (!payload.articleId || !payload.action || !validActions.has(payload.action)) {
    return NextResponse.json(
      { ok: false, message: "Choose a submission and decision before sending an update." },
      { status: 400 },
    );
  }

  try {
    const result = await applyEditorReviewAction(
      createServiceSupabaseClient(),
      profile.id,
      payload.articleId,
      payload.action,
      payload.note ?? "",
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "CampusPress could not save that editorial decision.",
      },
      { status: 400 },
    );
  }
}
