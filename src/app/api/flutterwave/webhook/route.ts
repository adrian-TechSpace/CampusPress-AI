import { NextResponse } from "next/server";

import { applyFlutterwaveWebhookEvent, validateFlutterwaveWebhookSignature } from "@/lib/flutterwave";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("verif-hash");

  if (!validateFlutterwaveWebhookSignature(signature)) {
    return NextResponse.json({ ok: false, message: "Invalid Flutterwave signature." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Parameters<typeof applyFlutterwaveWebhookEvent>[1];
  const result = await applyFlutterwaveWebhookEvent(createServiceSupabaseClient(), payload);
  return NextResponse.json({ ok: true, ...result });
}
