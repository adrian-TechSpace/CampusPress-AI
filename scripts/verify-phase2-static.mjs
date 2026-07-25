import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/phase-2-admin-bootstrap.md",
  "src/app/terms/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/auth/update-password/page.tsx",
  "src/components/auth/update-password-panel.tsx",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Missing ${file}`);
}

const bootstrapDoc = readFileSync("docs/phase-2-admin-bootstrap.md", "utf8");
assert.match(bootstrapDoc, /update public\.profiles/, "Bootstrap doc must include exact SQL update");
assert.match(bootstrapDoc, /where email = lower\(/, "Bootstrap SQL must target one existing profile by email");
assert.match(bootstrapDoc, /returning id, email, role/, "Bootstrap SQL must show verification output");

const authPanel = readFileSync("src/components/auth/auth-panel.tsx", "utf8");
assert.match(authPanel, /href="\/terms"/, "Auth panel must link to Terms of Service");
assert.match(authPanel, /href="\/privacy"/, "Auth panel must link to Privacy Policy");

const resetRoute = readFileSync("src/app/api/auth/reset-password/route.ts", "utf8");
assert.match(resetRoute, /redirectTo: `\$\{origin\}\/auth\/update-password`/, "Reset email must redirect to update password page");
assert.match(resetRoute, /resetPasswordForEmail/, "Reset route must use the normal Supabase recovery email flow");

const updatePanel = readFileSync("src/components/auth/update-password-panel.tsx", "utf8");
assert.match(updatePanel, /updateUser\(\{ password/, "Update password page must call Supabase updateUser");
assert.match(updatePanel, /Show password|Hide password/, "Update password page must include a visibility toggle");

console.log("phase 2 static verification passed");
