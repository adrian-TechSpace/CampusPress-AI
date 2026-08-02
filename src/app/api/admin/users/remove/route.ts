import { NextResponse } from "next/server";

import { authenticateAdminRequest, removeAdminAccount } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message, status } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: status ?? 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as { userId?: string };
  if (!payload.userId) {
    return NextResponse.json({ ok: false, message: "Choose an admin account to remove." }, { status: 400 });
  }

  try {
    const result = await removeAdminAccount(createServiceSupabaseClient(), profile, payload.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not remove that account." },
      { status: 400 },
    );
  }
}
