## Stack

React, TypeScript, Tailwind, shadcn/ui, Motion, Zustand, Drizzle.

## Design constraints (strict — do not deviate)

- Color: ONE neutral base (e.g. zinc/slate) + ONE accent color max. No rainbow palettes.
  No gradients unless explicitly requested.
- Spacing: generous whitespace. When unsure, add more padding, not less.
  Use Tailwind's default spacing scale only (4, 6, 8, 12, 16, 24) — no arbitrary values.
- Typography: max 2 font weights per page. No mixing more than 1 display font + 1 body font.
- Layout: single clear visual hierarchy per screen. Avoid cramming multiple competing
  sections/cards into one viewport. Prefer fewer, larger elements over many small ones.
- Shadows/borders: subtle only (shadow-sm, border, not shadow-2xl or heavy borders).
- Before adding any visual flourish (animation, gradient, shadow, icon), ask: does this
  serve the content, or is it decoration? Default to removing it if unsure.
- Reference: aim for the visual density of Linear, Vercel, or shadcn's own site —
  not a template marketplace demo.

## Imagery and content sourcing

- Never generate placeholder imagery as basic shapes (circles, lines, rectangles).
- For any image, source a real photograph that specifically matches the described
  mood, subject, and genre, not just a loosely related keyword match. Before finalizing,
  state in one line why the chosen image matches the brief (e.g. "dark, empty corridor,
  matches 'moody crime drama'"). If no confident match exists, ask instead of guessing.
- Do not settle for the first search result if it does not match on inspection, look
  at the actual image content, not just the filename or alt text, before using it.
- If a specific image source or service is requested, use only that source. Do not
  fall back to a different provider without saying so.

## Verification (this is where quality actually gets caught, take it seriously)

- After any UI change, take a Playwright screenshot and actually inspect it against
  the original request, item by item, not just "did it render without errors."
  Specifically check: does each image match its intended subject/mood, is any dev-only
  UI (framework badges, overlays, indicators) visible, are there layout overflows or
  clipped elements.
- Always screenshot from the production build (`next start`), not the dev server, for
  any screenshot meant to represent final output. The dev server shows framework
  indicators and can serve stale cached assets.
- If a change was interrupted (crash, power loss, cancelled command), do not assume
  prior progress was complete. Re-check the actual file contents and re-run lint,
  typecheck, and build before continuing, rather than trusting the last known status.
- Use the Playwright MCP to screenshot every UI change before calling it done.
- Use Context7 for any library API you're unsure about — don't guess.
- Run lint + typecheck + build before finishing a task, every time, not just when
  something seems off.

## Process hygiene

- Kill only the specific dev/build server processes started for verification. Never
  terminate unrelated Node processes.
- Flag any dependency install-script approvals (npm allow-scripts) by name and confirm
  they belong to known, expected packages before approving.
- Do not run destructive or broad commands (`npm audit fix --force`, deleting
  lockfiles, global reinstalls) without asking first.

## Non-negotiable rules

- Never use emojis anywhere in code, UI copy, comments, or commit messages.
- Never use em dashes in any generated text or copy. Use commas, periods, or
  restructure the sentence instead.
- Use SVG icons or an icon library (Lucide) instead of emoji for any visual indicator.
