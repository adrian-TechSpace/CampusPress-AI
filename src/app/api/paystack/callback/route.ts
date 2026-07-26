import { NextResponse } from "next/server";

import { applyPaystackChargeSuccess, verifyPaystackReference } from "@/lib/paystack";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const simulated = url.searchParams.get("phase8_test") === "1";

  if (!reference) {
    return new NextResponse("Missing Paystack reference.", { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const charge = await verifyPaystackReference(supabase, reference, simulated);
    const result = await applyPaystackChargeSuccess(supabase, charge);
    return new NextResponse(
      `<main><h1>CampusPress payment verified</h1><p>${result.message}</p><p>Reference: ${reference}</p></main>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    return new NextResponse(
      `<main><h1>CampusPress payment not verified</h1><p>${error instanceof Error ? error.message : "Payment verification failed."}</p></main>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
