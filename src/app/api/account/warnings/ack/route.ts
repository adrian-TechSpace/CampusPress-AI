import { NextResponse } from "next/server";

import { authenticateActiveRequest } from "@/lib/account-enforcement";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message, account: auth.account }, { status: auth.status });
  }

  const { error } = await createServiceSupabaseClient()
    .from("profiles")
    .update({
      account_status: "active",
      warning_acknowledged_at: new Date().toISOString(),
    })
    .eq("id", auth.userId);

  if (error) {
    return NextResponse.json({ ok: false, message: "CampusPress could not dismiss that warning." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Warning dismissed." });
}
