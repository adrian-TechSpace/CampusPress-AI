import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portfolio = read("src/components/portfolio/portfolio-page.tsx");
const portfolioLib = read("src/lib/portfolio.ts");
const editorReview = read("src/lib/editor-review.ts");
const editorQueue = read("src/components/editor/editor-review-queue-client.tsx");
const inviteOnboarding = read("src/components/auth/invite-onboarding-panel.tsx");

assert.match(portfolio, /Verified Chrisland Student/, "Portfolio badge must use approved verified student wording.");
assert.doesNotMatch(portfolio, /Verified Chrisland Student\/Staff/, "Portfolio UI must not use staff wording.");
assert.match(portfolioLib, /Verified Chrisland Student/, "Portfolio badge data must use approved verified student wording.");
assert.doesNotMatch(portfolioLib, /Verified Chrisland Student\/Staff/, "Portfolio badge data must not use staff wording.");

assert.match(
  portfolio,
  /Roster verification means CampusPress matched this account to a Chrisland student record/,
  "Verified badge must explain what verification means.",
);
assert.match(
  portfolio,
  /Unverified means no roster match has been recorded for this account yet/,
  "Unverified badge must explain what unverified means.",
);
assert.match(
  portfolio,
  /Achievement badges are earned from CampusPress records/,
  "Achievement badges must include a plain-English explainer.",
);

assert.match(editorReview, /AI Hint/, "Revision-request guidance copy must use AI Hint.");
assert.match(editorQueue, /AI Hint/, "Editor queue copy must use AI Hint.");
assert.match(inviteOnboarding, /AI Hint/, "Invite onboarding copy must use AI Hint.");
assert.doesNotMatch(editorReview, /AI report evidence to check/, "Old revision guidance label must be removed.");
assert.doesNotMatch(editorReview, /main revision guidance/, "Old revision guidance phrasing must be removed.");
assert.doesNotMatch(editorQueue, /AI evidence together/, "Editor queue must not use the old AI evidence label.");
assert.match(editorQueue, /AI analysis report/, "The separate AI analysis report name must remain unchanged.");

console.log(JSON.stringify({ ok: true, stage: "track3-stage1-badge-ai-hint" }, null, 2));

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
