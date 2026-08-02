import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertExists(path) {
  assert.ok(existsSync(path), `${path} is missing`);
  return read(path);
}

const migrationPath = "supabase/migrations/202607290001_track_2_moderation_invites_categories.sql";
const migration = assertExists(migrationPath);

assert.match(migration, /alter\s+type\s+public\.user_role\s+add\s+value\s+if\s+not\s+exists\s+'subadmin'/i);
assert.match(migration, /create\s+type\s+public\.account_moderation_status/i);
assert.match(migration, /session_version\s+integer\s+not\s+null\s+default\s+0/i);
assert.match(migration, /active_warning_action_id/i);
assert.match(migration, /suspended_until\s+timestamptz/i);
assert.match(migration, /banned_at\s+timestamptz/i);
assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.moderation_actions/i);
assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.suspension_appeals/i);
assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.account_invitations/i);
assert.match(migration, /'appeal-ids'/i, "Appeal ID photos must use their own private bucket.");
assert.match(migration, /create\s+or\s+replace\s+function\s+public\.is_full_admin/i);
assert.match(migration, /role(?:::text)?\s+in\s+\('admin',\s*'subadmin'\)/i, "Subadmins must be admin-tier for normal admin capabilities.");
assert.match(migration, /Student Government/i, "Student Government must be seeded as a real category.");

const enforcement = assertExists("src/lib/account-enforcement.ts");
assert.match(enforcement, /session_version/);
assert.match(enforcement, /account_status/);
assert.match(enforcement, /suspended_until/);
assert.match(enforcement, /forceSignOut/);
assert.match(enforcement, /warning/);
assert.match(enforcement, /subadmin/);

[
  "src/app/api/auth/session-status/route.ts",
  "src/app/api/account/warnings/ack/route.ts",
  "src/app/api/account/appeals/route.ts",
  "src/app/api/admin/appeals/[appealId]/decision/route.ts",
  "src/app/api/admin/invites/route.ts",
  "src/app/api/admin/users/moderation/route.ts",
  "src/app/api/admin/users/remove/route.ts",
  "src/app/api/auth/invite/complete/route.ts",
  "src/app/api/writing/category-suggestion/route.ts",
].forEach(assertExists);

const adminLib = read("src/lib/admin.ts");
assert.match(adminLib, /warnUserAccount/);
assert.match(adminLib, /suspendUserAccount/);
assert.match(adminLib, /banUserAccount/);
assert.match(adminLib, /restoreUserAccount/);
assert.match(adminLib, /inviteAdminTierAccount/);
assert.match(adminLib, /decideSuspensionAppeal/);
assert.match(adminLib, /removeAdminAccount/);
assert.match(adminLib, /session_version/);

const adminDashboard = read("src/components/admin/admin-dashboard-client.tsx");
assert.match(adminDashboard, /Warn/);
assert.match(adminDashboard, /Suspend/);
assert.match(adminDashboard, /Ban/);
assert.match(adminDashboard, /Restore/);
assert.match(adminDashboard, /Invite editor/);
assert.match(adminDashboard, /Invite admin/);
assert.match(adminDashboard, /Invite subadmin/);
assert.match(adminDashboard, /Appeals/);
assert.match(adminDashboard, /Accept/);
assert.match(adminDashboard, /Reject/);

const rail = read("src/components/reader/authenticated-rail.tsx");
assert.match(rail, /AccountStatusGate/);
assert.match(rail, /session-status/);
assert.match(rail, /warning/);
assert.match(rail, /signOut/);

[
  "src/app/auth/account-status/page.tsx",
  "src/components/auth/account-status-panel.tsx",
  "src/app/auth/invite/onboarding/page.tsx",
  "src/components/auth/invite-onboarding-panel.tsx",
].forEach(assertExists);

const email = assertExists("src/lib/email.ts");
assert.match(email, /sendModerationWarningEmail/);
assert.match(email, /sendSuspensionAppealSubmittedEmail/);
assert.match(email, /sendSuspensionAppealAcceptedEmail/);
assert.match(email, /sendSuspensionAppealRejectedEmail/);
assert.match(email, /sendAdminInviteEmail/);
assert.match(email, /CampusPress AI/);

const categories = assertExists("src/lib/categories.ts");
assert.match(categories, /Student Government/);
assert.match(categories, /canonicalCategories/);
assert.match(categories, /categorySuggestionSchema/);

const onboarding = read("src/lib/onboarding.ts");
assert.match(onboarding, /canonicalCategories/);
assert.match(onboarding, /subadmin/);

const writer = read("src/components/writer/writer-workspace.tsx");
assert.match(writer, /category_id/);
assert.match(writer, /Category/);
assert.match(writer, /Suggest category/);
assert.match(writer, /category-suggestion/);
assert.match(writer, /AI suggestion/);

const signup = read("src/app/api/auth/signup/route.ts");
assert.match(signup, /account_status/);
assert.match(signup, /banned/);
assert.match(signup, /permanently banned/);

const inviteComplete = read("src/app/api/auth/invite/complete/route.ts");
assert.match(inviteComplete, /onboarding_completed_at/);
assert.match(inviteComplete, /orientation/);

const docs = read("TODO_BEFORE_DEFENSE.md");
assert.match(docs, /Video\/Reels/i);
assert.match(docs, /deliberately deferred/i);

console.log(
  JSON.stringify(
    {
      moderationSchema: true,
      sessionInvalidationContracts: true,
      warningSuspensionBanUi: true,
      appealFlowContracts: true,
      adminInviteContracts: true,
      categoryAssignmentContracts: true,
      defenseScopeNote: true,
    },
    null,
    2,
  ),
);
