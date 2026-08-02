import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tutorial = read("src/components/onboarding/role-tutorial.tsx");
const tutorialRoute = read("src/app/api/onboarding/tutorial/route.ts");
const shell = read("src/components/reader/authenticated-rail.tsx");
const onboarding = read("src/lib/onboarding.ts");

for (const copy of [
  'return "Reader"',
  'return "Journalist"',
  'return "Editor"',
  'return "Admin"',
  "Remind me later",
  "Skip",
  "Finish",
  "AI Hint",
  "Verified Chrisland Student badge",
]) {
  assert.match(tutorial, new RegExp(escapeRegExp(copy)), `Tutorial copy is missing: ${copy}`);
}

assert.match(tutorial, /data-testid="role-onboarding-tutorial"/, "Tutorial needs a stable browser test id.");
assert.match(tutorial, /window\.sessionStorage\.setItem\(tutorialSessionKey/, "Remind me later must suppress only the current browser session.");
assert.match(tutorial, /save\("skip"\)/, "Skip action must be immediately available.");
assert.match(tutorial, /save\("finish"\)/, "Finish action must persist completion.");
assert.match(tutorial, /fixed bottom-6 right-6/, "Tutorial must be a non-blocking panel, not a full-screen blocker.");
assert.doesNotMatch(tutorial, /fixed inset-0|backdrop|modal/i, "Tutorial must not use a blocking overlay.");

assert.match(tutorialRoute, /action === "skip" \|\| body\.action === "finish"/, "Skip and Finish must persist dismissed state.");
assert.match(tutorialRoute, /body\.action === "remind_later"|else \{[\s\S]*remindLater/, "Remind later must be distinct from dismissed state.");
assert.match(tutorialRoute, /authenticateActiveRequest/, "Tutorial state API must authenticate users.");
assert.match(tutorialRoute, /\.update\(\{ preferences: nextPreferences \}\)/, "Tutorial API must save state in profile preferences.");
assert.match(shell, /<RoleTutorial \/>/, "Authenticated shell must mount the tutorial.");
assert.match(onboarding, /return "\/dashboard\/journalist"/, "Journalist login should land on the real home page.");
assert.doesNotMatch(tutorial + tutorialRoute + shell + onboarding, /\u2014/, "Generated tutorial code must not use em dashes.");

console.log(JSON.stringify({ ok: true, stage: "track3-stage4-onboarding-tutorial" }, null, 2));

function read(path) {
  return readFileSync(path, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
