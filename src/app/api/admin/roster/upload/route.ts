import { NextResponse } from "next/server";

import { authenticateAdminRequest, ingestRosterCsv } from "@/lib/admin";
import { isRosterDataKind } from "@/lib/roster-csv";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const type = new URL(request.url).searchParams.get("type");
  const dataKind = isRosterDataKind(type) ? type : null;
  if (!dataKind) {
    return NextResponse.json({ ok: false, message: "Choose Student data or Staff data before uploading a roster CSV." }, { status: 400 });
  }

  const csv = await request.text();
  try {
    const result = await ingestRosterCsv(createServiceSupabaseClient(), profile.id, csv, dataKind);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not upload that roster CSV." },
      { status: 400 },
    );
  }
}
