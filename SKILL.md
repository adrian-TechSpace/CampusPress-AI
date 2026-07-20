---
name: campuspress-design
description: Binding design and frontend specification for CampusPress AI. Read this in full before building or restyling any screen. Defines the aesthetic direction, Chrisland brand tokens, motion system, and per-screen density rules for this specific project. Overrides generic frontend instinct wherever the two conflict.
---

# CampusPress AI Design Skill

This is not generic frontend guidance. This is the specific design law for a
university student-journalism platform whose brand is Chrisland purple and gold,
whose closest quality bar is Medium/Substack for reading and writing, and whose
data screens (editorial queue, admin dashboard) need to read like a serious SaaS
tool, not a marketing page. Read this before touching any screen, and re-read the
relevant section before starting each new phase.

---

## 0. The one rule that resolves every conflict below

**Marketing/reading surfaces and working/data surfaces are different animals.**
Treat them differently on purpose:

- **Marketing and reading surfaces** — landing page, article reader, portfolio
  pages, onboarding — get the full premium treatment: bold aesthetic commitment,
  glassmorphism accents, generous motion, a hero that feels considered rather
  than templated.
- **Working and data surfaces** — the writer's editor, the editorial review
  queue, the admin dashboard, notifications — get restraint. Data density,
  clarity, and speed of comprehension beat visual flourish every time. A lecturer
  reviewing twelve submissions in ten minutes does not want a glassmorphic panel
  animating in on every click.

If you're unsure which category a screen falls into, ask: is a user here to be
persuaded/delighted, or to get work done quickly and correctly? That answer picks
the section below.

---

## 1. Aesthetic direction (marketing/reading surfaces)

Commit to: **refined editorial premium.** Not maximalist, not playful, not
brutalist. Think a serious university press crossed with Medium's reading
comfort and a touch of Chrisland ceremonial gravitas (the crest, the purple and
gold, "Intellectual Radiance"). The one thing someone should remember: this looks
like it was built by people who take journalism and craftsmanship seriously, not
like a hackathon demo.

- **Typography:** Cormorant Garamond for display/headlines, Outfit for body and
  UI text. Never mix in a third font family anywhere. Max two font weights per
  screen.
- **Color:** one neutral base (zinc/slate) + the Chrisland purple as the single
  accent, gold reserved for genuinely special moments (verification badges,
  achievement unlocks, the crest itself) — never gold as a general UI color, or
  it stops meaning anything. No rainbow palettes. No decorative gradients except
  the one signature hero treatment, used once, not on every card.
- **Glassmorphism, used deliberately, not everywhere:** reserved for the hero
  section, the auth/onboarding backdrop, and the portfolio header. A frosted
  panel over a real photograph (campus life, students writing, the newsroom
  feel) — never glass-on-glass, never more than one glass layer stacked per
  screen.
- **Imagery:** real photographs matching campus/journalism/student-life mood,
  never stock-photo generic business people, never basic-shape placeholders.
  State in one line why a chosen image matches the brief before using it.
- **Backgrounds:** subtle texture or gradient mesh behind the hero only. Every
  other screen: a clean, near-white or near-black surface per theme, doing its
  job quietly.

---

## 2. Motion system

Springs only for anything interactive — never `ease`, `ease-in-out`, or
`linear` on something a user directly triggers.

```js
const springs = {
  heavy:   { type: 'spring', stiffness: 80,  damping: 18, mass: 1.2 }, // modals, drawers
  default: { type: 'spring', stiffness: 140, damping: 20, mass: 0.8 }, // buttons, cards
  snappy:  { type: 'spring', stiffness: 300, damping: 28, mass: 0.5 }, // tooltips, badges
  drift:   { type: 'spring', stiffness: 60,  damping: 15, mass: 1.0 }, // hero reveals
};
```

- **One well-orchestrated moment per screen beats scattered micro-interactions.**
  On the landing page, that's a staggered hero reveal. On the article reader,
  it's nothing — reading surfaces should be still, not animated, once loaded.
- Every animation must answer: what does this movement communicate? If removing
  it doesn't hurt comprehension, remove it.
- `prefers-reduced-motion` respected everywhere, no exceptions:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- Working/data screens (editorial queue, admin dashboard): functional and
  feedback motion only (loading states, button press, validation). No ambient
  motion, no scroll storytelling, no ambient particles. Ever.
- If a hero canvas or 3D touch is used on the landing page, it must degrade to a
  static image on low-end GPUs, and never appear anywhere outside the landing
  page and maybe the onboarding welcome screen.

---

## 3. Working/data surfaces (editor, review queue, admin dashboard)

These screens follow SaaS-dashboard discipline, not marketing-page instinct:

- Numeric data (scores, counts, percentages) always in a monospace numeral
  style (tabular-nums), never the display serif.
- Layout: CSS Grid sidebar + main, sidebar fixed width, sticky header. Metric
  rows separated by borders, not individual boxed cards, once a screen has more
  than three or four metrics on it.
- Tables: sticky header, sortable columns, pagination, explicit empty and error
  states — never a screen that just looks broken when there's no data yet.
- The AI analysis report (Phase 5/6) is the most important data screen in the
  entire app. It must show every model's individual verdict, confidence, and
  flagged sentence with exact quoted text — never collapse this into a single
  vague score. This is the flagship feature; the interface must respect that by
  being legible under real time pressure, not by being decorative.
- Charts: no 3D charts, no pie charts with more than five segments, always
  labeled axes and tooltips, always a loading skeleton matching the chart's
  bounding box, always remapped to the Chrisland palette rather than a library's
  default colors.

---

## 4. Accessibility baseline (every screen, no exceptions)

- Color contrast meets WCAG AA, checked for every new color pairing before it
  ships, especially purple-on-white and gold-on-white combinations which are
  easy to get wrong.
- Full keyboard navigation and visible focus states, including the sidebar and
  command palette if one exists.
- Every form control has a real label, not a placeholder pretending to be one.
- Every non-decorative image has meaningful alt text.

---

## 5. Feedback and plain-English law (applies everywhere, ties to AGENTS.md fail-safe rule)

- No bare spinners, anywhere, for any action longer than roughly half a second.
  Show what's happening in plain English ("Checking grammar and tone...",
  "Uploading your draft...", "Almost done") and show real progress when the
  underlying operation has stages, not a fake percentage.
- Every error message states, in plain English: what happened, why it likely
  happened, and what the user should do next. Never surface a raw system or API
  error string to a non-technical user.
- Success states are calm and clear, not celebratory noise — this is a
  professional publishing tool, not a game, except for genuine achievement
  moments in the portfolio/reputation system, where a small, restrained
  celebratory animation is appropriate.

---

## 6. Before building any individual screen

Do not start from a vague instinct. Write a short spec for the screen first —
what's on it, in what hierarchy, what state it's in when empty/loading/error,
what motion (if any) it uses, which section of this document governs it
(marketing/reading vs. working/data) — the same level of concrete detail as a
fully-specified component brief: exact spacing, exact type scale, exact states,
not "make it look nice." Vague direction produces generic output; a precise
spec, even a short one, produces something with actual craft. This applies most
to the landing page, the article reader, the writer's editor, and the AI
analysis report, since those four screens are what any visitor or examiner will
judge the whole project by.
