import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaystackInitResult = {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  simulated: boolean;
  paymentId: string;
};

type PaystackVerifyResult = {
  reference: string;
  status: string;
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  metadata: Record<string, unknown>;
};

type PaystackChargePayload = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    metadata?: Record<string, unknown>;
  };
};

export async function initializePaystackTestPayment(
  supabase: SupabaseClient,
  user: { id: string; email: string },
  origin: string,
  amountKobo = 150000,
): Promise<PaystackInitResult> {
  const reference = `campuspress-phase8-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      provider: "paystack",
      provider_reference: reference,
      amount_kobo: amountKobo,
      currency: "NGN",
      status: "pending",
      metadata: { phase: 8, mode: paystackSecret() ? "paystack-test" : "local-test" },
    })
    .select("id")
    .single();

  if (paymentError) {
    throw paymentError;
  }

  const callbackUrl = `${origin}/api/paystack/callback?reference=${encodeURIComponent(reference)}`;
  const secret = paystackSecret();
  if (!secret) {
    return {
      reference,
      authorizationUrl: `${callbackUrl}&phase8_test=1`,
      accessCode: `local_${reference}`,
      simulated: true,
      paymentId: payment.id,
    };
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: String(amountKobo),
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
      metadata: { user_id: user.id, phase: 8 },
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };

  if (!response.ok || !result.status || !result.data?.authorization_url || !result.data.access_code) {
    throw new Error(result.message ?? "Paystack could not initialize the test transaction.");
  }

  return {
    reference: result.data.reference ?? reference,
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    simulated: false,
    paymentId: payment.id,
  };
}

export async function verifyPaystackReference(
  supabase: SupabaseClient,
  reference: string,
  simulated: boolean,
): Promise<PaystackVerifyResult> {
  const payment = await loadPaymentByReference(supabase, reference);
  if (simulated || !paystackSecret()) {
    return {
      reference,
      status: "success",
      amountKobo: payment.amountKobo,
      currency: payment.currency,
      paidAt: new Date().toISOString(),
      metadata: { phase: 8, simulated: true },
    };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret()}` },
  });
  const result = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      paid_at?: string | null;
      metadata?: Record<string, unknown>;
    };
  };

  if (!response.ok || !result.status || !result.data?.reference) {
    throw new Error(result.message ?? "Paystack could not verify that transaction.");
  }

  return {
    reference: result.data.reference,
    status: result.data.status ?? "failed",
    amountKobo: Number(result.data.amount ?? 0),
    currency: result.data.currency ?? "NGN",
    paidAt: result.data.paid_at ?? null,
    metadata: result.data.metadata ?? {},
  };
}

export async function applyPaystackChargeSuccess(
  supabase: SupabaseClient,
  charge: PaystackVerifyResult,
) {
  const payment = await loadPaymentByReference(supabase, charge.reference);
  if (charge.status !== "success") {
    throw new Error("The Paystack transaction has not completed successfully.");
  }
  if (payment.amountKobo !== charge.amountKobo || payment.currency !== charge.currency) {
    throw new Error("The Paystack transaction amount does not match the pending CampusPress payment.");
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: payment.userId,
        provider: "paystack",
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .single();

  if (subscriptionError) {
    throw subscriptionError;
  }

  const { data: updated, error: paymentError } = await supabase
    .from("payments")
    .update({
      subscription_id: subscription.id,
      status: "succeeded",
      metadata: { ...charge.metadata, paid_at: charge.paidAt },
    })
    .eq("provider_reference", charge.reference)
    .select("id, status")
    .single();

  if (paymentError) {
    throw paymentError;
  }

  return {
    paymentId: updated.id,
    status: updated.status,
    subscriptionId: subscription.id,
    message: "Paystack test payment completed and subscription updated.",
  };
}

export async function applyPaystackWebhookEvent(supabase: SupabaseClient, payload: PaystackChargePayload) {
  if (payload.event !== "charge.success" || !payload.data?.reference) {
    return { ignored: true, message: "Webhook event ignored." };
  }

  const charge: PaystackVerifyResult = {
    reference: payload.data.reference,
    status: payload.data.status ?? "failed",
    amountKobo: Number(payload.data.amount ?? 0),
    currency: payload.data.currency ?? "NGN",
    paidAt: payload.data.paid_at ?? null,
    metadata: payload.data.metadata ?? {},
  };
  const result = await applyPaystackChargeSuccess(supabase, charge);
  return { ignored: false, ...result };
}

export function validatePaystackSignature(rawBody: string, signature: string | null) {
  const secret = paystackSecret();
  if (!secret || !signature) {
    return false;
  }

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY || "";
}

async function loadPaymentByReference(supabase: SupabaseClient, reference: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, user_id, amount_kobo, currency")
    .eq("provider_reference", reference)
    .single();

  if (error || !data) {
    throw new Error("CampusPress could not find the pending Paystack payment.");
  }

  return {
    id: data.id as string,
    userId: data.user_id as string,
    amountKobo: Number(data.amount_kobo ?? 0),
    currency: String(data.currency ?? "NGN"),
  };
}
