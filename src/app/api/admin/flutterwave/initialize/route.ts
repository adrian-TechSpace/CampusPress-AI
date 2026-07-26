import { NextResponse } from "next/server";

import { authenticateAdminRequest } from "@/lib/admin";
import { initializeFlutterwaveTestPayment } from "@/lib/flutterwave";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  try {
    const result = await initializeFlutterwaveTestPayment(
      createServiceSupabaseClient(),
      { id: profile.id, email: profile.email, fullName: profile.full_name },
      origin,
    );
    return NextResponse.json({
      ok: true,
      message: "Flutterwave test transaction initialized.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not initialize Flutterwave." },
      { status: 400 },
    );
  }
}
