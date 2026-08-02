import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const roleHomeLib = read("src/lib/role-home.ts");
const roleHomeClient = read("src/components/dashboard/role-home-client.tsx");
const dynamicDashboard = read("src/app/dashboard/[role]/page.tsx");
const editorPage = read("src/app/dashboard/editor/page.tsx");
const editorReviewPage = read("src/app/dashboard/editor/review/page.tsx");
const adminManagePage = read("src/app/dashboard/admin/manage/page.tsx");
const apiRoute = read("src/app/api/home/[role]/route.ts");
const rail = read("src/components/reader/authenticated-rail.tsx");
const dashboardIndex = read("src/app/dashboard/page.tsx");

assert.match(roleHomeLib, /loadRoleHome/, "Role home data loader is missing.");
assert.match(roleHomeLib, /loadJournalistHome/, "Journalist home loader is missing.");
assert.match(roleHomeLib, /loadEditorHome/, "Editor home loader is missing.");
assert.match(roleHomeLib, /loadAdminHome/, "Admin home loader is missing.");
assert.match(roleHomeLib, /ai_analyses/, "Journalist home must summarize AI report status.");
assert.match(roleHomeLib, /article_likes/, "Journalist home must summarize published engagement.");
assert.match(roleHomeLib, /loadEditorReviewQueue/, "Editor home should reuse review queue analytics.");
assert.match(roleHomeLib, /moderation_actions/, "Admin home must summarize moderation actions.");
assert.match(roleHomeLib, /suspension_appeals/, "Admin home must summarize pending appeals.");
assert.match(roleHomeLib, /institution_roster/, "Admin home must summarize roster status.");

assert.match(roleHomeClient, /data-testid=\{`\$\{role\}-home`\}/, "Role home UI needs stable test ids.");
assert.match(roleHomeClient, /Journalist home/, "Journalist home heading is missing.");
assert.match(roleHomeClient, /AI report status/, "Journalist AI report status widget is missing.");
assert.match(roleHomeClient, /Published engagement/, "Journalist engagement widget is missing.");
assert.match(roleHomeClient, /Editor home/, "Editor home heading is missing.");
assert.match(roleHomeClient, /Time-sensitive submissions/, "Editor time-sensitive widget is missing.");
assert.match(roleHomeClient, /Recently completed decisions/, "Editor decisions widget is missing.");
assert.match(roleHomeClient, /Admin home/, "Admin home heading is missing.");
assert.match(roleHomeClient, /Recent moderation actions/, "Admin moderation widget is missing.");
assert.match(roleHomeClient, /Roster upload status/, "Admin roster widget is missing.");

assert.match(apiRoute, /authenticateActiveRequest/, "Home API must authenticate requests.");
assert.match(apiRoute, /canOpenRoleHome/, "Home API must enforce the requested role.");
assert.match(apiRoute, /requestedRole === "admin"/, "Subadmin must be allowed through the admin home route.");

assert.match(dynamicDashboard, /RoleHomeClient role="admin"/, "Dynamic admin route must render the admin home.");
assert.match(dynamicDashboard, /RoleHomeClient role=\{typedRole\}/, "Journalist route must render the role home.");
assert.match(editorPage, /RoleHomeClient role="editor"/, "Editor dashboard must render editor home.");
assert.match(editorReviewPage, /EditorReviewQueueClient/, "Editor review queue must remain available on a deeper route.");
assert.match(adminManagePage, /AdminDashboardClient/, "Full admin dashboard must remain available on a deeper route.");
assert.match(rail, /return "\/dashboard\/journalist"/, "Journalist home rail link must not point straight to the writing desk.");
assert.doesNotMatch(dynamicDashboard + dashboardIndex, /placeholder|Phase 2 route confirmed/i, "Track 1 placeholder copy must be removed.");
assert.doesNotMatch(roleHomeClient, /\u2014/, "Generated home copy must not use em dashes.");

console.log(JSON.stringify({ ok: true, stage: "track3-stage3-role-homes" }, null, 2));

function read(path) {
  return readFileSync(path, "utf8");
}
