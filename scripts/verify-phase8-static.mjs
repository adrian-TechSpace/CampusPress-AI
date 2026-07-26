import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "supabase/migrations/202607260001_phase_8_admin_scaffolding.sql",
  "src/lib/admin.ts",
  "src/lib/paystack.ts",
  "src/components/admin/admin-dashboard-client.tsx",
  "src/app/api/admin/overview/route.ts",
  "src/app/api/admin/users/suspension/route.ts",
  "src/app/api/admin/moderation/route.ts",
  "src/app/api/admin/roster/upload/route.ts",
  "src/app/api/admin/paystack/initialize/route.ts",
  "src/app/api/paystack/callback/route.ts",
  "src/app/api/paystack/webhook/route.ts",
];

for (const file of requiredFiles) {
  assert.equal(existsSync(file), true, `Missing Phase 8 file: ${file}`);
}

const migration = readFileSync("supabase/migrations/202607260001_phase_8_admin_scaffolding.sql", "utf8");
const accessMigration = readFileSync("supabase/migrations/202607260002_phase_8_admin_access_lockdown.sql", "utf8");
const adminLib = readFileSync("src/lib/admin.ts", "utf8");
const paystackLib = readFileSync("src/lib/paystack.ts", "utf8");
const dashboard = readFileSync("src/components/admin/admin-dashboard-client.tsx", "utf8");
const dashboardRoute = readFileSync("src/app/dashboard/[role]/page.tsx", "utf8");
const webhookRoute = readFileSync("src/app/api/paystack/webhook/route.ts", "utf8");

assert.match(migration, /suspended_at\s+timestamptz/i, "Profiles must support suspension timestamps.");
assert.match(migration, /suspension_reason\s+text/i, "Profiles must store a plain suspension reason.");
assert.match(migration, /create or replace function public\.is_suspended/i, "Suspension helper function is missing.");
assert.match(
  accessMigration,
  /revoke execute on function public\.run_roster_cross_check\(uuid\) from authenticated/i,
  "Direct roster cross-check RPC execution must be revoked from authenticated users.",
);
assert.match(adminLib, /function authenticateAdminRequest/i, "Admin API routes must share admin authentication.");
assert.match(adminLib, /function ingestRosterCsv/i, "Roster CSV ingestion helper is missing.");
assert.match(adminLib, /\.from\("institution_roster"\)/, "Roster upload must write to institution_roster.");
assert.match(adminLib, /run_roster_cross_check/, "Roster upload must run retroactive verification.");
assert.match(adminLib, /function setUserSuspension/i, "User suspension helper is missing.");
assert.match(adminLib, /function moderateArticle/i, "Article moderation helper is missing.");
assert.match(adminLib, /function moderateComment/i, "Comment moderation helper is missing.");
assert.match(paystackLib, /PAYSTACK_SECRET_KEY/, "Paystack must keep the secret key server-side.");
assert.match(paystackLib, /transaction\/initialize/, "Paystack initialization endpoint is missing.");
assert.match(paystackLib, /transaction\/verify/, "Paystack verification endpoint is missing.");
assert.match(paystackLib, /createHmac\("sha512"/, "Paystack webhook signature validation must use HMAC SHA512.");
assert.match(webhookRoute, /x-paystack-signature/i, "Webhook route must read Paystack signature header.");
assert.match(dashboardRoute, /AdminDashboardClient/, "Admin dashboard route must render the real admin client.");
assert.match(dashboard, /Roster CSV upload/, "Admin dashboard must include roster CSV upload UI.");
assert.match(dashboard, /data-testid="admin-denied"/, "Admin dashboard must render a restricted state for non-admin users.");
assert.match(dashboard, /Suspend/, "Admin dashboard must include user suspension controls.");
assert.match(dashboard, /Moderation/, "Admin dashboard must include moderation UI.");
assert.match(dashboard, /AI usage/, "Admin dashboard must include AI usage monitoring.");
assert.match(dashboard, /Paystack/, "Admin dashboard must include Paystack monetisation scaffolding.");

console.log(
  JSON.stringify(
    {
      phase8Static: true,
      adminDashboard: true,
      rosterCsvUpload: true,
      moderation: true,
      monetisationScaffolding: true,
    },
    null,
    2,
  ),
);
