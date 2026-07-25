import { NextResponse } from "next/server";
import { authenticateAnalysisRequest, canViewAnalysis } from "@/lib/analysis/auth";
import { loadEditorReviewQueue } from "@/lib/editor-review";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { profile } = await authenticateAnalysisRequest(request);
  if (!profile || !canViewAnalysis(profile)) {
    return NextResponse.json(
      { ok: false, message: "Only editors and administrators can open the editorial review queue." },
      { status: 403 },
    );
  }

  const payload = await loadEditorReviewQueue(createServiceSupabaseClient());
  return NextResponse.json({ ok: true, ...payload });
}
