import { NextResponse } from "next/server";

import { authenticateAdminRequest, moderateArticle, moderateComment } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const articleActions = new Set(["publish", "hide", "restore"]);

export async function POST(request: Request) {
  const { profile, message } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    targetType?: string;
    targetId?: string;
    action?: string;
    hidden?: boolean;
  };

  if (!payload.targetType || !payload.targetId) {
    return NextResponse.json(
      { ok: false, message: "Choose content and a moderation action before saving." },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();
  try {
    if (payload.targetType === "article") {
      if (!payload.action || !articleActions.has(payload.action)) {
        return NextResponse.json({ ok: false, message: "Choose a valid article moderation action." }, { status: 400 });
      }
      const result = await moderateArticle(
        supabase,
        profile.id,
        payload.targetId,
        payload.action as "publish" | "hide" | "restore",
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (payload.targetType === "comment") {
      if (typeof payload.hidden !== "boolean") {
        return NextResponse.json({ ok: false, message: "Choose whether this comment should be hidden." }, { status: 400 });
      }
      const result = await moderateComment(supabase, profile.id, payload.targetId, payload.hidden);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, message: "Unsupported moderation target." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not save that moderation action." },
      { status: 400 },
    );
  }
}
