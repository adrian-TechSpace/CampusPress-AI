import { NextResponse } from "next/server";

import { authenticateAdminRequest, setUserSuspension } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    userId?: string;
    suspended?: boolean;
    reason?: string;
  };

  if (!payload.userId || typeof payload.suspended !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "Choose a user and suspension action before saving." },
      { status: 400 },
    );
  }

  try {
    const result = await setUserSuspension(
      createServiceSupabaseClient(),
      profile.id,
      payload.userId,
      payload.suspended,
      payload.reason ?? "",
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not update that user." },
      { status: 400 },
    );
  }
}
