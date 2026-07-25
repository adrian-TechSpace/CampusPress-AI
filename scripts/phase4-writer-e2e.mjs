import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.PHASE4_APP_URL || "https://campuspress-ai.vercel.app";
const outDir = "C:/tmp/campuspress-phase4-shots";
const runId = Date.now().toString().slice(-7);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testRecipient = process.env.RESEND_TEST_RECIPIENT;
const testImagePath = resolve("assets/Chrisland University College of Law building.jpg");

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");
assert.ok(testRecipient, "Missing test recipient");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const writer = await createJournalist();

try {
  await mkdir(outDir, { recursive: true });
  await signIn(page, writer);
  await page.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Writing desk");
  await assertSignedInNav(page, "Phase Four Writer");
  await page.locator('aside a[href="/write"]').first().click();
  await page.waitForURL(/\/write/, { timeout: 30000 });
  await assertSignedInNav(page, "Phase Four Writer");

  const title = `Phase 4 autosave draft ${runId}`;
  const body = [
    "This are an test paragraph for the writing desk, and it is intentionally awkward so inline feedback has something useful to mark.",
    "The student journalist reports that the newsroom training session began with source checks, direct observation, and a clear explanation of what remains unconfirmed.",
    "The article continues with enough detail to pass the submission gate, including why readers need context, what the reporter saw, and which office should be contacted next.",
    "A final paragraph explains the next steps for editors, the audience value of the story, and the reason the draft should enter review before publication.",
  ].join("\n\n");

  await page.getByPlaceholder("Headline").fill(title);
  await page.getByPlaceholder("One-sentence summary for editors and readers").fill(
    "A test draft for Phase 4 writer autosave and submission.",
  );
  const bodyEditor = page.getByRole("textbox", { name: "Article body" });
  await bodyEditor.fill(body);
  await page.getByRole("button", { name: "Insert image" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(testImagePath);
  await page.waitForSelector("text=Image uploaded and inserted into the draft.", {
    timeout: 30000,
  });
  await page.waitForSelector("text=Draft saved to CampusPress.", { timeout: 30000 });
  await page.waitForSelector("text=Grammar feedback updated.", { timeout: 30000 });
  await page.waitForSelector("text=This are");

  const savedDraft = await findArticle(writer.id, title);
  assert.equal(savedDraft.status, "draft", "Autosaved article must remain a draft");
  assert.match(savedDraft.plain_text, /student journalist reports/i);

  await context.setOffline(true);
  await bodyEditor.fill(`${body}\n\nOffline queued sentence ${runId}.`);
  await page.waitForSelector("text=queued on this device", { timeout: 30000 });
  await context.setOffline(false);
  await page.waitForSelector("text=Draft saved to CampusPress.", { timeout: 30000 });

  const syncedDraft = await findArticle(writer.id, title);
  assert.match(syncedDraft.plain_text, /Offline queued sentence/);

  await page.locator("#article-body").blur();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForSelector("text=Choose a cover image", { timeout: 30000 });
  await page.locator('input[type="file"]').last().setInputFiles(testImagePath);
  await page.getByLabel("Alt text").fill("Chrisland campus cover image");
  await page.getByRole("button", { name: "Confirm cover image" }).click();
  await page.waitForSelector("text=Article submitted for editorial review.", {
    timeout: 30000,
  });
  const submittedDraft = await findArticle(writer.id, title);
  assert.equal(submittedDraft.status, "submitted", "Submitted article must enter review queue");
  assert.ok(submittedDraft.submitted_at, "Submitted article must have submitted_at");
  assert.ok(submittedDraft.featured_image_url, "Submitted article must store a cover image URL");

  await captureScreenshots(page, title);

  console.log(
    JSON.stringify(
      {
        appUrl,
        journalistLoginWorked: true,
        autosaveWroteArticle: savedDraft.status === "draft",
        offlineQueueSynced: /Offline queued sentence/.test(syncedDraft.plain_text),
        grammarFeedbackVisible: true,
        coverImageUploaded: Boolean(submittedDraft.featured_image_url),
        submittedForReview: submittedDraft.status === "submitted",
        screenshotsDirectory: outDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

async function signIn(targetPage, user) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(user.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(user.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(/\/dashboard\/journalist/, { timeout: 30000 });
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
    "Signed-in writer screens must not show the generic Sign in nav action",
  );
}

async function captureScreenshots(targetPage, title) {
  for (const width of [375, 768, 1440]) {
    await targetPage.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
    await targetPage.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
    await targetPage.getByText(title).click();
    await targetPage.locator("#article-body").waitFor({ timeout: 30000 });
    await targetPage.screenshot({ path: `${outDir}/write-${width}.png` });
  }

  await targetPage.setViewportSize({ width: 1440, height: 1000 });
  await targetPage.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  await targetPage.getByText(title).click();
  await targetPage.locator("#article-body").waitFor({ timeout: 30000 });
  await targetPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await targetPage.screenshot({ path: `${outDir}/write-feedback-1440.png` });
}

async function findArticle(authorId, title) {
  const { data, error } = await admin
    .from("articles")
    .select("id, title, status, plain_text, submitted_at, featured_image_url")
    .eq("author_id", authorId)
    .eq("title", title)
    .single();
  assert.ifError(error);
  return data;
}

async function createJournalist() {
  const email = plusAddress(testRecipient, `phase4-writer-${runId}`);
  const password = `Phase4Writer${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Phase Four Writer",
    },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, "Expected test journalist user");

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
    full_name: "Phase Four Writer",
    username: `phase4writer_${runId.slice(-4)}`,
    phone_number: `+234820${runId}`,
    role: "journalist",
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: "MAS/2024/410",
    preferences: {
      interests: ["Campus news", "Student life"],
      onboarding_complete: true,
    },
  });
  assert.ifError(profileError);

  return {
    id: userData.user.id,
    email,
    password,
  };
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "RESEND_TEST_RECIPIENT must be an email address");
  return `${local.split("+")[0]}+${tag}@${domain}`;
}
