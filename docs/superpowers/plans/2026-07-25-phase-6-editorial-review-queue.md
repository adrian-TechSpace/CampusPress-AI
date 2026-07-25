# Phase 6 Editorial Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an editor review queue that works with the current partial Phase 5 state, showing six verified signals and an honest OpenAI temporarily unavailable state.

**Architecture:** Add authenticated editor APIs for queue data and review actions, reuse the existing AI analysis report as an embeddable panel, and create a restrained working/data screen at `/dashboard/editor`. Verification seeds a real submitted article with six completed checks and two failed OpenAI checks, then exercises the rendered editor workflow.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Tailwind, lucide-react, Playwright.

## Global Constraints

- Phase 5 is not complete while OpenAI billing is inactive.
- Editor reports must not show fake or silently broken OpenAI data.
- The review queue is a working/data surface: restrained SaaS density, clear hierarchy, no decorative flourish.
- No emojis and no em dashes in generated code, UI copy, comments, or commit messages.
- After UI changes, validate from a production build and inspect screenshots.
- Run lint, typecheck, and build before finishing.

---

### Task 1: Phase 6 Verification Script

**Files:**
- Create: `scripts/phase6-editorial-queue-check.mjs`

**Interfaces:**
- Consumes: `PHASE6_APP_URL`, Supabase env vars, Playwright.
- Produces: a PASS/FAIL JSON summary proving queue rendering, OpenAI unavailable notice, six working signal labels, and revision messaging.

- [ ] **Step 1: Write the failing verification script**

Create a script that creates a journalist, editor, submitted article, six completed `ai_analyses` rows, two failed OpenAI rows, signs in through the browser, opens `/dashboard/editor`, and asserts the queue, report, and revision action render correctly.

- [ ] **Step 2: Run it before implementation**

Run: `node --env-file=.env.local scripts/phase6-editorial-queue-check.mjs`
Expected: FAIL because `/dashboard/editor` is still a placeholder and no Phase 6 action API exists.

### Task 2: Honest Analysis Report Panel

**Files:**
- Modify: `src/components/editor/analysis-report-client.tsx`
- Modify: `src/lib/analysis/providers/openai.ts`
- Modify: `src/lib/analysis/orchestrator.ts`

**Interfaces:**
- Produces: exported `AnalysisReportPanel` component for the standalone report and the review queue.
- Produces: plain-English failed OpenAI messages instead of raw provider error strings.

- [ ] **Step 1: Add OpenAI unavailable detection**

Detect failed `openai_editorial` and `openai_verification` rows and render a top-level notice that the AI editorial judgment and verification pass are temporarily unavailable while six working signals remain visible.

- [ ] **Step 2: Keep all provider rows visible**

Show each completed signal normally, keep failed OpenAI rows clearly marked as did not complete, and avoid any aggregate claim that suggests the OpenAI checks succeeded.

### Task 3: Editor Queue APIs

**Files:**
- Create: `src/app/api/editor/review-queue/route.ts`
- Create: `src/app/api/editor/review-queue/action/route.ts`
- Create: `src/lib/editor-review.ts`

**Interfaces:**
- Produces: `GET /api/editor/review-queue` returning articles, author names, review analytics, and common AI flags.
- Produces: `POST /api/editor/review-queue/action` accepting `{ articleId, action, note }`.

- [ ] **Step 1: List reviewable submissions**

Allow only editor/admin profiles. Return `submitted`, `in_review`, and `revision_requested` articles, sorted by `submitted_at`.

- [ ] **Step 2: Apply decisions**

Approve sets `status = approved`; reject sets `status = rejected`; request revision sets `status = revision_requested`. Every decision writes `messages` and `notifications` for the journalist.

### Task 4: Editor Review Queue UI

**Files:**
- Create: `src/components/editor/editor-review-queue-client.tsx`
- Create: `src/app/dashboard/editor/page.tsx`

**Interfaces:**
- Consumes: queue API, analysis report API, action API.
- Produces: one screen with queue filters/sorting, analytics, article preview, full AI report, and decision controls.

- [ ] **Step 1: Build loading, empty, error, and unauthorized states**

Show plain-English status messages and never leave a bare spinner.

- [ ] **Step 2: Build the working queue**

Render a filterable, sortable list of submissions, a selected article preview, the reusable full AI report, and approve/reject/request-revision controls with a required note for revision.

### Task 5: Verification

**Files:**
- Modify: `scripts/phase6-editorial-queue-check.mjs`

**Interfaces:**
- Produces: final PASS/FAIL table and screenshots from production build.

- [ ] **Step 1: Run red/green verification**

Run the Phase 6 script until it passes against a production build.

- [ ] **Step 2: Run project verification**

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.

- [ ] **Step 3: Screenshot the final UI**

Start `next start`, capture desktop and mobile screenshots, inspect for overflow, clipped text, dev overlays, and the OpenAI unavailable state.
