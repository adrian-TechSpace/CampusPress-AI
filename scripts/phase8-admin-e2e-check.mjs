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
  await page.getByRole("button", { name: "Confirm roster CSV upload" }).click();
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

  await page.getByRole("button", { name: "Run Flutterwave test transaction" }).click();
  await page.waitForURL(/checkout(?:-v2\.dev-flutterwave|\.flutterwave)\.com|\/api\/flutterwave\/callback/, { timeout: 45000 });
  if (/checkout(?:-v2\.dev-flutterwave|\.flutterwave)\.com/.test(page.url())) {
    await completeFlutterwaveCheckout(page);
  }
  await page.waitForURL(/\/api\/flutterwave\/callback/, { timeout: 120000 });
  await expectText(page, "CampusPress payment verified");
  const paymentRows = await admin
    .from("payments")
    .select("id, provider, status, subscription_id")
    .eq("user_id", adminUser.id)
    .eq("provider", "flutterwave")
    .order("created_at", { ascending: false })
    .limit(1);
  assert.ifError(paymentRows.error);
  assert.equal(paymentRows.data?.[0]?.provider, "flutterwave", "Flutterwave test payment must use the Flutterwave provider");
  assert.equal(paymentRows.data?.[0]?.status, "succeeded", "Flutterwave test payment must complete");
  assert.ok(paymentRows.data?.[0]?.subscription_id, "Payment must link to a subscription");
  ids.payments.push(paymentRows.data[0].id);
  ids.subscriptions.push(paymentRows.data[0].subscription_id);
  const subscriptionRows = await admin
    .from("subscriptions")
    .select("id, provider, status")
    .eq("id", paymentRows.data[0].subscription_id)
    .single();
  assert.ifError(subscriptionRows.error);
  assert.equal(subscriptionRows.data.provider, "flutterwave", "Subscription must use the Flutterwave provider");
  assert.equal(subscriptionRows.data.status, "active", "Subscription must be active after Flutterwave verification");
  await page.goto(`${appUrl}/dashboard/admin`, { waitUntil: "networkidle" });
  await page.getByTestId("admin-dashboard").waitFor({ timeout: 30000 });
  await expectText(page, "Flutterwave monetisation scaffolding");

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
        flutterwaveTestPaymentCompleted: true,
        screenshotsDirectory: outDir,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: `${outDir}/phase8-failure.png`, fullPage: true }).catch(() => {});
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

async function completeFlutterwaveCheckout(targetPage) {
  const cardNumber = "5531886652142950";
  const expiry = "09/32";
  const cvv = "564";
  const pin = "3310";
  const otp = "12345";
  const checkoutFrame = await waitForCheckoutFrame(targetPage);

  if (process.env.PHASE8_DEBUG_CHECKOUT === "1") {
    console.log(JSON.stringify({ checkoutFrames: targetPage.frames().map((frame) => ({ name: frame.name(), url: frame.url() })) }, null, 2));
    const fields = await checkoutFrame.locator("input, button").evaluateAll((nodes) =>
      nodes.map((node) => ({
        tagName: node.tagName,
        name: node.getAttribute("name"),
        type: node.getAttribute("type"),
        placeholder: node.getAttribute("placeholder"),
        ariaLabel: node.getAttribute("aria-label"),
        text: node.textContent?.slice(0, 80) ?? "",
      })),
    );
    console.log(JSON.stringify({ checkoutFields: fields }, null, 2));
  }

  if (process.env.PHASE8_FLUTTERWAVE_METHOD === "bank-transfer") {
    await checkoutFrame.locator("body").click({ force: true, position: { x: 1105, y: 405 } });
    await targetPage.waitForTimeout(3000);
    if (!await clickFirstAvailable(checkoutFrame, [
      'button:has-text("Pay")',
      'button:has-text("Proceed")',
      'button:has-text("Confirm")',
      'button:has-text("I have made this bank transfer")',
      'button[type="submit"]',
    ], true)) {
      await targetPage.mouse.click(620, 730);
      await targetPage.waitForTimeout(3000);
      await targetPage.mouse.click(620, 840);
    }
    return;
  }

  await checkoutFrame.getByText(/card/i).first().click({ timeout: 30000 }).catch(() => {});
  const usedCoordinateCardEntry = !await fillFirstAvailable(checkoutFrame, [
    'input[name="card_number"]',
    'input[name="cardNumber"]',
    'input[name="cardno"]',
    'input[placeholder*="Card"]',
    'input[aria-label*="Card"]',
  ], cardNumber, true);

  if (usedCoordinateCardEntry) {
    await targetPage.mouse.click(540, 440);
    await targetPage.keyboard.press("Control+A");
    await typeCharacters(targetPage, cardNumber);
    await targetPage.mouse.click(480, 560);
    await typeCharacters(targetPage, expiry);
    await targetPage.mouse.click(690, 560);
    await targetPage.keyboard.press("Control+A");
    await typeCharacters(targetPage, cvv);
  }

  if (!usedCoordinateCardEntry && !await fillFirstAvailable(checkoutFrame, [
    'input[name="expiry"]',
    'input[name="expiry_date"]',
    'input[name="expiryMonth"]',
    'input[placeholder*="MM"]',
    'input[aria-label*="Expiry"]',
  ], expiry, true)) {
    await targetPage.mouse.click(500, 560);
    await targetPage.keyboard.press("Control+A");
    await typeCharacters(targetPage, expiry);
  }
  if (!usedCoordinateCardEntry && !await fillFirstAvailable(checkoutFrame, [
    'input[name="cvv"]',
    'input[name="cvvno"]',
    'input[placeholder*="CVV"]',
    'input[aria-label*="CVV"]',
  ], cvv, true)) {
    await targetPage.mouse.click(720, 560);
    await targetPage.keyboard.press("Control+A");
    await typeCharacters(targetPage, cvv);
  }
  if (!await clickFirstAvailable(checkoutFrame, [
    'button:has-text("Pay")',
    'button:has-text("Complete")',
    'button[type="submit"]',
  ], true)) {
    await targetPage.keyboard.press("Enter");
    await targetPage.waitForTimeout(1000);
    if (/checkout(?:-v2\.dev-flutterwave|\.flutterwave)\.com/.test(targetPage.url())) {
      await targetPage.mouse.click(620, 730);
    }
    await targetPage.waitForTimeout(1000);
    if (/checkout(?:-v2\.dev-flutterwave|\.flutterwave)\.com/.test(targetPage.url())) {
      await targetPage.mouse.click(620, 890);
    }
  }
  await targetPage.waitForTimeout(3000);
  if (await fillFirstAvailable(checkoutFrame, [
    'input[name="pin"]',
    'input[placeholder*="PIN"]',
    'input[aria-label*="PIN"]',
  ], pin, true)) {
    await clickFirstAvailable(checkoutFrame, [
      'button:has-text("Continue")',
      'button:has-text("Submit")',
      'button:has-text("Pay")',
      'button[type="submit"]',
    ], true);
  }
  await targetPage.waitForTimeout(3000);
  if (await fillFirstAvailable(checkoutFrame, [
    'input[name="otp"]',
    'input[placeholder*="OTP"]',
    'input[aria-label*="OTP"]',
  ], otp, true)) {
    await clickFirstAvailable(checkoutFrame, [
      'button:has-text("Continue")',
      'button:has-text("Submit")',
      'button:has-text("Validate")',
      'button[type="submit"]',
    ], true);
  }
}

async function waitForCheckoutFrame(targetPage) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const frame = targetPage.frame({ name: "checkout" }) ?? targetPage.frames().find((item) => /checkout-v3|checkout-v2|flutterwave/i.test(item.url()));
    if (frame) {
      return frame;
    }
    await targetPage.waitForTimeout(500);
  }
  throw new Error("Flutterwave checkout iframe did not load.");
}

async function fillFirstAvailable(targetPage, selectors, value, optional = false) {
  for (const selector of selectors) {
    const locator = targetPage.locator(selector).first();
    if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await locator.fill(value);
      return true;
    }
  }
  if (optional) {
    return false;
  }
  throw new Error(`Could not find a checkout field for ${selectors.join(", ")}`);
}

async function typeCharacters(targetPage, value) {
  for (const char of value) {
    await targetPage.keyboard.press(char);
    await targetPage.waitForTimeout(120);
  }
}

async function clickFirstAvailable(targetPage, selectors, optional = false) {
  for (const selector of selectors) {
    const locator = targetPage.locator(selector).first();
    if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await locator.click();
      return true;
    }
  }
  if (optional) {
    return false;
  }
  throw new Error(`Could not find a checkout button for ${selectors.join(", ")}`);
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
