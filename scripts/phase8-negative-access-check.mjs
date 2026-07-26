import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.PHASE8_APP_URL || "https://campuspress-ai.vercel.app";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);
const outDir = "C:/tmp/campuspress-phase8-negative-access";

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

await mkdir(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ids = { users: [], articles: [], comments: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const consoleMessages = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  }
});

try {
  const reader = await createProfile("reader", "Phase Eight Blocked Reader", 1);
  const journalist = await createProfile("journalist", "Phase Eight Blocked Journalist", 2);
  const article = await createArticle(journalist.id);
  const comment = await createComment(article.id, reader.id);

  const readerSession = await signInClient(reader);
  const journalistSession = await signInClient(journalist);

  await assertDashboardDenied(page, reader, "reader");
  await assertDashboardDenied(page, journalist, "journalist");

  for (const account of [
    { label: "reader", user: reader, session: readerSession },
    { label: "journalist", user: journalist, session: journalistSession },
  ]) {
    await assertForbiddenApi(account.label, account.session.access_token, "/api/admin/users/suspension", {
      userId: journalist.id,
      suspended: true,
      reason: "Negative access check should not be allowed.",
    });
    await assertForbiddenApi(account.label, account.session.access_token, "/api/admin/moderation", {
      targetType: "comment",
      targetId: comment.id,
      hidden: true,
    });
    await assertCannotReadAiUsage(account.label, account.session.access_token);
    await assertCannotTriggerRosterCrossCheck(account.label, account.session.access_token);
  }

  const relevantConsoleMessages = consoleMessages.filter(isRelevantConsoleMessage);
  assert.deepEqual(relevantConsoleMessages, [], `Unexpected console messages: ${relevantConsoleMessages.join("\n")}`);

  console.log(
    JSON.stringify(
      {
        appUrl,
        readerDashboardDenied: true,
        journalistDashboardDenied: true,
        readerSuspensionApiDenied: true,
        journalistSuspensionApiDenied: true,
        readerModerationApiDenied: true,
        journalistModerationApiDenied: true,
        readerAiUsageDenied: true,
        journalistAiUsageDenied: true,
        readerRosterRpcDenied: true,
        journalistRosterRpcDenied: true,
        screenshotsDirectory: outDir,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        url: page.url(),
        bodyText: await page.locator("body").innerText().catch(() => ""),
        consoleMessages,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  if (process.env.PHASE8_KEEP_TEST_DATA !== "1") {
    await cleanup();
  }
}

async function assertDashboardDenied(targetPage, user, label) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(user.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(user.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(new RegExp(`/dashboard/${label}`), { timeout: 30000 });
  await targetPage.goto(`${appUrl}/dashboard/admin`, { waitUntil: "networkidle" });
  await targetPage.getByText("Only administrators can use this workspace.", { exact: false }).waitFor({ timeout: 30000 });
  const bodyText = await targetPage.locator("body").innerText();
  assert.equal(bodyText.includes("Platform controls"), false, `${label} must not see admin dashboard controls`);
  await targetPage.screenshot({ path: `${outDir}/${label}-admin-denied.png`, fullPage: true });
  await targetPage.getByRole("button", { name: "Sign out" }).click();
  await targetPage.waitForURL(`${appUrl}/`, { timeout: 30000 });
}

async function assertForbiddenApi(label, token, path, payload) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  assert.equal(response.status, 403, `${label} must receive 403 from ${path}`);
  assert.equal(result.ok, false, `${label} ${path} response must be an explicit failure`);
}

async function assertCannotReadAiUsage(label, token) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.from("ai_usage_log").select("id").limit(1);
  assert.ifError(error);
  assert.equal((data ?? []).length, 0, `${label} must not read ai_usage_log rows`);
}

async function assertCannotTriggerRosterCrossCheck(label, token) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc("run_roster_cross_check", { target_profile_id: null });
  assert.ok(error, `${label} must not trigger run_roster_cross_check, received ${JSON.stringify(data)}`);
}

async function signInClient(user) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  assert.ifError(error);
  assert.ok(data.session?.access_token, `Expected session for ${user.email}`);
  return data.session;
}

async function createProfile(role, fullName, offset) {
  const email = plusAddress(testRecipient, `phase8-negative-${role}-${runId}`);
  const password = `Phase8Negative${role}${runId}!`;
  const username = `p8_neg_${role}_${runId.slice(-4)}`.slice(0, 20);
  const sequence = String(Number(numericRunId.slice(-3)) + offset).padStart(3, "0").slice(-3);
  const matricOrStaffId = `MAS/2024/${sequence}`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, `Expected ${role} user id`);
  ids.users.push(userData.user.id);

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
    phone_number: `+23479${String(Number(numericRunId) + offset).padStart(7, "0").slice(-7)}`,
    role,
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: matricOrStaffId,
    bio: `${fullName} account for Phase 8 negative access verification.`,
    preferences: { interests: ["Campus news"], onboarding_complete: true },
  });
  assert.ifError(profileError);

  return { id: userData.user.id, email, password, role, fullName };
}

async function createArticle(authorId) {
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 8 negative access article ${runId}`,
      slug: `phase8-negative-access-article-${runId}`,
      excerpt: "A Phase 8 negative access verification article.",
      content: { format: "rich-html-v1", html: `<p>Phase 8 negative access body.</p>`, body: "Phase 8 negative access body." },
      plain_text: "Phase 8 negative access body.",
      status: "published",
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert.ifError(error);
  ids.articles.push(data.id);
  return data;
}

async function createComment(articleId, authorId) {
  const { data, error } = await admin
    .from("comments")
    .insert({
      article_id: articleId,
      author_id: authorId,
      body: `Phase 8 negative access comment ${runId}`,
    })
    .select("id")
    .single();
  assert.ifError(error);
  ids.comments.push(data.id);
  return data;
}

function isRelevantConsoleMessage(message) {
  if (/favicon/i.test(message)) {
    return false;
  }
  if (/Failed to load resource: the server responded with a status of 403/i.test(message)) {
    return false;
  }
  if (/TypeError: Failed to fetch/i.test(message)) {
    return false;
  }
  return true;
}

async function cleanup() {
  if (ids.comments.length > 0) {
    await admin.from("comments").delete().in("id", ids.comments);
  }
  if (ids.articles.length > 0) {
    await admin.from("articles").delete().in("id", ids.articles);
  }
  if (ids.users.length > 0) {
    await admin.from("profiles").delete().in("id", ids.users);
    for (const id of ids.users) {
      await admin.auth.admin.deleteUser(id);
    }
  }
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "Test recipient must be an email address");
  return `${local.split("+")[0]}+${tag}@${domain}`;
}
