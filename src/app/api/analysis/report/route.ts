import { NextResponse } from "next/server";
import { authenticateAnalysisRequest, canViewAnalysis } from "@/lib/analysis/auth";
import { loadAnalysisReport } from "@/lib/analysis/orchestrator";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get("articleId");

  if (!articleId) {
    return NextResponse.json({ ok: false, message: "Choose an article before opening an analysis report." }, { status: 400 });
  }

  const { profile } = await authenticateAnalysisRequest(request);
  if (!canViewAnalysis(profile)) {
    return NextResponse.json({ ok: false, message: "Only editors and administrators can view full AI analysis reports." }, { status: 403 });
  }

  const report = await loadAnalysisReport(articleId);
  if (!report) {
    return NextResponse.json({ ok: false, message: "No analysis report was found for that article." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
