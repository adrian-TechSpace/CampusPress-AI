import { NextResponse } from "next/server";

import { authenticateAdminRequest } from "@/lib/admin";
import { initializePaystackTestPayment } from "@/lib/paystack";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, message } = await authenticateAdminRequest(request);
  if (!profile) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  try {
    const result = await initializePaystackTestPayment(
      createServiceSupabaseClient(),
      { id: profile.id, email: profile.email },
      origin,
    );
    return NextResponse.json({
      ok: true,
      message: result.simulated
        ? "Local Paystack test transaction initialized."
        : "Paystack test transaction initialized.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not initialize Paystack." },
      { status: 400 },
    );
  }
}
