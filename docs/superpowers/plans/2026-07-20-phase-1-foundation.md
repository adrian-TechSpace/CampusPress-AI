# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CampusPress AI foundation: database schema, RLS, roster verification job, theme tokens, fonts, theme provider, and base components.

**Architecture:** Supabase owns persistence, RLS, and database-side verification triggers. The Next.js app owns design tokens, theme persistence, base components, and a small foundation preview screen for light and dark verification. Tests are plain Node verification scripts plus live Supabase API checks using two real Auth users.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Supabase CLI, Supabase Auth, Supabase Edge Functions, React 19.

## Global Constraints

- `AGENTS.md`, `SKILL.md`, and `CAMPUSPRESS_MASTER_BUILD.md` are binding.
- No secrets printed or committed.
- No emoji and no em dash in generated code, UI copy, comments, or commit messages.
- Marketing and reading surfaces may use premium editorial treatment. Working and data surfaces stay restrained.
- Colors must be one neutral base plus Chrisland purple, with gold only for special verification or achievement moments.
- Run lint, typecheck, build, Playwright screenshots, hardcoded color grep, and RLS isolation tests before completion.

---

### Task 1: Schema Migration and RLS

**Files:**
- Create: `supabase/migrations/202607200001_phase_1_foundation.sql`
- Create: `scripts/verify-schema.mjs`

**Interfaces:**
- Produces: all Phase 1 tables, helper functions, triggers, indexes, and policies.
- Produces: `public.run_roster_cross_check(uuid)` for Edge Function and triggers.

- [ ] Write schema verification tests first in `scripts/verify-schema.mjs`.
- [ ] Run `node scripts/verify-schema.mjs` and confirm it fails because the migration does not exist.
- [ ] Add the migration with all Phase 1 tables and policies.
- [ ] Run the schema verification script and confirm it passes.

### Task 2: Edge Function

**Files:**
- Create: `supabase/functions/roster-cross-check/index.ts`
- Create: `supabase/functions/roster-cross-check/deno.json`
- Extend: `scripts/verify-schema.mjs`

**Interfaces:**
- Consumes: `public.run_roster_cross_check(uuid)`.
- Produces: deployed `roster-cross-check` Edge Function.

- [ ] Extend verification to require Edge Function files.
- [ ] Run verification and confirm it fails.
- [ ] Implement the Edge Function with service-role Supabase client access.
- [ ] Run verification and confirm it passes.

### Task 3: Design Tokens and Components

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/components/theme-provider.tsx`
- Create: `src/components/theme-toggle.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/toast.tsx`
- Create: `src/lib/utils.ts`
- Create: `src/lib/theme.ts`
- Create: `src/lib/design-tokens.ts`
- Create: `scripts/verify-design-system.mjs`

**Interfaces:**
- Produces: semantic Tailwind tokens and reusable base components.
- Produces: light and dark theme using `[data-theme]`, `prefers-color-scheme`, localStorage, and future profile persistence hook.

- [ ] Write design verification tests first.
- [ ] Run `node scripts/verify-design-system.mjs` and confirm it fails.
- [ ] Implement tokens, fonts, provider, and base components.
- [ ] Run design verification and confirm it passes.

### Task 4: Live Supabase Verification

**Files:**
- Create: `scripts/phase1-rls-check.mjs`

**Interfaces:**
- Consumes: `.env.local` values.
- Produces: boolean evidence that two Auth users are isolated by RLS.

- [ ] Write the RLS check script to create two users, insert owned rows, and prove user B cannot read user A private rows.
- [ ] Run after migration is applied.
- [ ] Confirm public/reference reads still work where intended.

### Task 5: Final Verification

**Files:**
- No new implementation files.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: final PASS/FAIL table.

- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Start `next start`, screenshot light and dark mode at 375, 768, and 1440 px.
- [ ] Run hardcoded color grep against changed files.
- [ ] Commit, push, and deploy after all checks pass.
