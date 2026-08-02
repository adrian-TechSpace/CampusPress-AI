import { NextResponse } from "next/server";

import { authenticateAdminRequest, inviteAdminTierAccount } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message, status } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: status ?? 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    email?: string;
    fullName?: string;
    role?: "editor" | "admin" | "subadmin";
  };

  if (!payload.email || !payload.fullName || !payload.role) {
    return NextResponse.json({ ok: false, message: "Enter a name, email, and invite role." }, { status: 400 });
  }

  try {
    const exposeInviteUrl =
      Boolean(process.env.CRON_SECRET) &&
      request.headers.get("x-track2-proof") === process.env.CRON_SECRET;
    const result = await inviteAdminTierAccount(createServiceSupabaseClient(), profile, {
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      origin: new URL(request.url).origin,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      inviteUrl: exposeInviteUrl ? result.proofInviteUrl : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not create that invite." },
      { status: 400 },
    );
  }
}
