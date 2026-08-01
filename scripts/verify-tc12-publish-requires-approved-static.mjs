import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminLib = readFileSync("src/lib/admin.ts", "utf8");

assert.match(
  adminLib,
  /\.select\("id, status"\)\s*[\s\S]*\.eq\("id", articleId\)\s*[\s\S]*\.single\(\)/,
  "TC-12 moderation must read the article's current status before publishing.",
);
assert.match(
  adminLib,
  /if\s*\(\s*action === "publish"\s*&&\s*currentArticle\.status !== "approved"\s*\)/,
  "TC-12 publish must be blocked unless the current article status is approved.",
);
assert.match(
  adminLib,
  /Article must be approved by an editor before publication\./,
  "TC-12 publish denial must return a clear message.",
);
assert.match(
  adminLib,
  /action === "hide"\s*\?\s*\{\s*status: "rejected"/,
  "TC-12 must keep the existing hide moderation transition.",
);
assert.match(
  adminLib,
  /: \{\s*status: "submitted", reviewed_at: null, published_at: null\s*\}/,
  "TC-12 must keep the existing restore moderation transition.",
);

console.log(
  JSON.stringify(
    {
      tc12PublishRequiresApprovedStatic: true,
      unapprovedPublishBlocked: true,
      otherModerationTransitionsPreserved: true,
    },
    null,
    2,
  ),
);
