import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const requiredFiles = [
  "src/components/ui/button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/toast.tsx",
  "src/lib/utils.ts",
  "src/lib/design-tokens.ts",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Missing ${file}`);
}

const globals = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const page = readFileSync("src/app/page.tsx", "utf8");

assert.match(globals, /--chrisland-purple:/, "Missing Chrisland purple token");
assert.match(globals, /--chrisland-gold:/, "Missing reserved Chrisland gold token");
assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/, "Missing reduced motion support");
assert.match(globals, /@theme inline/, "Missing Tailwind v4 theme mapping");
assert.doesNotMatch(globals, /\[data-theme="dark"\]/, "Dark theme tokens must not exist in v2");

assert.match(layout, /Cormorant_Garamond/, "Missing Cormorant Garamond next/font import");
assert.match(layout, /Outfit/, "Missing Outfit next/font import");
assert.doesNotMatch(layout, /ThemeProvider/, "ThemeProvider must not be wired in v2");

assert.doesNotMatch(page, /ThemeToggle/, "Theme toggle must not render in v2");
assert.doesNotMatch(page, /<Badge[^>]*>Chrisland University/, "Do not use Badge as a section header");
assert.match(page, /CampusPress AI/, "Missing CampusPress AI placeholder page");

console.log("design system verification passed");
