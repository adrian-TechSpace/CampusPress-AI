import type { SupabaseClient } from "@supabase/supabase-js";

export type FlutterwaveInitResult = {
  reference: string;
  authorizationUrl: string;
  paymentId: string;
};

type FlutterwaveVerifyResult = {
  id: number;
  reference: string;
  status: string;
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  metadata: Record<string, unknown>;
};

type FlutterwaveWebhookPayload = {
  event?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    charged_amount?: number;
    created_at?: string | null;
    meta?: Record<string, unknown>;
  };
};

const flutterwaveApiBase = "https://api.flutterwave.com/v3";

export async function initializeFlutterwaveTestPayment(
  supabase: SupabaseClient,
  user: { id: string; email: string; fullName?: string },
  origin: string,
  amountKobo = 150000,
): Promise<FlutterwaveInitResult> {
  const reference = `campuspress-phase8-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      provider: "flutterwave",
      provider_reference: reference,
      amount_kobo: amountKobo,
      currency: "NGN",
      status: "pending",
      metadata: { phase: 8, mode: "flutterwave-test" },
    })
    .select("id")
    .single();

  if (paymentError) {
    throw paymentError;
  }

  const secret = flutterwaveSecret();
  if (!secret) {
    throw new Error("Flutterwave secret key is not configured.");
  }

  const callbackUrl = `${origin}/api/flutterwave/callback`;
  const response = await fetch(`${flutterwaveApiBase}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount: amountKobo / 100,
      currency: "NGN",
      redirect_url: callbackUrl,
      customer: {
        email: user.email,
        name: user.fullName ?? user.email,
      },
      customizations: {
        title: "CampusPress AI",
        description: "CampusPress Phase 8 test subscription",
      },
      meta: {
        user_id: user.id,
        payment_id: payment.id,
        phase: 8,
      },
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };

  if (!response.ok || result.status !== "success" || !result.data?.link) {
    throw new Error(result.message ?? "Flutterwave could not initialize the test transaction.");
  }

  return {
    reference,
    authorizationUrl: result.data.link,
    paymentId: payment.id,
  };
}

export async function verifyFlutterwaveTransaction(
  supabase: SupabaseClient,
  transactionId: string,
  txRef: string,
): Promise<FlutterwaveVerifyResult> {
  const payment = await loadPaymentByReference(supabase, txRef);
  const secret = flutterwaveSecret();
  if (!secret) {
    throw new Error("Flutterwave secret key is not configured.");
  }

  const response = await fetch(`${flutterwaveApiBase}/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const result = (await response.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: {
      id?: number;
      tx_ref?: string;
      status?: string;
      amount?: number;
      charged_amount?: number;
      currency?: string;
      created_at?: string | null;
      meta?: Record<string, unknown>;
    };
  };

  if (!response.ok || result.status !== "success" || !result.data?.id || !result.data.tx_ref) {
    throw new Error(result.message ?? "Flutterwave could not verify that transaction.");
  }

  const amountKobo = Math.round(Number(result.data.amount ?? result.data.charged_amount ?? 0) * 100);
  return {
    id: result.data.id,
    reference: result.data.tx_ref,
    status: result.data.status ?? "failed",
    amountKobo,
    currency: result.data.currency ?? payment.currency,
    paidAt: result.data.created_at ?? null,
    metadata: result.data.meta ?? {},
  };
}

export async function applyFlutterwaveChargeSuccess(
  supabase: SupabaseClient,
  charge: FlutterwaveVerifyResult,
) {
  const payment = await loadPaymentByReference(supabase, charge.reference);
  if (charge.status !== "successful") {
    throw new Error("The Flutterwave transaction has not completed successfully.");
  }
  if (payment.amountKobo !== charge.amountKobo || payment.currency !== charge.currency) {
    throw new Error("The Flutterwave transaction amount does not match the pending CampusPress payment.");
  }
  if (payment.status === "succeeded" && payment.subscriptionId) {
    return {
      paymentId: payment.id,
      status: payment.status,
      subscriptionId: payment.subscriptionId,
      message: "Flutterwave test payment already completed.",
    };
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: payment.userId,
        provider: "flutterwave",
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
      metadata: { ...charge.metadata, flutterwave_transaction_id: charge.id, paid_at: charge.paidAt },
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
    message: "Flutterwave test payment completed and subscription updated.",
  };
}

export async function applyFlutterwaveWebhookEvent(supabase: SupabaseClient, payload: FlutterwaveWebhookPayload) {
  const transactionId = payload.data?.id ? String(payload.data.id) : "";
  const txRef = payload.data?.tx_ref ?? "";
  if (payload.event !== "charge.completed" || !transactionId || !txRef) {
    return { ignored: true, message: "Webhook event ignored." };
  }

  const charge = await verifyFlutterwaveTransaction(supabase, transactionId, txRef);
  const result = await applyFlutterwaveChargeSuccess(supabase, charge);
  return { ignored: false, ...result };
}

export function validateFlutterwaveWebhookSignature(signature: string | null) {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || "";
  return Boolean(secretHash && signature && signature === secretHash);
}

export function flutterwaveConfigured() {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY && process.env.FLUTTERWAVE_PUBLIC_KEY);
}

function flutterwaveSecret() {
  return process.env.FLUTTERWAVE_SECRET_KEY || "";
}

async function loadPaymentByReference(supabase: SupabaseClient, reference: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, user_id, subscription_id, amount_kobo, currency, status")
    .eq("provider", "flutterwave")
    .eq("provider_reference", reference)
    .single();

  if (error || !data) {
    throw new Error("CampusPress could not find the pending Flutterwave payment.");
  }

  return {
    id: data.id as string,
    userId: data.user_id as string,
    subscriptionId: data.subscription_id as string | null,
    amountKobo: Number(data.amount_kobo ?? 0),
    currency: String(data.currency ?? "NGN"),
    status: String(data.status ?? "pending"),
  };
}
