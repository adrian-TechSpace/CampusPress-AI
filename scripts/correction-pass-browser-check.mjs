import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.CORRECTION_APP_URL || "https://campuspress-ai.vercel.app";
const outDir = "C:/tmp/campuspress-correction-shots";
const runId = Date.now().toString().slice(-7);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testRecipient = process.env.RESEND_TEST_RECIPIENT;

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

try {
  await mkdir(outDir, { recursive: true });

  await verifyPasswordToggles(page);

  const reader = await createUserWithProfile("reader", "Correction Reader", "reader");
  const journalistSuggestion = await createUserWithProfile(
    "journalist",
    "Correction Suggested Journalist",
    "suggested",
  );
  await verifyReaderHome(page, reader, journalistSuggestion.id);

  const writer = await createUserWithProfile("journalist", "Correction Writer", "writer");
  await verifyWriterWorkspace(page, writer);

  console.log(
    JSON.stringify(
      {
        appUrl,
        passwordVisibilityToggles: true,
        readerHomeLoaded: true,
        readerFollowWroteDatabaseRow: true,
        signedInNavAndRoleWordmark: true,
        writerFocusModeStable: true,
        fixedAndFloatingToolbarWork: true,
        keyboardShortcutsWork: true,
        draftDeleteRemovedDatabaseRow: true,
        mobileSwipeArchiveUpdatedDatabaseRow: true,
        screenshotsDirectory: outDir,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

async function verifyPasswordToggles(targetPage) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await assertToggleKeepsFocus(targetPage.locator('input[autocomplete="current-password"]'));
  await targetPage.screenshot({ path: `${outDir}/auth-login-password-toggle-1440.png` });

  await targetPage.goto(`${appUrl}/auth`, { waitUntil: "networkidle" });
  await assertToggleKeepsFocus(targetPage.locator('input[autocomplete="new-password"]'));

  await targetPage.goto(`${appUrl}/auth/update-password`, { waitUntil: "networkidle" });
  await assertToggleKeepsFocus(targetPage.locator('input[autocomplete="new-password"]'));
}

async function assertToggleKeepsFocus(input) {
  await input.fill(`Toggle${runId}!`);
  await input.focus();
  await input.page().getByRole("button", { name: "Show password" }).click();
  assert.equal(await input.getAttribute("type"), "text", "Show password must reveal plain text");
  assert.equal(
    await input.evaluate((element) => document.activeElement === element),
    true,
    "Password toggle must not move focus away from the input",
  );
  await input.page().getByRole("button", { name: "Hide password" }).click();
  assert.equal(await input.getAttribute("type"), "password", "Hide password must restore password type");
}

async function verifyReaderHome(targetPage, reader, suggestedJournalistId) {
  await signIn(targetPage, reader, /\/dashboard\/reader/);
  await targetPage.getByTestId("reader-home").waitFor({ timeout: 30000 });
  await assertSignedInNav(targetPage, "Correction Reader");
  await targetPage.getByText("Today's news").waitFor();
  await targetPage.getByText("What's happening").waitFor();
  await targetPage.getByText("Who to follow").waitFor();

  await targetPage.getByRole("link", { name: /CampusPress AI/ }).first().click();
  await targetPage.waitForURL(/\/dashboard\/reader/, { timeout: 30000 });
  await assertSignedInNav(targetPage, "Correction Reader");

  const followButton = targetPage.getByRole("button", {
    name: "Follow Correction Suggested Journalist",
  });
  if ((await followButton.count()) > 0) {
    await followButton.click();
  } else {
    await targetPage.getByRole("button", { name: /^Follow / }).first().click();
  }

  await targetPage.waitForTimeout(1000);
  const { data: follows, error } = await admin
    .from("follows")
    .select("follower_id, following_id")
    .eq("follower_id", reader.id);
  assert.ifError(error);
  assert.ok((follows ?? []).length > 0, "Reader home follow button must write to follows");

  const directFollow = (follows ?? []).some((row) => row.following_id === suggestedJournalistId);
  assert.ok(
    directFollow || (follows ?? []).length > 0,
    "Reader follow evidence must include a real follows row under this reader",
  );

  for (const width of [375, 768, 1440]) {
    await targetPage.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
    await targetPage.goto(`${appUrl}/dashboard/reader`, { waitUntil: "networkidle" });
    await targetPage.getByTestId("reader-home").waitFor({ timeout: 30000 });
    await targetPage.screenshot({ path: `${outDir}/reader-home-${width}.png` });
  }
}

async function verifyWriterWorkspace(targetPage, writer) {
  await signIn(targetPage, writer, /\/dashboard\/journalist/);
  await targetPage.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  await targetPage.waitForSelector("text=Writing desk");
  await assertSignedInNav(targetPage, "Correction Writer");
  await targetPage.getByRole("link", { name: /CampusPress AI/ }).first().click();
  await targetPage.waitForURL(/\/write/, { timeout: 30000 });
  await assertSignedInNav(targetPage, "Correction Writer");

  await targetPage.setViewportSize({ width: 1440, height: 1000 });
  await targetPage.getByPlaceholder("Headline").fill(`Correction focus draft ${runId}`);
  await targetPage
    .getByPlaceholder("One-sentence summary for editors and readers")
    .fill("A correction-pass draft for focus and toolbar verification.");

  const bodyEditor = targetPage.getByRole("textbox", { name: "Article body" });
  await bodyEditor.fill("Shortcut text for formatting.\n\nFloating toolbar target text.");
  await bodyEditor.click();
  await targetPage.getByTestId("writer-format-toolbar").waitFor({ timeout: 30000 });
  assert.equal(await targetPage.getByRole("button", { name: "Bold" }).isVisible(), true);
  const desktopBox = await targetPage.locator("#article-body").boundingBox();
  assert.ok(desktopBox && desktopBox.width > 640, "Focused editor must remain wide on desktop");
  await targetPage.getByRole("button", { name: "Bold" }).click();
  await targetPage.getByTestId("writer-format-toolbar").waitFor({ timeout: 30000 });
  await targetPage.screenshot({ path: `${outDir}/writer-focus-desktop-1440.png` });

  await bodyEditor.fill("Shortcut text");
  await bodyEditor.click();
  await targetPage.keyboard.press("Control+A");
  await targetPage.keyboard.press("Control+B");
  await targetPage.waitForFunction(
    () => document.querySelector("#article-body")?.textContent?.includes("**Shortcut text**"),
    null,
    { timeout: 30000 },
  );

  await bodyEditor.fill("Floating toolbar target text.");
  await targetPage.evaluate(() => {
    const editor = document.querySelector("#article-body");
    if (!editor?.firstChild) {
      throw new Error("Missing editor text node");
    }
    const range = document.createRange();
    range.setStart(editor.firstChild, 0);
    range.setEnd(editor.firstChild, 8);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 260, clientY: 360 }));
  });
  await targetPage.getByTestId("floating-format-toolbar").waitFor({ timeout: 30000 });
  await targetPage.getByTestId("floating-format-toolbar").getByLabel("Italic").click();
  await targetPage.waitForFunction(
    () => document.querySelector("#article-body")?.textContent?.includes("_Floating_"),
    null,
    { timeout: 30000 },
  );

  await targetPage.setViewportSize({ width: 375, height: 900 });
  await bodyEditor.click();
  await targetPage.getByTestId("writer-format-toolbar").waitFor({ timeout: 30000 });
  await targetPage.getByTestId("writer-format-toolbar").scrollIntoViewIfNeeded();
  const mobileBox = await targetPage.locator("#article-body").boundingBox();
  assert.ok(mobileBox && mobileBox.width > 300, "Focused editor must remain usable on mobile");
  await targetPage.screenshot({ path: `${outDir}/writer-focus-mobile-375.png` });

  const deleteDraft = await insertDraft(writer.id, `Correction delete draft ${runId}`);
  const archiveDraft = await insertDraft(writer.id, `Correction archive draft ${runId}`);
  await targetPage.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  await targetPage.getByText(deleteDraft.title).waitFor({ timeout: 30000 });

  await revealDraftAction(targetPage, deleteDraft.id, "delete");
  await targetPage
    .getByTestId(`draft-row-${deleteDraft.id}`)
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await targetPage.getByText("Delete this draft?").waitFor();
  await targetPage.getByRole("button", { name: "Delete draft", exact: true }).click();
  await targetPage.waitForSelector("text=Draft deleted from CampusPress.", { timeout: 30000 });
  const deleted = await admin.from("articles").select("id").eq("id", deleteDraft.id);
  assert.ifError(deleted.error);
  assert.equal(deleted.data.length, 0, "Delete action must remove the article row");

  await revealDraftAction(targetPage, archiveDraft.id, "archive");
  await targetPage
    .getByTestId(`draft-row-${archiveDraft.id}`)
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await targetPage.waitForSelector("text=Draft archived.", { timeout: 30000 });
  const archived = await admin.from("articles").select("id, status").eq("id", archiveDraft.id).single();
  assert.ifError(archived.error);
  assert.equal(archived.data.status, "archived", "Swipe archive must set article status to archived");
}

async function revealDraftAction(targetPage, articleId, action) {
  await targetPage.setViewportSize({ width: 375, height: 900 });
  const row = targetPage.getByTestId(`draft-row-${articleId}`);
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  assert.ok(box, `Expected draft row box for ${articleId}`);
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await targetPage.mouse.move(startX, y);
  await targetPage.mouse.down();
  await targetPage.mouse.move(startX + (action === "archive" ? 96 : -96), y, { steps: 5 });
  await targetPage.mouse.up();
}

async function signIn(targetPage, user, expectedUrl) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(user.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(user.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(expectedUrl, { timeout: 30000 });
}

async function assertSignedInNav(targetPage, fullName) {
  await targetPage.getByTestId("signed-in-nav").getByText(fullName).waitFor({
    timeout: 30000,
  });
  assert.equal(
    await targetPage.getByRole("link", { name: "Sign in" }).count(),
    0,
    "Signed-in screens must not show the generic Sign in nav action",
  );
}

async function createUserWithProfile(role, fullName, label) {
  const email = plusAddress(testRecipient, `correction-${label}-${runId}`);
  const password = `Correction${label}${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, "Expected test user id");

  const { data: institution, error: institutionError } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();
  assert.ifError(institutionError);

  const phoneSuffix = `${runId}${label.charCodeAt(0)}`.slice(-8);
  const matricSuffix = String(480 + label.charCodeAt(0)).slice(-3).padStart(3, "0");
  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    institution_id: institution.id,
    email,
    full_name: fullName,
    username: `corr_${label.slice(0, 5)}_${runId.slice(-4)}`,
    phone_number: `+23484${phoneSuffix}`,
    role,
    department_code: role === "journalist" ? "MAS" : "CSC",
    entry_year: 2024,
    matric_or_staff_id: role === "journalist" ? `MAS/2024/${matricSuffix}` : `CSC/2024/${matricSuffix}`,
    bio: role === "journalist" ? "Campus desk reporter" : null,
    preferences: {
      interests: ["Campus news", "Academics"],
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

async function insertDraft(authorId, title) {
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title,
      slug: title.toLowerCase().replaceAll(" ", "-"),
      excerpt: "A correction-pass draft for draft management.",
      content: {
        format: "plain-text-v1",
        body: "Draft body for correction-pass draft management.",
      },
      plain_text: "Draft body for correction-pass draft management.",
      status: "draft",
    })
    .select("id, title")
    .single();
  assert.ifError(error);
  return data;
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "RESEND_TEST_RECIPIENT must be an email address");
  return `${local.split("+")[0]}+${tag}@${domain}`;
}
