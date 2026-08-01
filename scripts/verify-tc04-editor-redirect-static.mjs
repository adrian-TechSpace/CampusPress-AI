import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync("src/components/editor/editor-review-queue-client.tsx", "utf8");
const apiRoute = readFileSync("src/app/api/editor/review-queue/route.ts", "utf8");

assert.match(
  apiRoute,
  /Only editors and administrators can open the editorial review queue\./,
  "TC-04 API denial message must stay in the editor queue API route.",
);
assert.match(client, /useRouter/, "TC-04 client must use Next client navigation after access denial.");
assert.match(
  client,
  /\.from\("profiles"\)\s*[\s\S]*\.select\("role"\)/,
  "TC-04 client must look up the signed-in user's assigned role after access denial.",
);
assert.match(
  client,
  /router\.replace\(`\/dashboard\/\$\{profile\.role\}`\)/,
  "TC-04 client must redirect denied users to their own role dashboard.",
);
assert.match(
  client,
  /supabase\.auth\.signOut\(\)/,
  "TC-04 client must sign out users with no assigned role/profile.",
);

console.log(
  JSON.stringify(
    {
      tc04EditorRedirectStatic: true,
      apiDenialPreserved: true,
      deniedUserRoleRedirect: true,
      noProfileSignOut: true,
    },
    null,
    2,
  ),
);
