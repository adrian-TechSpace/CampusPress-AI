import { NextResponse } from "next/server";

import { authenticateActiveRequest } from "@/lib/account-enforcement";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message, account: auth.account }, { status: auth.status });
  }

  if (!["editor", "admin", "subadmin"].includes(auth.profile.role)) {
    return NextResponse.json(
      { ok: false, message: "This onboarding flow is only for invited editor and admin accounts." },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as {
    orientation?: Record<string, unknown>;
  };
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", auth.userId)
    .single();
  const preferences =
    profile?.preferences && typeof profile.preferences === "object" && !Array.isArray(profile.preferences)
      ? (profile.preferences as Record<string, unknown>)
      : {};

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: now,
      preferences: {
        ...preferences,
        onboarding_complete: true,
        orientation: payload.orientation ?? {},
      },
    })
    .eq("id", auth.userId);

  if (profileError) {
    return NextResponse.json({ ok: false, message: "CampusPress could not finish onboarding." }, { status: 400 });
  }

  await supabase
    .from("account_invitations")
    .update({
      status: "accepted",
      accepted_at: now,
      onboarding_completed_at: now,
      orientation: payload.orientation ?? {},
    })
    .eq("auth_user_id", auth.userId);

  return NextResponse.json({
    ok: true,
    message: "Onboarding complete.",
    destination: auth.profile.role === "editor" ? "/dashboard/editor" : "/dashboard/admin",
  });
}
