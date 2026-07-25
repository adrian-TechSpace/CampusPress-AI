import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.PHASE3_APP_URL || "https://campuspress-ai.vercel.app";
const outDir = "C:/tmp/campuspress-phase3-shots";
const runId = Date.now().toString().slice(-7);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(supabaseUrl);
assert.ok(anonKey);
assert.ok(serviceRoleKey);

await mkdir(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await verifySignupWizard(page);
  await verifyLoggedOutPrompt(page);
  const actionUser = await createBrowserActionUser();
  await verifyAuthenticatedReaderActions(page, actionUser);
  await captureScreenshotSet(page);

  console.log(
    JSON.stringify(
      {
        appUrl,
        wizardCompleted: true,
        loggedOutPromptShown: true,
        authenticatedReaderActionsClicked: true,
        screenshotsDirectory: outDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

async function verifySignupWizard(targetPage) {
  await targetPage.setViewportSize({ width: 1440, height: 1000 });
  await targetPage.goto(`${appUrl}/auth`, { waitUntil: "networkidle" });
  await targetPage.screenshot({ path: `${outDir}/auth-centered-1440.png` });

  await targetPage.getByLabel("Email").fill(`phase3-ui-${runId}@vooltgrouplimited.com`);
  await targetPage.locator('input[autocomplete="new-password"]').fill(`Phase3Ui${runId}!`);
  await targetPage.getByRole("button", { name: "Next" }).click();
  await targetPage.waitForSelector("text=Step 2 of 5");
  await targetPage.screenshot({ path: `${outDir}/auth-step-2-profile-1440.png` });

  await targetPage.getByLabel("Full name").fill("Phase Three Ui");
  await targetPage.getByLabel("Username").fill(`phase3ui_${runId.slice(-4)}`);
  await targetPage.getByLabel("Phone number").fill(`+234811${runId}`);
  await targetPage.waitForSelector("text=This username is available.");
  await targetPage.waitForSelector("text=This phone number is available.");
  await targetPage.getByRole("button", { name: "Next" }).click();
  await targetPage.waitForSelector("text=Step 3 of 5");
  await targetPage.screenshot({ path: `${outDir}/auth-step-3-institution-1440.png` });

  await targetPage.getByLabel("Department").selectOption("CSC");
  await targetPage.getByLabel("Entry year").fill("2024");
  await targetPage.getByLabel("Matric number or staff ID").fill("CSC/2024/401");
  await targetPage.waitForSelector("text=This matches the Chrisland ID format.");
  await targetPage.getByRole("button", { name: "Next" }).click();
  await targetPage.waitForSelector("text=Step 4 of 5");
  await targetPage.screenshot({ path: `${outDir}/auth-step-4-role-1440.png` });

  await targetPage.getByRole("button", { name: "Student journalist" }).click();
  await targetPage.getByRole("button", { name: "Next" }).click();
  await targetPage.waitForSelector("text=Step 5 of 5");
  await targetPage.screenshot({ path: `${outDir}/auth-step-5-interests-1440.png` });

  await targetPage.getByRole("button", { name: "Create account" }).click();
  await targetPage.waitForSelector(
    "text=Account created. Check your email to confirm it before signing in.",
    {
    timeout: 30000,
    },
  );
  await targetPage.screenshot({ path: `${outDir}/auth-wizard-complete-1440.png` });
}

async function verifyLoggedOutPrompt(targetPage) {
  await context.clearCookies();
  await targetPage.evaluate(() => window.localStorage.clear());
  await targetPage.goto(`${appUrl}/articles/inside-chrisland-student-newsroom`, {
    waitUntil: "networkidle",
  });
  await targetPage.getByRole("button", { name: "Save" }).scrollIntoViewIfNeeded();
  await targetPage.getByRole("button", { name: "Save" }).click();
  await targetPage.waitForSelector("text=Sign in or create an account to save this story.");
  await targetPage.screenshot({ path: `${outDir}/article-logged-out-prompt-1440.png` });
}

async function verifyAuthenticatedReaderActions(targetPage, actionUser) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(actionUser.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(actionUser.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(/\/dashboard\/reader/, { timeout: 30000 });
  await assertSignedInNav(targetPage, "Phase Three Browser");

  await targetPage.goto(`${appUrl}/feed`, { waitUntil: "networkidle" });
  await assertSignedInNav(targetPage, "Phase Three Browser");

  await targetPage.goto(`${appUrl}/articles/inside-chrisland-student-newsroom`, {
    waitUntil: "networkidle",
  });
  await assertSignedInNav(targetPage, "Phase Three Browser");
  await targetPage.locator('aside a[href="/dashboard/reader"]').first().click();
  await targetPage.waitForURL(/\/dashboard\/reader/, { timeout: 30000 });
  await assertSignedInNav(targetPage, "Phase Three Browser");

  await targetPage.goto(`${appUrl}/articles/inside-chrisland-student-newsroom`, {
    waitUntil: "networkidle",
  });
  await targetPage.getByRole("button", { name: "Save" }).scrollIntoViewIfNeeded();
  await targetPage.getByRole("button", { name: "Save" }).click();
  await targetPage.waitForSelector("text=Story saved to bookmarks.");
  await targetPage.getByRole("button", { name: "Like" }).click();
  await targetPage.waitForSelector("text=Story liked.");
  await targetPage.getByRole("button", { name: "Follow" }).click();
  await targetPage.waitForSelector("text=Author followed.");
  await targetPage.getByLabel("Add a comment").fill(`Browser UI comment ${runId}`);
  await targetPage.getByRole("button", { name: "Post comment" }).click();
  await targetPage.waitForSelector("text=Comment posted.");
  await targetPage.screenshot({ path: `${outDir}/article-auth-actions-1440.png` });

  await targetPage.goto(`${appUrl}/bookmarks`, { waitUntil: "networkidle" });
  await assertSignedInNav(targetPage, "Phase Three Browser");
  await targetPage.waitForSelector("text=Inside the Student Newsroom Taking Shape at Chrisland");
  await targetPage.screenshot({ path: `${outDir}/bookmarks-authenticated-1440.png` });

  await targetPage.goto(`${appUrl}/following`, { waitUntil: "networkidle" });
  await assertSignedInNav(targetPage, "Phase Three Browser");
  await targetPage.waitForSelector("text=Mara Adebayo");
  await targetPage.screenshot({ path: `${outDir}/following-authenticated-1440.png` });
}

async function assertSignedInNav(targetPage, fullName) {
  await targetPage.getByTestId("signed-in-nav").waitFor({
    timeout: 30000,
  });
  await targetPage.locator("aside").first().hover();
  await targetPage.getByTestId("signed-in-nav").getByText(fullName).waitFor({
    timeout: 30000,
  });
  assert.equal(
    await targetPage.getByRole("link", { name: "Sign in" }).count(),
    0,
    "Signed-in pages must not show the generic Sign in nav action",
  );
}

async function captureScreenshotSet(targetPage) {
  const routes = [
    ["landing", "/"],
    ["auth", "/auth"],
    ["feed", "/feed"],
    ["article", "/articles/inside-chrisland-student-newsroom"],
    ["search", "/search"],
    ["bookmarks", "/bookmarks"],
    ["following", "/following"],
    ["notifications", "/notifications"],
  ];
  const widths = [375, 768, 1440];

  for (const [name, path] of routes) {
    for (const width of widths) {
      await targetPage.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 900,
      });
      await targetPage.goto(`${appUrl}${path}`, { waitUntil: "networkidle" });
      await targetPage.screenshot({
        path: `${outDir}/${name}-${width}.png`,
      });
    }
  }

  await targetPage.setViewportSize({ width: 1440, height: 1000 });
  await targetPage.goto(appUrl, { waitUntil: "networkidle" });
  await targetPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await targetPage.screenshot({ path: `${outDir}/landing-footer-1440.png` });
}

async function createBrowserActionUser() {
  const email = `phase3-browser-actions-${runId}@vooltgrouplimited.com`;
  const password = `Phase3Browser${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Phase Three Browser" },
  });
  assert.ifError(userError);
  assert.ok(userData.user);

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
    full_name: "Phase Three Browser",
    username: `phase3browser_${runId.slice(-4)}`,
    phone_number: `+234812${runId}`,
    role: "reader",
    department_code: "CSC",
    entry_year: 2024,
    matric_or_staff_id: "CSC/2024/402",
    preferences: {
      interests: ["Campus news"],
      onboarding_complete: true,
    },
  });
  assert.ifError(profileError);

  return { email, password };
}
