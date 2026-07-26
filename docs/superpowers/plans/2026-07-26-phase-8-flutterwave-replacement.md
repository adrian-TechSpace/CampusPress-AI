# Phase 8 Flutterwave Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 8 Paystack payment scaffolding with Flutterwave Standard Checkout, including transaction initialization, server-side verification, webhook handling, production deployment, and live test-mode evidence.

**Architecture:** CampusPress creates a pending payment row, requests a Flutterwave hosted checkout link server-side, redirects the admin test user to Flutterwave, and verifies the returned transaction ID before updating `payments` and `subscriptions`. Webhooks are accepted only when the `verif-hash` header matches `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, then the event is re-verified with Flutterwave before value is granted.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Supabase service client, Flutterwave v3 Standard Checkout API, Playwright verification.

## Global Constraints

- Use Flutterwave Standard Checkout, not direct in-app card charge.
- Keep `FLUTTERWAVE_SECRET_KEY` server-side only.
- `FLUTTERWAVE_PUBLIC_KEY` may be reported as configured, but initialization still happens server-side.
- Do not use `FLUTTERWAVE_ENCRYPTION_KEY` for Standard Checkout.
- Webhook signature validation compares `verif-hash` directly to `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.
- Replace Paystack, do not add Flutterwave beside it.
- No emojis.
- No em dashes in generated code, UI copy, comments, or commit messages.

---

### Task 1: Verification Harness Red Step

**Files:**
- Modify: `scripts/verify-phase8-static.mjs`
- Modify: `scripts/phase8-admin-e2e-check.mjs`

**Interfaces:**
- Consumes: current Phase 8 Paystack implementation.
- Produces: failing assertions that require Flutterwave files, routes, route copy, provider rows, and `verif-hash` webhook validation.

- [ ] Replace required Paystack file paths with Flutterwave file paths.
- [ ] Assert `src/lib/flutterwave.ts` references `https://api.flutterwave.com/v3/payments`.
- [ ] Assert transaction verification uses `/v3/transactions/`.
- [ ] Assert webhook route reads `verif-hash`.
- [ ] Assert dashboard copy contains Flutterwave and does not contain Paystack.
- [ ] Update the e2e payment check to click `Run Flutterwave test transaction`, inspect a `flutterwave` provider payment, and expect a succeeded subscription after callback or verified webhook processing.
- [ ] Run `node scripts\verify-phase8-static.mjs` and confirm it fails on missing Flutterwave implementation.

### Task 2: Flutterwave Server Helpers

**Files:**
- Delete: `src/lib/paystack.ts`
- Create: `src/lib/flutterwave.ts`

**Interfaces:**
- Produces: `initializeFlutterwaveTestPayment(supabase, user, origin, amountKobo)`, `verifyFlutterwaveTransaction(supabase, transactionId, txRef)`, `applyFlutterwaveChargeSuccess(supabase, charge)`, `applyFlutterwaveWebhookEvent(supabase, payload)`, `validateFlutterwaveWebhookSignature(signature)`.
- Consumes: `payments`, `subscriptions`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.

- [ ] Create pending `payments` rows with `provider: "flutterwave"` and a unique `tx_ref`.
- [ ] Initialize Standard Checkout via `POST https://api.flutterwave.com/v3/payments`.
- [ ] Use callback URL `/api/flutterwave/callback`.
- [ ] Verify via `GET https://api.flutterwave.com/v3/transactions/{id}/verify`.
- [ ] Accept only `status: "successful"` and matching `tx_ref`, amount, and currency.
- [ ] Upsert an active `subscriptions` row with `provider: "flutterwave"`.
- [ ] Update the matching payment to `status: "succeeded"` and link the subscription.
- [ ] Keep webhook processing idempotent by reusing the same payment reference and update path.

### Task 3: Route Replacement

**Files:**
- Delete: `src/app/api/admin/paystack/initialize/route.ts`
- Delete: `src/app/api/paystack/callback/route.ts`
- Delete: `src/app/api/paystack/webhook/route.ts`
- Create: `src/app/api/admin/flutterwave/initialize/route.ts`
- Create: `src/app/api/flutterwave/callback/route.ts`
- Create: `src/app/api/flutterwave/webhook/route.ts`

**Interfaces:**
- Consumes: Flutterwave helper functions from Task 2.
- Produces: admin-only initialization, public callback verification, and signed webhook handling.

- [ ] Wire admin-only initialization with `authenticateAdminRequest`.
- [ ] Return JSON containing `authorizationUrl`, `reference`, and `paymentId`.
- [ ] Verify callback query params `transaction_id`, `tx_ref`, and `status`.
- [ ] Return a plain HTML success or failure page after callback verification.
- [ ] Reject webhooks without a matching `verif-hash`.
- [ ] Parse webhook JSON and re-verify successful charge events before updating database rows.

### Task 4: Admin Dashboard Replacement

**Files:**
- Modify: `src/lib/admin.ts`
- Modify: `src/components/admin/admin-dashboard-client.tsx`

**Interfaces:**
- Consumes: new Flutterwave route paths and overview field.
- Produces: Flutterwave-only monetisation panel.

- [ ] Rename `paystackConfigured` to `flutterwaveConfigured`.
- [ ] Report configuration from `FLUTTERWAVE_SECRET_KEY` and `FLUTTERWAVE_PUBLIC_KEY`.
- [ ] Rename `runPaystackTest()` to `runFlutterwaveTest()`.
- [ ] Post to `/api/admin/flutterwave/initialize`.
- [ ] Remove local fallback copy and behavior.
- [ ] Update visible copy, button labels, and badge text to Flutterwave.

### Task 5: Master Build And Phase Records

**Files:**
- Modify: `CAMPUSPRESS_MASTER_BUILD.md`
- Modify: `docs/superpowers/plans/2026-07-26-phase-8-admin-moderation-monetisation.md`

**Interfaces:**
- Produces: accurate project record stating Flutterwave, not Paystack.

- [ ] Replace Phase 8 Paystack references with Flutterwave test-mode Standard Checkout.
- [ ] Replace Phase 10 Paystack webhook failure reference with Flutterwave webhook failure.
- [ ] Update the previous Phase 8 implementation plan record so it no longer names Paystack as the active integration.

### Task 6: Verification, Deploy, And Live Evidence

**Files:**
- Modify as needed: `scripts/phase8-admin-e2e-check.mjs`
- Modify as needed: `scripts/verify-phase8-static.mjs`

**Interfaces:**
- Consumes: local env, Vercel production env, Flutterwave dashboard webhook configuration.
- Produces: PASS/FAIL evidence for Phase 8.

- [ ] Run `node scripts\verify-phase8-static.mjs`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Set Vercel Production environment variables for Flutterwave public key, secret key, and webhook secret hash.
- [ ] Deploy production.
- [ ] Run Phase 8 e2e against `https://campuspress-ai.vercel.app`.
- [ ] Complete the real Flutterwave test checkout if the hosted page is automatable.
- [ ] Confirm `payments.provider = "flutterwave"` and `payments.status = "succeeded"`.
- [ ] Confirm `subscriptions.provider = "flutterwave"` and `subscriptions.status = "active"`.
- [ ] Confirm webhook rejects an incorrect `verif-hash`.
- [ ] Confirm webhook accepts the configured `verif-hash`.
- [ ] Inspect production screenshots.
- [ ] Commit, push, and report the final Phase 8 PASS/FAIL table.
