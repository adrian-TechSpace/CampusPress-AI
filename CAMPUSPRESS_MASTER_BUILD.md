# CampusPress AI — Master Build & Development Roadmap (Final, Single Source of Truth)

Chrisland University — "Intellectual Radiance"
Final-year project, Adebayo Temiloluwa Daniel, Software Engineering, 2026.

This is the only build document Codex should read for CampusPress AI. It replaces
every earlier version. Do not keep older master-build files in this folder — one
document, fully self-contained, nothing to cross-reference. Every rule in
`AGENTS.md` and `SKILL.md` applies without exception throughout every phase below.

Each phase ends with a working, demoable slice, not just files. Never begin
Phase N+1 until Phase N's acceptance criteria all pass in a real test, not a mental
trace. If a step is interrupted (crash, power loss, cancelled command), re-check
actual file state before resuming rather than trusting the last reported status.

---

## Competitive research findings — informing this rebuild

- **SNO Sites** — the closest real competitor: a managed platform used by thousands
  of real school/university student newsrooms. Its strength is reliability and a
  clean, uncluttered reading layout that advisers and students both trust. Its
  weakness: no meaningful AI-assisted editorial tooling, review is entirely manual.
  This is CampusPress AI's clearest differentiator; the AI analysis pipeline should
  be positioned as what a lecturer/editor sees instantly on submission, not a
  bolt-on feature.
- **Medium / Substack** — best-in-class distraction-free writing and reading
  surfaces. Serif display font for headlines against a clean sans body font
  (Cormorant Garamond + Outfit, already chosen), wide line-length limits, minimal
  chrome around the writing area while drafting. Editor screen takeaway: hide
  navigation/toolbars during active writing, surface AI feedback in a non-blocking
  side panel, never a modal that interrupts typing.
- **Grammarly / Hemingway** — the reference bar for live writing feedback: inline
  underlines with hover explanations, a single readability score that updates live,
  no jargon in suggestions. Maps directly onto the Flesch-Kincaid + LanguageTool
  integrations — the fix needed is presentation, not new models.
- **Google News / Apple News personalisation** — validates the TF-IDF/interest-based
  feed approach; the differentiator is transparency, telling the reader *why* an
  article was recommended.

Net conclusion: the 8-model AI pipeline is already ahead of every direct competitor
researched on substance. The gap is in presentation, trust-building, and visual
polish — exactly what this rebuild's design work and `SKILL.md` target.

---

## Locked decisions (do not re-litigate mid-build)

1. **Stack:** Next.js App Router, TypeScript, Tailwind, Supabase. Built from a
   genuinely empty folder. The Lovable-generated `CPA` frontend is a **visual/theme
   reference only** — Codex may look at its color usage, spacing, and component
   styling for inspiration, but must never open its source files to copy layout,
   structure, or logic. It also incorrectly merges journalist, editor, and admin
   views into one screen, which this build must not repeat. The old vanilla-JS
   build (`campuspress_AI.zip`) is a **feature-completeness reference only** — it
   shows what screens/flows existed before, not how to build them now.
2. **Institutional verification:** Chrisland has no institutional email domain, so
   domain-based verification is not implementable. Mechanism, effective immediately:
   - At signup, the user enters a matric number (students) or staff ID (lecturers/
     editors/admins), plus department and year — format `DEPT/YEAR/SEQUENCE`, e.g.
     `SWE/2022/018`, `NSC/2022/132`, `MLS/2023/027`.
   - This is **format-validated only** at signup (regex per department code) and
     **self-attested**. Access is granted immediately — no admin approval gate, no
     waiting.
   - Admins can upload a roster (CSV, department by department) at any time, before
     or after users start signing up. A background job cross-checks existing and new
     profiles against the roster. A match sets `verified = true` and surfaces a
     "Verified Chrisland Student/Staff" badge on the profile and portfolio, factored
     into credibility scoring. No match leaves the account fully functional but
     unverified.
   - This is a stated limitation, not a solved identity problem: until a roster is
     uploaded, the platform accepts any correctly-formatted matric/staff ID. The
     project owner is revising the thesis (Chapter 3) separately to describe this
     mechanism accurately — this build does not touch the thesis document.
3. **AI pipeline framing:** the target is the most rigorous, transparent, and
   trustworthy AI editorial pipeline a student newsroom has had — multi-pass
   verification, confidence scoring, honest partial-failure states, quoted-evidence
   flagging. For the core credibility/bias/fake-news judgment specifically, use a
   **multi-model ensemble** (OpenAI + HuggingFace BERT + Cardiff RoBERTa + rule-based
   scoring, Claude added once funded) rather than trusting a single model's verdict —
   disagreement between models is itself a signal shown to the editor, never hidden
   or silently averaged away.
4. **Timeline:** 14 days, full 10-phase depth, fully functional and deployed. Risk
   of this compression accepted explicitly by the project owner. No speculative
   scope beyond what's specified below, and no revisiting a "done" phase unless a
   later phase's testing surfaces a real defect in it.
5. **Infrastructure and credentials:** dedicated Supabase project, dedicated
   GitHub repo, dedicated Vercel project, dedicated Resend account for transactional
   email (OTP, notifications), dedicated OpenAI key. All access tokens (Supabase,
   GitHub, Vercel, Resend, OpenAI) are provided to Codex for this project only, set
   as session environment variables, and will be fully revoked once the project is
   built, deployed, and handed over — this is expected and not a security concern to
   flag repeatedly. Tokens are never printed back in any output, log, commit
   message, or file that gets committed to version control; they live only in
   `.env.local`, which must be confirmed in `.gitignore` before the first commit.
   This runs in parallel with the Atlas and Launchpad projects in their own
   terminals/folders with no shared state — safe as long as this terminal sets its
   own session env vars and no global `supabase login` is ever run here.
6. **Design system:** `SKILL.md` in this folder is the binding design specification
   Codex must read before building any screen. It defines the aesthetic direction,
   Chrisland brand tokens, motion system, and per-screen density rules (marketing
   pages vs. working/data screens are treated differently — see `SKILL.md`).

---

## 14-day schedule

| Day(s) | Phase | Focus |
|---|---|---|
| 1 (half) | Phase 0 | Environment, all five service tokens, Next.js scaffold, guardrails |
| 1 (half) – 2 | Phase 1 | Schema, RLS, design system, component library |
| 3 | Phase 2 | Auth, matric/staff-ID onboarding, role routing |
| 4 | Phase 3 | Reader experience, feed, search, notifications |
| 5 | Phase 4 | Journalist writing/editor, autosave, submission |
| 6–8 | Phase 5 | AI analysis pipeline (flagship — 3 full days) |
| 9 | Phase 6 | Editorial review queue |
| 10 | Phase 7 | Portfolio and reputation |
| 11 | Phase 8 | Admin, moderation, monetisation scaffolding (test mode) |
| 12 | Phase 9 | PWA, performance, offline resilience |
| 13–14 | Phase 10 | Full verification pass, credential sweep, launch |

If a day's phase isn't demonstrably done by end of day, flag it immediately. If time
must be borrowed, take it from Phase 8 (monetisation scaffolding is test-mode only
and least consequential to the defense) first — never from Phase 5 or Phase 1.

---

## Phase 0 — Environment, Access, and Guardrails

**Goal:** Nothing is built yet, but every account, token, and safety rail is in
place so no destructive mistake is possible from Phase 1 onward.

- Confirm the empty project folder `C:\Users\hp\Documents\CampusPress AI` is where
  all work happens.
- Create a fresh Supabase project (separate from every other project). Generate a
  dedicated Supabase Personal Access Token for this project only.
- Confirm `SUPABASE_ACCESS_TOKEN` is set as a per-terminal-session environment
  variable, never a global `supabase login`.
- Scaffold Next.js (App Router) + TypeScript + Tailwind. Confirm `.env.local` is in
  `.gitignore` before the first commit.
- Set up GitHub repo, Vercel project (Hobby tier, static + serverless only).
- Set up Resend for transactional email (OTP codes, notification emails).
- Confirm OpenAI API key is available; leave a clearly labelled placeholder for the
  Anthropic Claude key to be added later.
- Institutional verification mechanism is the matric/staff-ID design specified
  above — document the exact regex used per department code in this phase's notes.

**Acceptance:** empty Next.js app runs locally, deploys a placeholder page to
Vercel, Supabase project is reachable via the dedicated access token only, a test
email sends successfully via Resend, lint/typecheck/build all pass on an empty
project.

---

## Phase 1 — Foundation: Schema, RLS, Design System

**Goal:** The unbreakable base every later phase assumes is complete.

- Full schema, rebuilt fresh: `profiles`, `institutions`, `articles`, `comments`,
  `messages`, `notifications`, `bookmarks`, `follows`, `article_likes`,
  `ai_analyses`, `ad_placements`, `subscriptions`, `payments`, `audit_log`,
  `user_interests`, `categories`, `achievements`, `user_achievements`,
  `ai_usage_log`, `job_run_log`, plus `institution_roster` (department,
  matric_or_staff_id, full_name, uploaded_by admin_id, uploaded_at) and a
  `verified boolean default false` + `verified_at timestamptz` column on `profiles`.
- RLS on every table, idempotent policies, tested per-role.
- Triggers: article_count increment on publish, credibility_score recalculation,
  audit_log writes on sensitive operations, roster cross-check as a Supabase Edge
  Function triggered on roster upload and on new profile creation, writing to
  `job_run_log` either way.
- Tailwind theme configured per `SKILL.md`'s Chrisland token scale — no ad hoc
  colours anywhere in the codebase from this point forward.
- Cormorant Garamond + Outfit loaded via `next/font`, dark mode via a theme
  provider driven by `[data-theme="dark"]` and `prefers-color-scheme`, stored in
  both localStorage and `profiles.preferences`.
- Base component library (buttons, cards, inputs, badges, skeletons, toasts) built
  once per `SKILL.md`, reused everywhere.

**Acceptance:** schema visible and correct in Supabase Table Editor; RLS isolation
manually verified (a second test user cannot read the first user's rows);
dark/light mode both render correctly at 375/768/1440px; zero hardcoded colours or
fonts anywhere in the diff.

---

## Phase 2 — Auth and Onboarding

**Goal:** Any real student, lecturer, or admin can sign up with a personal email
and land in the correct role-specific space.

- Email/password + OTP verification via Supabase Auth and Resend, any real
  provider accepted.
- Matric number / staff ID collected at signup alongside department and year.
  Format validation runs client-side live (instant, plain-English feedback on
  mismatch, e.g. "This doesn't look like a Chrisland matric number — check the
  department code and year") and server-side on submit (never trust client-side
  alone for the stored value). No admin gate. Grep for `email_domain` before
  calling this phase done and confirm zero results anywhere in the codebase.
- Role selection (Reader, Student Journalist, Editor/Lecturer, Administrator) with
  RLS-enforced permissions, never client-side-only role checks.
- Onboarding: interests, department, guided tour.
- Terms of Service / Privacy Policy links wired to real hosted pages, not
  placeholders left silently broken.

**Acceptance:** full signup-to-dashboard flow works for all four roles on a fresh
Supabase project; a user cannot self-assign an admin/editor role by manipulating
client requests; forgot-password flow exists and is tested end to end.

---

## Phase 3 — Reader Experience

**Goal:** Anyone, logged in or not, can discover and read published articles
comfortably.

- Public article URLs (no login required for published content), personalised feed
  after login using the TF-IDF/`generate-feed` engine, with a visible "why you're
  seeing this" explanation.
- Search, bookmarks, following authors, comments, likes.
- Article view designed to Medium/Substack reading-experience standard: wide
  line-length limit, serif headline, generous whitespace, no competing sections
  fighting for attention above the fold.
- Notifications screen with plain-English descriptions of every event.

**Acceptance:** cold, logged-out reader can open and read a published article with
no account; personalised feed changes visibly based on stated interests; every
notification reads in plain English with no raw system language.

---

## Phase 4 — Journalist Writing and Submission

**Goal:** A student journalist can draft, save, and submit an article with a
genuinely good writing experience.

- Rich text editor with a distraction-free writing mode (chrome hidden while
  typing).
- Live Flesch-Kincaid readability score and LanguageTool grammar checking surfaced
  inline, Grammarly-style: underlines with hover explanations, not a separate
  report screen.
- Draft autosave (background sync queue for offline saves), submit-for-review
  flow, status tracking, revision-request handling.
- Every save/submit action gives real plain-English feedback on progress, never a
  bare spinner.

**Acceptance:** a full article can be drafted, autosaved, and submitted without
data loss even if the connection drops mid-edit; readability/grammar feedback
updates live without blocking typing; every writer-facing message uses plain
English.

---

## Phase 5 — AI Analysis Pipeline (the flagship feature)

**Goal:** On submission, the article passes through all 8 required models plus
approved additions, and the result is trustworthy, transparent, and never
silently incomplete.

**Current status note, July 25, 2026:** Phase 5 is in a known partial state, not
complete. Six of eight signals are live and verified with real evidence:
HuggingFace fake-news detection, Cardiff RoBERTa sentiment, LanguageTool,
pg_trgm plagiarism/originality, TF-IDF, and rule-based credibility scoring. The
OpenAI-dependent LLM editorial pass and the multi-pass verification layer are
implemented in code but remain unverified until OpenAI billing is active again.
Editor-facing reports must show this honestly by rendering the six working
signals normally and showing a clear temporarily unavailable note for the AI
editorial judgment and verification pass when those OpenAI checks fail.

- Wire all 8 models: LLM grammar/bias/credibility (OpenAI now, Claude added later
  behind the same interface), HuggingFace BERT fake-news, Cardiff RoBERTa
  sentiment, pg_trgm plagiarism, rule-based 9-point credibility scoring,
  Flesch-Kincaid, LanguageTool, TF-IDF.
- Add the multi-pass verification layer: a second structured LLM pass checks the
  first pass's claims against the actual article text before anything is shown to
  a user.
- Add confidence surfacing on every score, and an honest "this check didn't
  complete" state per model rather than failing the whole analysis.
- **Ensemble disagreement surfacing:** for the credibility/bias/fake-news
  judgment, the editor-facing report shows each model's individual verdict and
  confidence, plus a combined verdict, plus an explicit flag when models
  disagree (e.g. "BERT flagged this as likely misleading; the LLM pass did not —
  manual review recommended") rather than silently resolving disagreement into
  one number.
- `warmup-models` cron every 30 minutes to reduce HuggingFace cold starts; every
  run logged to `job_run_log` whether it succeeds or fails.
- Editor-facing detailed report: every credibility rule's pass/fail state, every
  flagged sentence with its actual quoted text, not just aggregate scores.
- Step-by-step progress UI during analysis ("Checking grammar and tone... Scanning
  for fake-news signals... Checking originality... Almost done"), never a bare
  spinner.

**Acceptance:** submit an article and manually verify all 8 signals return
correctly; deliberately break one model's API key and confirm the other 7 still
return, with a plain-English note about the one that failed, not a total failure;
`job_run_log` shows a row for every analysis run and every warmup-models cron
tick; a deliberately ambiguous article shows visible model disagreement rather
than a falsely confident single score.

---

## Phase 6 — Editorial Review Queue

**Goal:** Editors/lecturers can review submissions efficiently using the AI
analysis as a decision aid, not a black box.

- Review queue with filtering/sorting, full AI analysis report alongside the
  article, approve / reject / request-revision actions, messaging with the
  journalist.
- Editorial analytics: submission volume, average review time, most common flags.

**Acceptance:** an editor can review, understand every AI signal without needing
explanation, and make a decision within the same screen; revision requests reach
the journalist with clear, specific, plain-English next steps.

---

## Phase 7 — Portfolio and Reputation

**Goal:** Student journalists build a public portfolio from their published work.

- Auto-generated public portfolio page per journalist: published articles,
  credibility track record, achievements/badges, verification badge if the
  roster cross-check matched.
- Chrisland University logo displayed correctly on portfolio pages per
  `SKILL.md`'s logo placement rules (loading screen, welcome screen, nav bar,
  portfolio, consent modal).

**Acceptance:** a portfolio page is shareable via a public URL, renders correctly
at 375/768/1440px, and correctly reflects only that journalist's
actually-published work (RLS-correct, no data leakage between journalists).

---

## Phase 8 — Administration, Moderation, and Monetisation Scaffolding

**Goal:** Platform-level controls exist, and payment infrastructure is wired in
test mode even if monetisation isn't launched on day one.

- Admin dashboard: user management, content moderation, AI cost/usage monitoring
  (`ai_usage_log`), platform-wide analytics, roster CSV upload interface.
- Paystack integration in test mode: subscriptions/payments tables wired, webhook
  handling with the same fail-safe plain-English error handling as everything
  else.

**Acceptance:** an admin can suspend a user, review flagged content, upload a
roster CSV and see it retroactively verify matching profiles, and see current AI
API usage/cost at a glance; a test-mode Paystack transaction completes end to end
and updates `payments`/`subscriptions` correctly.

---

## Phase 9 — PWA, Performance, and Offline Resilience

**Goal:** The app performs like a well-built native-feeling web app on a
student's phone, including on poor campus wifi.

- Service worker, offline caching for the app shell, background sync for offline
  draft saves.
- Performance budget: confirm Time to Interactive under 4 seconds on Slow 4G,
  bundle size checked, images lazy-loaded.

**Acceptance:** app installs as a PWA; drafting an article while offline and
reconnecting later successfully syncs the draft without loss; Lighthouse/perf
audit meets the stated budget.

---

## Phase 10 — Full Verification Pass and Launch Readiness

**Goal:** Every phase re-verified together as one system before real users touch
it.

- Full Playwright pass across every screen at 375/768/1440px, light and dark
  mode.
- Every scheduled job manually triggered once more with `job_run_log` inspected.
- Every external API failure mode (OpenAI/Claude down, HuggingFace throttled,
  Supabase Storage timeout, Vercel deploy failure, Paystack webhook delay, Resend
  send failure) deliberately tested, not assumed.
- Anthropic Claude API key added (once funded) behind the existing
  provider-agnostic AI interface; confirm both providers can serve the same
  LLM-based checks without code changes elsewhere.
- Confirm the deployed system's actual verification behavior matches whatever the
  project owner's revised thesis Chapter 3 wording says, once shared — flag any
  mismatch rather than assuming it's fine.
- Final credentials sweep: confirm every access token (Supabase, Vercel, GitHub,
  Resend, OpenAI) is ready to be revoked at completion.

**Acceptance:** a full cold-start user journey — signup, onboarding, write,
submit, AI analysis, editorial review, publish, portfolio, read as a stranger —
passes without a single unhandled error state; every checklist item across all
ten phases is re-confirmed true, not assumed from earlier passes.

---

## How to run each phase with Codex

- State the phase and day, list every file to be touched, do a mental trace of
  every user flow in that phase, only then write code.
- Never begin the next phase until the current one's acceptance criteria are
  demonstrated in a real test, not assumed.
- If interrupted mid-phase, re-verify actual file state before resuming rather
  than trusting the last reported status.
- After any UI change: Playwright screenshot from the production build, inspected
  item by item against the request, per `AGENTS.md`.
- Run lint, typecheck, and build before calling any phase finished, every time.
- Never copy code from `CPA` or the old `campuspress_AI` build. Reference only.
