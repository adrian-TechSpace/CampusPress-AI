import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const requiredFiles = [
  "src/components/theme-provider.tsx",
  "src/components/theme-toggle.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/toast.tsx",
  "src/lib/utils.ts",
  "src/lib/theme.ts",
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
assert.match(globals, /\[data-theme="dark"\]/, "Missing data-theme dark mode tokens");

assert.match(layout, /Cormorant_Garamond/, "Missing Cormorant Garamond next/font import");
assert.match(layout, /Outfit/, "Missing Outfit next/font import");
assert.match(layout, /ThemeProvider/, "Missing ThemeProvider in root layout");

assert.match(page, /ThemeToggle/, "Missing visible theme toggle for verification");
assert.match(page, /CampusPress AI/, "Missing CampusPress AI placeholder page");

console.log("design system verification passed");
