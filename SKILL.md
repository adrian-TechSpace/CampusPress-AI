---
name: campuspress-design
description: Binding design and frontend specification for CampusPress AI. Read this in full before building or restyling any screen. Defines the aesthetic direction, Chrisland brand tokens, motion system, and per-screen density rules for this specific project. Overrides generic frontend instinct wherever the two conflict. Supersedes all earlier versions of this file.
---

# CampusPress AI Design Skill (v2)

This is not generic frontend guidance. This is the specific design law for a
university student-journalism platform whose brand is Chrisland purple and gold,
whose closest visual reference is tesla.com (https://www.tesla.com/) for
structure, pacing, and restraint, and whose data screens (editorial queue, admin
dashboard) need to read like a serious SaaS tool, not a marketing page. Read this
before touching any screen, and re-read the relevant section before starting each
new phase.

## Change log

v2 supersedes v1 on the following points, effective immediately for all screens
built from this point forward (earlier completed screens should be updated to
match on next touch, not retroactively hunted down):

- **Light theme only.** Dark mode, system theme, and the theme toggle are
  removed entirely. Do not build a theme provider, theme toggle, or
  `[data-theme="dark"]` tokens. One light theme, done well, beats a
  half-committed dark mode.
- **Tesla.com is now the explicit structural reference** for the marketing/
  reading surfaces, on top of the Medium/Substack reading-comfort research
  already in `CAMPUSPRESS_MASTER_BUILD.md`. Full-bleed hero imagery, large
  confident headlines, generous negative space, minimal persistent chrome,
  content revealed in deliberate full-width sections as the user scrolls, subtle
  glass/translucent overlay cards for stat or feature callouts.
- **Real photography is now sourced and available**, not a future placeholder
  problem. See "Approved imagery" below.
- **Never repurpose the `Badge` component as a banner.** A badge is a small
  inline pill for status/labels. A hero banner, section header, or full-width
  callout is its own component. Reusing one for the other produces exactly the
  flat colored bar this rule now exists to prevent.

## 0. The one rule that resolves every conflict below

**Marketing/reading surfaces and working/data surfaces are different animals.**
Treat them differently on purpose:

- **Marketing and reading surfaces** — landing page, article reader, portfolio
  pages, onboarding — get the full premium treatment: bold aesthetic commitment,
  glassmorphism accents, real photography, generous motion, a hero that feels
  considered rather than templated. Tesla.com is the pacing and structure
  reference for these.
- **Working and data surfaces** — the writer's editor, the editorial review
  queue, the admin dashboard, notifications — get restraint. Data density,
  clarity, and speed of comprehension beat visual flourish every time.

If unsure which category a screen falls into, ask: is a user here to be
persuaded/delighted, or to get work done quickly and correctly? That answer picks
the section below.

## 1. Approved imagery

Real, sourced images are available in `assets/` at the project root. Use these,
not stock placeholders, wherever campus or journalism imagery is called for:

- `assets/Chrisland university logo.webp` — the official crest. Use per the
  logo placement rules below. Never distort, recolor, or place it on a
  low-contrast background.
- `assets/Chrisland University College of Law building.jpg` and
  `assets/Entrance of lecture rooms.jpg` — real Chrisland campus photography.
  Use for hero backgrounds, about/institution sections, and onboarding.
- `assets/Jornalism images/` — a folder of journalism-themed photography
  (reporters, newsrooms, print media) for use on the landing page, portfolio
  headers, and empty/loading states that benefit from mood imagery.

If a specific screen needs a campus or journalism image not covered by the
above, search for a real photograph that specifically matches the described
mood and confirm in one line why it fits, per `AGENTS.md`'s imagery rule. Do not
default to generic stock photography of unrelated universities when better
Nigerian-university-appropriate options exist.

### Logo placement rules

The crest appears, at appropriate scale and with real breathing room around it,
on: the loading/splash state, the landing page hero or nav, the primary nav bar
across the app, portfolio pages, and any consent/verification modal. It does not
appear stretched, tinted, or crammed into a banner alongside unrelated text.
Phase 4 adds one deliberate exception: the reader home may use the crest as the
floating AI assistant icon, at small scale, because the user explicitly requested
that treatment for the assistant entry point.

## 2. Aesthetic direction (marketing/reading surfaces)

Commit to: refined editorial premium, Tesla-paced. Full-bleed photography,
one dominant headline per section, minimal persistent UI, content unfolding in
deliberate scroll sections rather than everything competing above the fold. Not
maximalist, not playful, not brutalist. The one thing someone should remember:
this looks like it was built by people who take journalism and craftsmanship
seriously.

- Typography: Cormorant Garamond for display/headlines, Outfit for body and
  UI text. Never mix in a third font family. Max two font weights per screen.
- Color: one neutral base (zinc/slate, light only) plus Chrisland purple as
  the single accent, gold reserved for genuinely special moments (verification
  badges, achievement unlocks, the crest itself), never gold as a general UI
  color or full-width banner fill. No rainbow palettes. No decorative gradients
  except one signature hero treatment, used once, not on every card.
- Glassmorphism, used deliberately, not everywhere: a frosted translucent
  panel over a real photograph, Tesla-style overlay-card treatment for stat
  blocks and feature callouts on the hero and about sections, the auth and
  onboarding backdrop, and the portfolio header. Never glass-on-glass, never
  more than one glass layer stacked per screen.
- Backgrounds: full-bleed real photography behind hero sections, subtle
  texture or gradient mesh only where photography isn't the right choice. Every
  working/data screen: a clean, near-white surface doing its job quietly.

## 3. Motion system

Springs only for anything interactive, never ease, ease-in-out, or linear on
something a user directly triggers.

```js
const springs = {
  heavy:   { type: 'spring', stiffness: 80,  damping: 18, mass: 1.2 }, // modals, drawers
  default: { type: 'spring', stiffness: 140, damping: 20, mass: 0.8 }, // buttons, cards
  snappy:  { type: 'spring', stiffness: 300, damping: 28, mass: 0.5 }, // tooltips, badges
  drift:   { type: 'spring', stiffness: 60,  damping: 15, mass: 1.0 }, // hero reveals
};
```

- One well-orchestrated moment per screen beats scattered micro-interactions.
  On the landing page: a staggered hero reveal and scroll-triggered section
  entrances, Tesla-style. On the article reader: nothing, reading surfaces
  should be still once loaded.
- Every animation must answer: what does this movement communicate? If removing
  it doesn't hurt comprehension, remove it.
- prefers-reduced-motion respected everywhere, no exceptions.
- Working/data screens: functional and feedback motion only. No ambient motion,
  no scroll storytelling.

## 4. Working/data surfaces (editor, review queue, admin dashboard)

Unchanged from v1: SaaS-dashboard discipline. Tabular-nums for numeric data,
CSS Grid sidebar plus main, sticky headers, sortable tables with real empty and
error states, no 3D charts, no more than five pie segments, always labeled axes
and tooltips remapped to the Chrisland palette.

## 5. Accessibility baseline (every screen, no exceptions)

WCAG AA contrast on every color pairing, full keyboard navigation and visible
focus states, real labels on every form control, meaningful alt text on every
non-decorative image, including the crest and campus photography.

## 6. Feedback and plain-English law

No bare spinners for anything longer than roughly half a second. Plain-English
progress such as "Checking grammar and tone..." or "Uploading your draft...".
Every error states what happened, why, and what to do next. Never a raw system
error string to a non-technical user.

## 7. Before building any individual screen

Write a short concrete spec first: what's on it, in what hierarchy, empty,
loading, and error states, which section of this document governs it, exact
spacing and type scale, not "make it look nice." This applies most to the
landing page, the article reader, the writer's editor, and the AI analysis
report, since those four screens are what any visitor or examiner will judge
the whole project by.
