# Phase 8 Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 8 admin, moderation, roster upload, AI usage, and monetisation scaffolding surface for CampusPress AI.

**Architecture:** Keep the existing Supabase schema and RLS model, adding only suspension fields needed for admin user management. Admin browser UI calls narrow Next.js route handlers with the signed-in Supabase access token; those handlers authorize the profile as `admin` and use the service client for platform-wide mutations. Flutterwave integration is server-only and uses Standard Checkout in test mode.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui primitives, Lucide, Supabase, Playwright.

## Global Constraints

- Color: ONE neutral base plus ONE accent color max. No rainbow palettes.
- Spacing: use Tailwind default spacing scale only.
- No emojis anywhere in code, UI copy, comments, or commit messages.
- No em dashes in generated text or copy.
- Roster CSV upload must retroactively verify matching profiles.
- Flutterwave secret keys must never be exposed to the frontend.
- Verify UI changes from `next start`, not the dev server.

---

### Task 1: Phase 8 Schema Support

**Files:**
- Create: `supabase/migrations/202607260001_phase_8_admin_scaffolding.sql`
- Modify: `scripts/verify-schema.mjs`

**Interfaces:**
- Produces: `profiles.suspended_at timestamptz`, `profiles.suspension_reason text`, and `public.is_suspended(profile_id uuid)`.
- Consumes: existing `profiles`, `articles`, `comments`, `payments`, `subscriptions`, `ai_usage_log`, and `institution_roster`.

- [ ] Add the migration with `alter table public.profiles add column if not exists suspended_at timestamptz;`.
- [ ] Add `alter table public.profiles add column if not exists suspension_reason text;`.
- [ ] Add a stable `public.is_suspended(profile_id uuid)` function that returns true when `suspended_at is not null`.
- [ ] Add indexes for admin screens: `profiles(role, suspended_at)`, `comments(is_hidden, created_at desc)`, `payments(status, created_at desc)`, and `ai_usage_log(created_at desc)`.
- [ ] Extend `scripts/verify-schema.mjs` to assert the new profile columns and suspension helper exist.
- [ ] Run `node scripts/verify-schema.mjs` and expect it to pass.

### Task 2: Admin Server Library

**Files:**
- Create: `src/lib/admin.ts`
- Create: `src/lib/flutterwave.ts`

**Interfaces:**
- Produces: `authenticateAdminRequest(request)`, `loadAdminOverview()`, `setUserSuspension()`, `moderateArticle()`, `moderateComment()`, `ingestRosterCsv()`, `initializeFlutterwaveTestPayment()`, `verifyFlutterwaveTransaction()`, `applyFlutterwaveChargeSuccess()`.
- Consumes: `createServiceSupabaseClient()`, authenticated bearer tokens, Flutterwave docs for Standard Checkout, transaction verification, and webhook `verif-hash` signatures.

- [ ] Implement `authenticateAdminRequest(request)` by validating the bearer token with the anon key, loading the matching profile, and requiring `role === "admin"`.
- [ ] Implement `loadAdminOverview()` to return users, moderation items, AI usage totals, payment rows, subscription rows, roster import history, and dashboard metrics.
- [ ] Implement `setUserSuspension(userId, suspended, reason, actorId)` to update `profiles.suspended_at` and `profiles.suspension_reason`, then insert an `audit_log` row.
- [ ] Implement `moderateArticle(articleId, action, actorId)` supporting `publish`, `hide`, and `restore` through existing article statuses.
- [ ] Implement `moderateComment(commentId, hidden, actorId)` through `comments.is_hidden`.
- [ ] Implement `ingestRosterCsv(csv, actorId)` with required headers `department_code`, `matric_or_staff_id`, `full_name`, and `role`, strict row validation, upsert into `institution_roster`, and return inserted/updated/matched counts.
- [ ] Implement Flutterwave helpers using `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, and `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.

### Task 3: Admin API Routes

**Files:**
- Create: `src/app/api/admin/overview/route.ts`
- Create: `src/app/api/admin/users/suspension/route.ts`
- Create: `src/app/api/admin/moderation/route.ts`
- Create: `src/app/api/admin/roster/upload/route.ts`
- Create: `src/app/api/admin/flutterwave/initialize/route.ts`
- Create: `src/app/api/flutterwave/callback/route.ts`
- Create: `src/app/api/flutterwave/webhook/route.ts`

**Interfaces:**
- Consumes: library functions from Task 2.
- Produces: JSON responses with `{ ok: boolean, message: string }` plus route-specific data.

- [ ] Add `GET /api/admin/overview` for the dashboard initial load.
- [ ] Add `POST /api/admin/users/suspension` with `userId`, `suspended`, and `reason`.
- [ ] Add `POST /api/admin/moderation` with `targetType`, `targetId`, and action fields.
- [ ] Add `POST /api/admin/roster/upload` accepting `text/csv` request bodies.
- [ ] Add `POST /api/admin/flutterwave/initialize` for an admin-triggered test transaction.
- [ ] Add `GET /api/flutterwave/callback?status=successful&tx_ref=...&transaction_id=...` that verifies and updates payment/subscription state, then returns a plain result page.
- [ ] Add `POST /api/flutterwave/webhook` that validates `verif-hash` and processes `charge.completed`.

### Task 4: Admin Dashboard UI

**Files:**
- Create: `src/components/admin/admin-dashboard-client.tsx`
- Modify: `src/app/dashboard/[role]/page.tsx`

**Interfaces:**
- Consumes: admin API routes from Task 3.
- Produces: a rendered admin dashboard at `/dashboard/admin`.

- [ ] Render metrics for total users, suspended users, pending moderation, roster matches, AI cost, and payments.
- [ ] Render user management rows with role, verified state, suspension state, and suspend/restore actions.
- [ ] Render content moderation rows for submitted/revision articles and visible/hidden comments needing review.
- [ ] Render AI usage summary grouped by provider and latest usage entries.
- [ ] Render roster CSV upload as a textarea plus file input, with sample CSV copy and parsed result counts.
- [ ] Render monetisation panel with Flutterwave test-mode status, recent payments, subscriptions, and a test transaction button.

### Task 5: Verification Scripts

**Files:**
- Create: `scripts/verify-phase8-static.mjs`
- Create: `scripts/phase8-admin-e2e-check.mjs`

**Interfaces:**
- Consumes: app running under production `next start`, Supabase env vars, and Phase 8 routes.
- Produces: JSON proof and screenshots under `C:/tmp/campuspress-phase8-admin`.

- [ ] Static script asserts admin API files, dashboard UI, roster parser, suspension schema, Flutterwave signature validation, and callback routes exist.
- [ ] E2E script creates an admin, target journalist, reader, article, comment, usage row, payment row, and roster CSV body.
- [ ] E2E signs in as admin, loads `/dashboard/admin`, uploads roster CSV, confirms matching profile is verified, suspends/restores a user, hides/restores content, runs test payment flow, and captures desktop/mobile screenshots.
- [ ] Run `node scripts/verify-phase8-static.mjs`.
- [ ] Run `node --env-file=.env.local scripts/phase8-admin-e2e-check.mjs` against `PHASE8_APP_URL=http://127.0.0.1:3000`.
- [ ] Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
