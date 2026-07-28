import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync("src/lib/flutterwave.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const commonJsModule = { exports: {} };
new Script(compiled, { filename: "src/lib/flutterwave.ts" }).runInNewContext({
  exports: commonJsModule.exports,
  module: commonJsModule,
  process,
  require,
});

const { applyFlutterwaveChargeSuccess } = commonJsModule.exports;

const calls = {
  subscriptionUpserts: 0,
  paymentUpdates: 0,
};

const existingPayment = {
  id: "payment-1",
  user_id: "user-1",
  amount_kobo: 150000,
  currency: "NGN",
  status: "succeeded",
  subscription_id: "subscription-1",
};

const supabase = {
  from(table) {
    if (table === "payments") {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            single: async () => ({ data: existingPayment, error: null }),
          };
        },
        update() {
          calls.paymentUpdates += 1;
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({ data: { id: existingPayment.id, status: "succeeded" }, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    }

    if (table === "subscriptions") {
      return {
        upsert() {
          calls.subscriptionUpserts += 1;
          return {
            select() {
              return {
                single: async () => ({ data: { id: "subscription-2" }, error: null }),
              };
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  },
};

const result = await applyFlutterwaveChargeSuccess(supabase, {
  id: 10395424,
  reference: "campuspress-phase8-1785069452453-mrpzaa",
  status: "successful",
  amountKobo: 150000,
  currency: "NGN",
  paidAt: "2026-07-26T12:38:24.000Z",
  metadata: {
    payment_id: "payment-1",
    user_id: "user-1",
    phase: "8",
  },
});

assert.equal(result.paymentId, "payment-1");
assert.equal(result.status, "succeeded");
assert.equal(result.subscriptionId, "subscription-1");
assert.equal(result.message, "Flutterwave test payment already completed.");
assert.equal(calls.subscriptionUpserts, 0, "Duplicate success processing must not upsert subscriptions again.");
assert.equal(calls.paymentUpdates, 0, "Duplicate success processing must not update payments again.");

console.log(
  JSON.stringify(
    {
      phase8FlutterwaveIdempotence: true,
      duplicateSubscriptionUpserts: calls.subscriptionUpserts,
      duplicatePaymentUpdates: calls.paymentUpdates,
    },
    null,
    2,
  ),
);
