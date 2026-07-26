import { NextResponse } from "next/server";

import { authenticateAdminRequest, loadAdminOverview } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { profile, message } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  try {
    const overview = await loadAdminOverview(createServiceSupabaseClient());
    return NextResponse.json({ ok: true, overview });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not load the admin dashboard." },
      { status: 500 },
    );
  }
}
