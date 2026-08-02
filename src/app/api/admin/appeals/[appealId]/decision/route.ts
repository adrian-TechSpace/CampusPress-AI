import { NextResponse } from "next/server";

import { authenticateAdminRequest, decideSuspensionAppeal } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteParams = Promise<{ appealId: string }>;

export async function POST(request: Request, { params }: { params: RouteParams }) {
  const { profile, message, status } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: status ?? 403 });
  }

  const { appealId } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    decision?: "accept" | "reject";
    decisionNote?: string;
  };

  if (!payload.decision || !["accept", "reject"].includes(payload.decision)) {
    return NextResponse.json({ ok: false, message: "Choose Accept or Reject for this appeal." }, { status: 400 });
  }

  try {
    const result = await decideSuspensionAppeal(
      createServiceSupabaseClient(),
      profile.id,
      appealId,
      payload.decision,
      payload.decisionNote ?? "",
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not decide that appeal." },
      { status: 400 },
    );
  }
}
