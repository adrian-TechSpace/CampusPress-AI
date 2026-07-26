import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.PHASE7_APP_URL || "http://127.0.0.1:3000";
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);
const outDir = "C:/tmp/campuspress-phase7-profile-chip";

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

await mkdir(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ids = { users: [], articles: [], roster: [] };
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
  const journalist = await createJournalist();
  await createPublishedArticle(journalist.id);

  await signIn(page, journalist);
  await page.getByTestId("signed-in-nav").waitFor({ timeout: 30000 });
  await page.locator("aside").first().hover();
  await page.getByRole("link", { name: `Open ${journalist.fullName} profile` }).click();
  await page.waitForURL(`${appUrl}/portfolio/${journalist.username}`, { timeout: 30000 });
  await page.getByTestId("journalist-portfolio").waitFor({ timeout: 30000 });
  await page.getByRole("heading", { name: journalist.fullName }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${outDir}/profile-chip-portfolio-1440.png`, fullPage: true });

  const relevantConsoleMessages = consoleMessages.filter(isRelevantConsoleMessage);
  assert.deepEqual(relevantConsoleMessages, [], `Unexpected console messages: ${relevantConsoleMessages.join("\n")}`);

  console.log(
    JSON.stringify(
      {
        appUrl,
        signedInAs: journalist.email,
        username: journalist.username,
        clickedProfileChip: true,
        landedOnOwnPortfolio: page.url() === `${appUrl}/portfolio/${journalist.username}`,
        portfolioUrl: `${appUrl}/portfolio/${journalist.username}`,
        screenshot: `${outDir}/profile-chip-portfolio-1440.png`,
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
  if (process.env.PHASE7_KEEP_TEST_DATA !== "1") {
    await cleanup();
  }
}

async function signIn(targetPage, user) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(user.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(user.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(/\/dashboard\/journalist/, { timeout: 30000 });
}

async function createJournalist() {
  const email = plusAddress(testRecipient, `phase7-chip-${runId}`);
  const password = `Phase7ChipJournalist${runId}!`;
  const username = `p7_chip_${runId.slice(-6)}`;
  const sequence = `7${numericRunId.slice(-2)}`.padStart(3, "0");
  const matricOrStaffId = `MAS/2024/${sequence}`;
  const fullName = "Phase Seven Chip";

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, "Expected test journalist user id");
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
    phone_number: `+23481${numericRunId}`,
    role: "journalist",
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: matricOrStaffId,
    bio: "Phase Seven Chip reports on verified campus stories for rail verification.",
    preferences: {
      interests: ["Campus news"],
      onboarding_complete: true,
    },
  });
  assert.ifError(profileError);

  const { data: rosterRow, error: rosterError } = await admin
    .from("institution_roster")
    .insert({
      institution_id: institution.id,
      department_code: "MAS",
      matric_or_staff_id: matricOrStaffId,
      full_name: fullName,
      role: "journalist",
    })
    .select("id")
    .single();
  assert.ifError(rosterError);
  ids.roster.push(rosterRow.id);

  return {
    id: userData.user.id,
    email,
    password,
    username,
    fullName,
  };
}

async function createPublishedArticle(authorId) {
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 7 chip portfolio story ${runId}`,
      slug: `phase7-chip-portfolio-story-${runId}`,
      excerpt: "A published story created for profile-chip portfolio verification.",
      content: {
        format: "rich-html-v1",
        html: `<p>Published Phase 7 chip click-through evidence ${runId}</p>`,
        body: `Published Phase 7 chip click-through evidence ${runId}`,
      },
      plain_text: `Published Phase 7 chip click-through evidence ${runId}`,
      status: "published",
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert.ifError(error);
  ids.articles.push(data.id);
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
