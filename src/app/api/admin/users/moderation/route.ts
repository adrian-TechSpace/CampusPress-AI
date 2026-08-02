import { NextResponse } from "next/server";

import {
  authenticateAdminRequest,
  banUserAccount,
  restoreUserAccount,
  suspendUserAccount,
  warnUserAccount,
} from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message, status } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: status ?? 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    userId?: string;
    action?: "warn" | "suspend" | "ban" | "restore";
    durationHours?: number;
    reasonCode?: string;
    reason?: string;
  };

  if (!payload.userId || !payload.action) {
    return NextResponse.json({ ok: false, message: "Choose a user and moderation action." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  try {
    if (payload.action === "warn") {
      const result = await warnUserAccount(supabase, profile.id, payload.userId, payload.reason ?? "");
      return NextResponse.json({ ok: true, ...result });
    }

    if (payload.action === "suspend") {
      const result = await suspendUserAccount(supabase, profile.id, payload.userId, {
        durationHours: payload.durationHours ?? 24,
        reasonCode: payload.reasonCode ?? "other",
        reason: payload.reason ?? "",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (payload.action === "ban") {
      const result = await banUserAccount(supabase, profile.id, payload.userId, payload.reason ?? "");
      return NextResponse.json({ ok: true, ...result });
    }

    if (payload.action === "restore") {
      const result = await restoreUserAccount(supabase, profile.id, payload.userId, payload.reason);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, message: "Choose Warn, Suspend, Ban, or Restore." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not update that user." },
      { status: 400 },
    );
  }
}
