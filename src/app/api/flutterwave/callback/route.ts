import { NextResponse } from "next/server";

import { applyFlutterwaveChargeSuccess, verifyFlutterwaveTransaction } from "@/lib/flutterwave";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const txRef = url.searchParams.get("tx_ref");
  const transactionId = url.searchParams.get("transaction_id");

  if (!txRef || !transactionId) {
    return new NextResponse("Missing Flutterwave transaction details.", { status: 400 });
  }

  if (status !== "successful") {
    return new NextResponse(
      `<main><h1>CampusPress payment not verified</h1><p>Flutterwave returned ${status ?? "an unknown status"}.</p></main>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    const supabase = createServiceSupabaseClient();
    const charge = await verifyFlutterwaveTransaction(supabase, transactionId, txRef);
    const result = await applyFlutterwaveChargeSuccess(supabase, charge);
    return new NextResponse(
      `<main><h1>CampusPress payment verified</h1><p>${result.message}</p><p>Reference: ${txRef}</p></main>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    return new NextResponse(
      `<main><h1>CampusPress payment not verified</h1><p>${error instanceof Error ? error.message : "Payment verification failed."}</p></main>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
