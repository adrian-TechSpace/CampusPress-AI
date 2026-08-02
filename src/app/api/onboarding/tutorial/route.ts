import { NextResponse } from "next/server";

import { authenticateActiveRequest } from "@/lib/account-enforcement";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type TutorialAction = "finish" | "skip" | "remind_later";

type TutorialRequest = {
  action?: TutorialAction;
  role?: string;
};

const tutorialRoles = new Set(["reader", "journalist", "editor", "admin", "subadmin"]);

export async function POST(request: Request) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as TutorialRequest;
  const role = body.role === "subadmin" ? "admin" : body.role;
  if (!body.action || !role || !tutorialRoles.has(body.role ?? "")) {
    return NextResponse.json({ ok: false, message: "Choose a valid tutorial action." }, { status: 400 });
  }

  if (!canUpdateTutorial(auth.profile.role, body.role)) {
    return NextResponse.json({ ok: false, message: "This tutorial belongs to another role." }, { status: 403 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", auth.profile.id)
    .single();

  if (profileError) {
    return NextResponse.json({ ok: false, message: "CampusPress could not load tutorial settings." }, { status: 500 });
  }

  const preferences = objectValue(profile?.preferences);
  const tutorial = objectValue(preferences.tutorial);
  const dismissed = objectValue(tutorial.dismissed);
  const remindLater = objectValue(tutorial.remindLater);
  const now = new Date().toISOString();

  if (body.action === "skip" || body.action === "finish") {
    dismissed[role] = true;
    remindLater[role] = null;
  } else {
    dismissed[role] = false;
    remindLater[role] = now;
  }

  const nextPreferences = {
    ...preferences,
    tutorial: {
      ...tutorial,
      dismissed,
      remindLater,
      updatedAt: now,
    },
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ preferences: nextPreferences })
    .eq("id", auth.profile.id);

  if (updateError) {
    return NextResponse.json({ ok: false, message: "CampusPress could not save tutorial settings." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dismissed: Boolean(dismissed[role]) });
}

function canUpdateTutorial(actualRole: string, requestedRole: string | undefined) {
  if (!requestedRole) {
    return false;
  }

  if (actualRole === "subadmin" && requestedRole === "subadmin") {
    return true;
  }

  return actualRole === requestedRole;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}
