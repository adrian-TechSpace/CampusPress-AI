import { NextResponse } from "next/server";

import { applyPaystackWebhookEvent, validatePaystackSignature } from "@/lib/paystack";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!validatePaystackSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, message: "Invalid Paystack signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Parameters<typeof applyPaystackWebhookEvent>[1];
  const result = await applyPaystackWebhookEvent(createServiceSupabaseClient(), payload);
  return NextResponse.json({ ok: true, ...result });
}
