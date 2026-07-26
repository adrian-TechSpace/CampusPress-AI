import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.PHASE8_APP_URL || "http://127.0.0.1:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);
const outDir = "C:/tmp/campuspress-phase8-admin";

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

await mkdir(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ids = {
  users: [],
  articles: [],
  comments: [],
  usage: [],
  payments: [],
  subscriptions: [],
  roster: [],
};
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
  const adminUser = await createProfile("admin", "Phase Eight Admin", 1);
  const journalist = await createProfile("journalist", "Phase Eight Journalist", 2);
  const reader = await createProfile("reader", "Phase Eight Reader", 3);
  const submittedArticle = await createArticle(journalist.id, "submitted", "admin moderation");
  const publishedArticle = await createArticle(journalist.id, "published", "comment moderation");
  const comment = await createComment(publishedArticle.id, reader.id);
  await createUsage(adminUser.id, submittedArticle.id);

  await signIn(page, adminUser);
  await page.getByTestId("admin-dashboard").waitFor({ timeout: 30000 });
  await expectText(page, "Platform controls");
  await expectText(page, "Roster CSV upload");
  await page.screenshot({ path: `${outDir}/admin-dashboard-1440-before.png`, fullPage: true });

  const rosterCsv = [
    "department_code,matric_or_staff_id,full_name,role",
    `MAS,${journalist.matricOrStaffId},${journalist.fullName},journalist`,
  ].join("\n");
  await page.locator("textarea").fill(rosterCsv);
  await page.getByRole("button", { name: "Upload roster CSV" }).click();
  await expectText(page, "Roster upload saved");
  const { data: verifiedProfile, error: verifiedError } = await admin
    .from("profiles")
    .select("verified, verified_at")
    .eq("id", journalist.id)
    .single();
  assert.ifError(verifiedError);
  assert.equal(verifiedProfile.verified, true, "Roster upload must verify the matching journalist");
  assert.ok(verifiedProfile.verified_at, "Roster upload must set verified_at");

  const rosterRows = await admin
    .from("institution_roster")
    .select("id")
    .eq("matric_or_staff_id", journalist.matricOrStaffId);
  assert.ifError(rosterRows.error);
  ids.roster.push(...(rosterRows.data ?? []).map((row) => row.id));

  await page.getByRole("button", { name: `Suspend ${reader.fullName}` }).click();
  await expectText(page, "User suspended.");
  const suspended = await profileSuspension(reader.id);
  assert.ok(suspended.suspended_at, "Suspension action must set suspended_at");

  await page.getByRole("button", { name: `Hide ${submittedArticle.title}` }).click();
  await expectText(page, "Article hidden from publication.");
  const hiddenArticle = await articleStatus(submittedArticle.id);
  assert.equal(hiddenArticle.status, "rejected", "Hide article action must reject the article");

  await page.getByRole("button", { name: `Hide comment ${comment.id}` }).click();
  await expectText(page, "Comment hidden.");
  const hiddenComment = await commentState(comment.id);
  assert.equal(hiddenComment.is_hidden, true, "Hide comment action must set is_hidden");

  await page.getByRole("button", { name: "Run Paystack test transaction" }).click();
  await expectText(page, "Local Paystack test payment completed.");
  const paymentRows = await admin
    .from("payments")
    .select("id, status, subscription_id")
    .eq("user_id", adminUser.id)
    .order("created_at", { ascending: false })
    .limit(1);
  assert.ifError(paymentRows.error);
  assert.equal(paymentRows.data?.[0]?.status, "succeeded", "Paystack test payment must complete");
  assert.ok(paymentRows.data?.[0]?.subscription_id, "Payment must link to a subscription");
  ids.payments.push(paymentRows.data[0].id);
  ids.subscriptions.push(paymentRows.data[0].subscription_id);

  await page.screenshot({ path: `${outDir}/admin-dashboard-1440-after.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${appUrl}/dashboard/admin`, { waitUntil: "networkidle" });
  await page.getByTestId("admin-dashboard").waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${outDir}/admin-dashboard-375.png`, fullPage: true });

  const relevantConsoleMessages = consoleMessages.filter(isRelevantConsoleMessage);
  assert.deepEqual(relevantConsoleMessages, [], `Unexpected console messages: ${relevantConsoleMessages.join("\n")}`);

  console.log(
    JSON.stringify(
      {
        appUrl,
        adminDashboardLoaded: true,
        rosterUploadVerifiedProfile: true,
        userSuspensionWorked: true,
        articleModerationWorked: true,
        commentModerationWorked: true,
        paystackTestPaymentCompleted: true,
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

async function signIn(targetPage, user) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(user.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(user.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(/\/dashboard\/admin/, { timeout: 30000 });
}

async function createProfile(role, fullName, offset) {
  const email = plusAddress(testRecipient, `phase8-${role}-${runId}`);
  const password = `Phase8${role}${runId}!`;
  const username = `p8_${role}_${runId.slice(-5)}`.slice(0, 20);
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
    phone_number: `+23480${String(Number(numericRunId) + offset).padStart(7, "0").slice(-7)}`,
    role,
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: matricOrStaffId,
    bio: `${fullName} account for Phase 8 verification.`,
    preferences: { interests: ["Campus news"], onboarding_complete: true },
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

async function createArticle(authorId, status, label) {
  const published = status === "published";
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 8 ${label} ${runId}`,
      slug: `phase8-${label.replace(/\s+/g, "-")}-${runId}`,
      excerpt: "A Phase 8 verification article.",
      content: { format: "rich-html-v1", html: `<p>Phase 8 ${label} body.</p>`, body: `Phase 8 ${label} body.` },
      plain_text: `Phase 8 ${label} body.`,
      status,
      submitted_at: new Date().toISOString(),
      reviewed_at: published ? new Date().toISOString() : null,
      published_at: published ? new Date().toISOString() : null,
    })
    .select("id, title, status")
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
      body: `Phase 8 moderation comment ${runId}`,
    })
    .select("id")
    .single();
  assert.ifError(error);
  ids.comments.push(data.id);
  return data;
}

async function createUsage(userId, articleId) {
  const { data, error } = await admin
    .from("ai_usage_log")
    .insert({
      user_id: userId,
      article_id: articleId,
      provider: "openai",
      model_name: "gpt-4.1-mini",
      prompt_tokens: 120,
      completion_tokens: 80,
      cost_cents: 1.25,
      status: "completed",
    })
    .select("id")
    .single();
  assert.ifError(error);
  ids.usage.push(data.id);
}

async function profileSuspension(userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("suspended_at")
    .eq("id", userId)
    .single();
  assert.ifError(error);
  return data;
}

async function articleStatus(articleId) {
  const { data, error } = await admin
    .from("articles")
    .select("status")
    .eq("id", articleId)
    .single();
  assert.ifError(error);
  return data;
}

async function commentState(commentId) {
  const { data, error } = await admin
    .from("comments")
    .select("is_hidden")
    .eq("id", commentId)
    .single();
  assert.ifError(error);
  return data;
}

async function expectText(targetPage, text) {
  await targetPage.getByText(text, { exact: false }).first().waitFor({ timeout: 30000 });
}

function isRelevantConsoleMessage(message) {
  if (/favicon/i.test(message)) {
    return false;
  }
  if (/was preloaded using link preload but not used within a few seconds/i.test(message)) {
    return false;
  }
  return true;
}

async function cleanup() {
  if (ids.subscriptions.length > 0) {
    await admin.from("subscriptions").delete().in("id", ids.subscriptions);
  }
  if (ids.payments.length > 0) {
    await admin.from("payments").delete().in("id", ids.payments);
  }
  if (ids.comments.length > 0) {
    await admin.from("comments").delete().in("id", ids.comments);
  }
  if (ids.usage.length > 0) {
    await admin.from("ai_usage_log").delete().in("id", ids.usage);
  }
  if (ids.articles.length > 0) {
    await admin.from("articles").delete().in("id", ids.articles);
  }
  if (ids.roster.length > 0) {
    await admin.from("institution_roster").delete().in("id", ids.roster);
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
