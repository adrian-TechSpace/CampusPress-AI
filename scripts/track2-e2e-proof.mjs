import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.TRACK2_APP_URL || "http://127.0.0.1:3001";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-8);
const outDir = `C:/tmp/campuspress-track2-e2e-${runId}`;

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");
assert.ok(cronSecret, "Missing CRON_SECRET for invite-link proof header");

await mkdir(outDir, { recursive: true });
const idCardPath = `${outDir}/track2-id-card.png`;
await writeFile(
  idCardPath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l3v2LwAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = {
  users: [],
  emails: [],
  appealPhotoPaths: [],
  articles: [],
};
const evidence = {
  appUrl,
  migrationAlreadyApplied: true,
  screenshots: [],
  emails: {},
};

const browser = await chromium.launch({ headless: true });

try {
  const fullAdmin = await createProfile("admin", "Track Two Full Admin", 1);
  const warnUser = await createProfile("reader", "Track Two Warning Reader", 2);
  const openTabUser = await createProfile("reader", "Track Two Open Tab Reader", 3);
  const acceptedAppealUser = await createProfile("reader", "Track Two Accepted Appeal", 4);
  const rejectedAppealUser = await createProfile("reader", "Track Two Rejected Appeal", 5);
  const categoryUser = await createProfile("journalist", "Track Two Category Writer", 6);

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, fullAdmin, /\/dashboard\/admin/);
  await adminPage.getByTestId("admin-dashboard").waitFor({ timeout: 30000 });
  const adminToken = await browserAccessToken(adminPage);
  evidence.adminDashboardLoaded = true;

  await verifyWarning(adminPage, warnUser);
  await verifyOpenTabSuspension(openTabUser, adminToken);
  await verifyAppealDecision(adminPage, acceptedAppealUser, adminToken, "accept");
  await verifyAppealDecision(adminPage, rejectedAppealUser, adminToken, "reject");
  await verifyInviteOnboarding(adminToken);
  await verifyCategorySuggestion(categoryUser);

  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  console.error(JSON.stringify({ evidence, error: error instanceof Error ? error.message : String(error) }, null, 2));
  throw error;
} finally {
  await browser.close().catch(() => {});
  if (process.env.TRACK2_KEEP_TEST_DATA !== "1") {
    await cleanup();
  }
}

async function verifyWarning(adminPage, user) {
  await adminPage.goto(`${appUrl}/dashboard/admin`, { waitUntil: "networkidle" });
  await adminPage.getByRole("button", { name: `Warn ${user.fullName}` }).click();
  await adminPage.getByLabel("Plain-English note").fill(`Track 2 warning reason ${runId}. Review the platform rules.`);
  await adminPage.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expectText(adminPage, "User warned");

  const warnContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const warnPage = await warnContext.newPage();
  await signIn(warnPage, user, /\/dashboard\/reader/);
  await expectText(warnPage, "Rules violation warning");
  await warnPage.screenshot({ path: `${outDir}/warn-popup.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/warn-popup.png`);
  await warnPage.getByRole("button", { name: "I understand" }).click();
  await warnPage.getByText("Rules violation warning").waitFor({ state: "hidden" });

  const { data, error } = await admin
    .from("profiles")
    .select("account_status, warning_acknowledged_at")
    .eq("id", user.id)
    .single();
  assert.ifError(error);
  assert.equal(data.account_status, "active", "Warning dismissal should return account_status to active");
  assert.ok(data.warning_acknowledged_at, "Warning dismissal must set warning_acknowledged_at");
  await warnContext.close();
  evidence.warnDismissiblePopup = true;
}

async function verifyOpenTabSuspension(user, adminToken) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await signIn(page, user, /\/dashboard\/reader/);
  await page.getByTestId("reader-home").waitFor({ timeout: 30000 });
  const staleToken = await browserAccessToken(page);

  const suspend = await adminApi(adminToken, "/api/admin/users/moderation", {
    userId: user.id,
    action: "suspend",
    durationHours: 24,
    reasonCode: "misinformation",
    reason: `Track 2 open-tab suspension reason ${runId}.`,
  });
  assert.match(suspend.message, /sessions will stop/i);

  const directRejectionResponse = await fetch(`${appUrl}/api/auth/session-status`, {
    headers: { Authorization: `Bearer ${staleToken}` },
  });
  const directRejection = {
    route: "/api/auth/session-status",
    status: directRejectionResponse.status,
    body: await directRejectionResponse.json().catch(() => ({})),
  };
  assert.equal(directRejection.status, 403, "Stale open-tab session token must be rejected after suspension");
  assert.equal(directRejection.body.forceSignOut, true, "Rejected session-status response must include forceSignOut");

  const rejection = await page.evaluate(async (token) => {
    const response = await fetch("/api/auth/session-status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return {
      route: "/api/auth/session-status",
      status: response.status,
      body: await response.json().catch(() => ({})),
    };
  }, staleToken);
  assert.equal(rejection.status, 403, "Already-open tab request must be rejected after suspension");
  assert.equal(rejection.body.forceSignOut, true, "Browser rejected request must include forceSignOut");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForURL(/\/auth\/account-status/, { timeout: 20000 });
  await page.screenshot({ path: `${outDir}/open-tab-suspended.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/open-tab-suspended.png`);
  await context.close();
  evidence.openTabNextRequestRejected = rejection;
}

async function verifyAppealDecision(adminPage, user, adminToken, decision) {
  const suspend = await adminApi(adminToken, "/api/admin/users/moderation", {
    userId: user.id,
    action: "suspend",
    durationHours: 72,
    reasonCode: "privacy",
    reason: `Track 2 ${decision} appeal suspension reason ${runId}.`,
  });
  assert.match(suspend.message, /suspended/i);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await signIn(page, user, /\/auth\/account-status/);
  await expectText(page, "Suspension appeal");
  evidence.lastAppealStoredStatus = await page.evaluate((currentDecision) => {
    const raw = window.sessionStorage.getItem("campuspress_account_status");
    const parsed = raw ? JSON.parse(raw) : null;
    const appealToken = parsed?.appealToken;
    return {
      decision: currentDecision,
      status: parsed?.status ?? null,
      sessionStale: parsed?.sessionStale ?? null,
      hasAppealToken: typeof appealToken === "string" && appealToken.length > 0,
      appealTokenPrefix: typeof appealToken === "string" ? appealToken.slice(0, 4) : null,
    };
  }, decision);
  await page.locator("textarea").first().fill(`Track 2 ${decision} appeal situation ${runId}.`);
  await page.getByRole("button", { name: "Next" }).click();
  await page.locator("textarea").nth(0).fill(
    `Track 2 ${decision} appeal explanation ${runId}. This explains the user situation clearly enough for admin review.`,
  );
  await page.locator("textarea").nth(1).fill(`Track 2 ${decision} appeal improvement plan ${runId}.`);
  await page.getByRole("button", { name: "Next" }).click();
  await page.locator('input[type="file"]').setInputFiles(idCardPath);
  await page.getByRole("button", { name: "Next" }).click();
  const submitResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/account/appeals") && response.request().method() === "POST",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Submit appeal" }).click();
  const submitResponse = await submitResponsePromise;
  const submitBody = await submitResponse.json().catch(() => ({}));
  evidence.lastAppealSubmit = { decision, status: submitResponse.status(), body: submitBody };
  assert.equal(submitResponse.status(), 200, `Appeal submit for ${decision} should return HTTP 200`);
  assert.equal(submitBody.ok, true, `Appeal submit for ${decision} should return ok true`);
  await expectText(page, "Appeal submitted");
  await page.screenshot({ path: `${outDir}/appeal-${decision}-submitted.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/appeal-${decision}-submitted.png`);

  const { data: appeal, error: appealError } = await admin
    .from("suspension_appeals")
    .select("id, id_photo_path, status")
    .eq("user_id", user.id)
    .eq("status", "submitted")
    .single();
  assert.ifError(appealError);
  ids.appealPhotoPaths.push(appeal.id_photo_path);

  await adminPage.goto(`${appUrl}/dashboard/admin`, { waitUntil: "networkidle" });
  const appealCard = adminPage.locator("article").filter({ hasText: user.fullName }).first();
  await appealCard.waitFor({ timeout: 30000 });
  await expectText(adminPage, "Open submitted ID photo");
  const responsePromise = adminPage.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/appeals/${appeal.id}/decision`) &&
      response.request().method() === "POST",
  );
  await appealCard.getByRole("button", { name: decision === "accept" ? "Accept" : "Reject" }).click();
  const response = await responsePromise;
  const result = await response.json();
  assert.equal(response.status(), 200, `Appeal ${decision} response must be 200`);
  assert.equal(result.ok, true, `Appeal ${decision} response must be ok`);
  assert.equal(result.email?.sent, true, `Appeal ${decision} must send branded email`);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("account_status, suspended_until, banned_at")
    .eq("id", user.id)
    .single();
  assert.ifError(profileError);

  if (decision === "accept") {
    assert.equal(profile.account_status, "active", "Accepted appeal must immediately restore account");
    assert.equal(profile.suspended_until, null, "Accepted appeal must clear suspended_until");
    evidence.acceptedAppealImmediateRestore = true;
    evidence.emails.acceptedAppeal = result.email;
  } else {
    assert.equal(profile.account_status, "banned", "Rejected appeal must permanently ban account");
    assert.ok(profile.banned_at, "Rejected appeal must set banned_at");
    evidence.rejectedAppealPermanentBan = true;
    evidence.emails.rejectedAppeal = result.email;
    await verifyBannedLoginMessage(page, user);
  }

  await context.close();
}

async function verifyBannedLoginMessage(page, user) {
  await page.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill(user.password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/auth\/account-status/, { timeout: 30000 });
  await expectText(page, "Account banned");
  await expectText(page, "No appeal option");
  await page.screenshot({ path: `${outDir}/banned-login-message.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/banned-login-message.png`);
  evidence.bannedLoginAttemptMessage = true;
}

async function verifyInviteOnboarding(adminToken) {
  const inviteEmail = plusAddress(testRecipient, `track2-invite-editor-${runId}`);
  ids.emails.push(inviteEmail);
  const result = await adminApi(
    adminToken,
    "/api/admin/invites",
    {
      email: inviteEmail,
      fullName: "Track Two Invited Editor",
      role: "editor",
    },
    { "x-track2-proof": cronSecret },
  );
  assert.ok(result.userId, "Invite route must create auth user");
  assert.ok(result.inviteUrl, "Secret proof header must expose inviteUrl for e2e");
  assert.equal(result.email?.sent, true, "Invite must send branded email");
  ids.users.push(result.userId);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(result.inviteUrl, { waitUntil: "networkidle" });
  evidence.inviteLanding = {
    url: sanitizeUrl(page.url()),
    text: (await page.locator("body").innerText().catch(() => "")).slice(0, 500),
  };
  await page.screenshot({ path: `${outDir}/invite-landing-before-setup.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/invite-landing-before-setup.png`);
  await expectText(page, "Complete setup");
  await expectText(page, "Your role is editor");
  assert.equal(await page.getByText("Reader", { exact: true }).count(), 0, "Invite onboarding must not show role picker");
  assert.equal(await page.getByText("Student journalist", { exact: true }).count(), 0, "Invite onboarding must not show public signup roles");
  await page.locator('input[autocomplete="new-password"]').fill(`Track2Invite${runId}!`);
  await page.getByRole("button", { name: "Create password" }).click();
  await expectText(page, "orientation");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Finish onboarding" }).click();
  await page.waitForURL(/\/dashboard\/editor/, { timeout: 30000 });

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role, onboarding_completed_at")
    .eq("id", result.userId)
    .single();
  assert.ifError(error);
  assert.equal(profile.role, "editor", "Invited account role must remain editor");
  assert.ok(profile.onboarding_completed_at, "Invite onboarding must set onboarding_completed_at");
  await page.screenshot({ path: `${outDir}/invited-editor-onboarded.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/invited-editor-onboarded.png`);
  await context.close();
  evidence.invitedEditorOnboarding = true;
  evidence.emails.invitedEditor = result.email;
}

async function verifyCategorySuggestion(user) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await signIn(page, user, /\/write/);
  await expectText(page, "Writing desk");
  await page.locator("textarea[placeholder='Headline']").fill(`Student government budget hearing ${runId}`);
  await page.getByPlaceholder("One-sentence summary for editors and readers").fill(
    "Student representatives debated campus budget priorities in a public session.",
  );
  await page.locator("#article-body").fill(
    "The student government council held a budget hearing where representatives asked departments to explain spending priorities, student welfare concerns, and election promises. The article quotes student leaders, tracks governance decisions, and explains what readers should watch next.",
  );
  await page.route("**/api/writing/category-suggestion", async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-track2-openai-debug": cronSecret,
      },
    });
  });

  const suggestionResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/writing/category-suggestion") && response.request().method() === "POST",
    { timeout: 45000 },
  );
  await page.getByRole("button", { name: "Suggest category" }).click();
  const suggestionResponse = await suggestionResponsePromise;
  const suggestionBody = await suggestionResponse.json().catch(() => ({}));
  evidence.openAiCategorySuggestionResponse = {
    status: suggestionResponse.status(),
    body: suggestionBody,
  };
  assert.equal(suggestionResponse.status(), 200, "OpenAI category suggestion route must return HTTP 200");
  assert.ok(suggestionBody.suggestion, "OpenAI category suggestion route must return a suggestion when OpenAI is reachable");
  await page.getByText("AI suggestion:", { exact: false }).waitFor({ timeout: 45000 });
  await page.screenshot({ path: `${outDir}/category-openai-suggestion.png`, fullPage: true });
  evidence.screenshots.push(`${outDir}/category-openai-suggestion.png`);
  evidence.openAiCategorySuggestion = await page.locator("text=AI suggestion:").first().innerText().catch(() => "AI suggestion shown");

  const token = await browserAccessToken(page);
  const fallback = await page.evaluate(async (authToken) => {
    const response = await fetch("/api/writing/category-suggestion", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "x-track2-openai-mode": "unavailable",
      },
      body: JSON.stringify({
        title: "Fallback category check",
        excerpt: "OpenAI unavailable should not alarm the writer.",
        body: "This is a fallback check.",
      }),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, token);
  assert.equal(fallback.status, 200, "OpenAI unavailable fallback route must return 200");
  assert.equal(fallback.body.ok, true, "OpenAI unavailable fallback route must be ok");
  assert.equal(fallback.body.suggestion, null, "OpenAI unavailable fallback must be silent with null suggestion");
  evidence.openAiUnavailableSilentFallback = fallback;
  await context.close();
}

async function signIn(page, user, expectedUrl) {
  await page.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill(user.password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(expectedUrl, { timeout: 30000 });
}

async function adminApi(token, path, body, extraHeaders = {}) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `${path} failed: ${json.message ?? response.statusText}`);
  assert.equal(json.ok, true, `${path} returned not ok: ${json.message ?? "unknown"}`);
  return json;
}

async function browserAccessToken(page) {
  return page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) {
          return parsed.access_token;
        }
      }
    }
    throw new Error("Supabase browser access token not found");
  });
}

async function createProfile(role, fullName, offset) {
  const email = plusAddress(testRecipient, `track2-${role}-${offset}-${runId}`);
  const password = `Track2${role}${runId}!`;
  const username = `t2_${role}_${offset}_${runId.slice(-5)}`.slice(0, 20);
  const sequence = String(Number(numericRunId.slice(-3)) + offset).padStart(3, "0").slice(-3);
  const matricOrStaffId = `MAS/2026/${sequence}`;
  const departmentCode = "MAS";

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { session_version: 0 },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, `Expected ${role} user id`);
  ids.users.push(userData.user.id);
  ids.emails.push(email);

  const { data: institution, error: institutionError } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();
  assert.ifError(institutionError);

  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    institution_id: institution.id,
    email,
    full_name: fullName,
    username,
    phone_number: `+23481${String(Number(numericRunId) + offset).padStart(7, "0").slice(-7)}`,
    role,
    department_code: departmentCode,
    entry_year: 2026,
    matric_or_staff_id: matricOrStaffId,
    bio: `${fullName} account for Track 2 verification.`,
    preferences: { interests: ["Campus News"], onboarding_complete: true },
  });
  assert.ifError(profileError);

  return {
    id: userData.user.id,
    email,
    password,
    username,
    role,
    fullName,
    matricOrStaffId,
  };
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 30000 });
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "TEST_EMAIL_RECIPIENT must be an email address");
  return `${local}+${tag}@${domain}`;
}

function sanitizeUrl(value) {
  return value
    .replace(/token_hash=[^&#]+/g, "token_hash=REDACTED")
    .replace(/access_token=[^&#]+/g, "access_token=REDACTED")
    .replace(/refresh_token=[^&#]+/g, "refresh_token=REDACTED");
}

async function cleanup() {
  await safeCleanup(() => admin.storage.from("appeal-ids").remove(ids.appealPhotoPaths));
  if (ids.users.length > 0) {
    await safeCleanup(() => admin.from("suspension_appeals").delete().in("user_id", ids.users));
    await safeCleanup(() => admin.from("moderation_actions").delete().in("target_user_id", ids.users));
    await safeCleanup(() => admin.from("moderation_actions").delete().in("actor_id", ids.users));
    await safeCleanup(() => admin.from("account_invitations").delete().in("auth_user_id", ids.users));
    await safeCleanup(() => admin.from("profiles").delete().in("id", ids.users));
  }
  if (ids.emails.length > 0) {
    await safeCleanup(() => admin.from("account_invitations").delete().in("email", ids.emails));
  }
  for (const userId of ids.users.reverse()) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  await anon.auth.signOut().catch(() => {});
}

async function safeCleanup(operation) {
  try {
    await operation();
  } catch {
    // Cleanup is best-effort because the script may fail before every table exists in the run.
  }
}
