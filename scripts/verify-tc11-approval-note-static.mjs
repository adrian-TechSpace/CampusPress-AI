import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editorReview = readFileSync("src/lib/editor-review.ts", "utf8");

assert.match(
  editorReview,
  /const cleanNote = note\.trim\(\);/,
  "TC-11 must continue trimming editor decision notes before validation.",
);
assert.match(
  editorReview,
  /if\s*\(\s*cleanNote\.length\s*<\s*12\s*\)/,
  "TC-11 must require a clear decision note for every editor decision, including approval.",
);
assert.doesNotMatch(
  editorReview,
  /action === "request_revision"\s*\|\|\s*action === "reject"/,
  "TC-11 approval must not bypass the mandatory decision-note guard.",
);
assert.match(
  editorReview,
  /Add a clear decision note before sending this update\./,
  "TC-11 must keep the existing mandatory-note error message.",
);

console.log(
  JSON.stringify(
    {
      tc11ApprovalNoteStatic: true,
      approveRequiresDecisionNote: true,
      existingMandatoryNoteMessagePreserved: true,
    },
    null,
    2,
  ),
);
