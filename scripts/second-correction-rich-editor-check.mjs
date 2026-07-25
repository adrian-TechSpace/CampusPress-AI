import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.SECOND_CORRECTION_APP_URL || "https://campuspress-ai.vercel.app";
const outDir = "C:/tmp/campuspress-second-correction-shots";
const runId = Date.now().toString().slice(-7);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testRecipient = process.env.RESEND_TEST_RECIPIENT;
const imagePath = resolve("assets/Chrisland University College of Law building.jpg");

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
const journalist = await createJournalist();
let articleId = null;
let slug = null;

try {
  await mkdir(outDir, { recursive: true });
  await signIn(page, journalist);
  await page.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  await page.getByTestId("signed-in-nav").waitFor();
  await page.locator("aside").first().hover();
  await page.getByTestId("signed-in-nav").getByText("Second Correction Writer").waitFor();
  assert.equal(await page.getByRole("link", { name: "Sign in" }).count(), 0);
  assert.equal(await page.locator("header nav").count(), 0, "Authenticated writer must not render guest top nav");

  await page.waitForTimeout(2600);
  const emptyRows = await articleRows(journalist.id);
  assert.equal(emptyRows.length, 0, "Empty untouched editor must not autosave an empty article row");

  const title = `Second correction rich article ${runId}`;
  await page.getByPlaceholder("Headline").fill(title);
  await page
    .getByPlaceholder("One-sentence summary for editors and readers")
    .fill("A full rich-text verification article for CampusPress AI.");

  const editor = page.getByRole("textbox", { name: "Article body" });
  await editor.click();

  await page.getByRole("button", { name: "Heading" }).click();
  await page.keyboard.type("Campus newsroom rich text check");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("Bold reporting detail");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Italic" }).click();
  await page.keyboard.type("Italic context note");
  await page.getByRole("button", { name: "Italic" }).click();
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Quote" }).click();
  await page.keyboard.type("A quoted source or observation belongs here.");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Bullet list" }).click();
  await page.keyboard.type("First campus detail");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second campus detail");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Numbered list" }).click();
  await page.keyboard.type("Verify the source");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Confirm the editor note");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  await page.keyboard.type(
    "This are a deliberately awkward sentence so LanguageTool can underline a real issue in rich text. " +
      "The article includes enough words for submission and describes how reporters gathered context, checked facts, and prepared a reader-ready campus story. " +
      "Editors can inspect the formatting, cover image, inline image, preview, and final published output without relying on markdown characters.",
  );

  await page.screenshot({ path: `${outDir}/01-rich-formatting-before-image.png`, fullPage: true });

  await page.getByRole("button", { name: "Insert image" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(imagePath);
  await page.waitForSelector("text=Image uploaded and inserted into the draft.", { timeout: 30000 });
  await page.locator("#article-body img").first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${outDir}/02-inline-image-rendered.png`, fullPage: true });

  await page.getByTestId("cover-image-button").scrollIntoViewIfNeeded();
  await page.getByTestId("cover-image-button").click({ force: true });
  await page.getByTestId("cover-image-modal").waitFor({ timeout: 30000 });
  await page.locator('input[type="file"]').last().setInputFiles(imagePath);
  await page.getByLabel("Alt text").fill("Chrisland campus cover image");
  await page.getByRole("button", { name: "Confirm cover image" }).click();
  await page.waitForSelector("text=Cover image uploaded.", { timeout: 30000 });
  await page.locator('img[alt="Chrisland campus cover image"]').first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${outDir}/03-cover-visible-in-editor.png`, fullPage: true });

  await page.getByRole("button", { name: "Preview" }).click();
  await page.waitForSelector("text=Preview only", { timeout: 30000 });
  await page.screenshot({ path: `${outDir}/04-preview-without-submit.png`, fullPage: true });
  let draft = await findArticleByTitle(journalist.id, title);
  assert.equal(draft.status, "draft", "Preview action must not submit or change draft status");
  await page.getByRole("button", { name: "Return to writing desk" }).click();

  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForSelector("text=Article submitted for editorial review.", { timeout: 30000 });
  draft = await findArticleByTitle(journalist.id, title);
  articleId = draft.id;
  slug = draft.slug;
  assert.equal(draft.status, "submitted");
  assert.match(draft.content?.html ?? "", /<h2/i, "Rich content must store a real heading");
  assert.match(draft.content?.html ?? "", /<(strong|b)>/i, "Rich content must store real bold markup");
  assert.match(draft.content?.html ?? "", /<(em|i)>/i, "Rich content must store real italic markup");
  assert.match(draft.content?.html ?? "", /<blockquote/i, "Rich content must store a real quote block");
  assert.match(draft.content?.html ?? "", /<ul/i, "Rich content must store a real unordered list");
  assert.match(draft.content?.html ?? "", /<ol/i, "Rich content must store a real ordered list");
  assert.match(draft.content?.html ?? "", /<img/i, "Rich content must store a real inline image");
  assert.doesNotMatch(draft.content?.html ?? "", /\*\*|## |> |\[Image:/, "Rich content must not store visible markdown syntax");
  assert.doesNotMatch(
    draft.plain_text,
    /Section heading|important detail|emphasis|Quoted source or observation|List item/,
    "Plain text must not include old placeholder content",
  );
  await page.screenshot({ path: `${outDir}/05-submitted-preview.png`, fullPage: true });

  await publishArticle(articleId);
  await page.goto(`${appUrl}/articles/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector(`text=${title}`, { timeout: 30000 });
  await page.locator(".reader-rich-body img").first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${outDir}/06-published-reader-render.png`, fullPage: true });

  const beforeDeleteCount = await articleRows(journalist.id);
  await page.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  await insertDraft(journalist.id, `Second correction delete check ${runId}`);
  await page.goto(`${appUrl}/write`, { waitUntil: "networkidle" });
  const deleteTitle = `Second correction delete check ${runId}`;
  await page.getByText(deleteTitle).waitFor({ timeout: 30000 });
  await page.getByText(deleteTitle).click();
  const deleteRow = page.getByTestId(/^draft-row-/).filter({ hasText: deleteTitle });
  await revealDeleteAction(page, deleteRow);
  await deleteRow.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();
  await page.waitForSelector("text=Draft deleted from CampusPress.", { timeout: 30000 });
  await page.waitForTimeout(2600);
  const afterDeleteRows = await articleRows(journalist.id);
  assert.equal(
    afterDeleteRows.length,
    beforeDeleteCount.length,
    "Deleting a draft must not recreate a new empty draft through autosave",
  );

  console.log(
    JSON.stringify(
      {
        appUrl,
        richTextFormattingVisible: true,
        noMarkdownStoredOrVisible: true,
        inlineImageRendered: true,
        emptyAutosaveSkipped: true,
        deleteDidNotRecreateEmptyDraft: true,
        coverVisibleInEditor: true,
        previewDidNotSubmit: true,
        submittedAndPublished: true,
        cleanedUp: true,
        screenshotsDirectory: outDir,
        publishedSlug: slug,
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
  await browser.close();
}

async function signIn(targetPage, user) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await targetPage.getByLabel("Email").fill(user.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(user.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(/\/dashboard\/journalist/, { timeout: 30000 });
}

async function createJournalist() {
  const email = plusAddress(testRecipient, `second-rich-${runId}`);
  const password = `SecondRich${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Second Correction Writer" },
  });
  assert.ifError(userError);

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
    full_name: "Second Correction Writer",
    username: `rich_${runId}`,
    phone_number: `+23487${runId}`,
    role: "journalist",
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: `MAS/2024/${String(Number(runId.slice(-3)) % 900).padStart(3, "0")}`,
    preferences: { interests: ["Campus news"], onboarding_complete: true },
  });
  assert.ifError(profileError);

  return { id: userData.user.id, email, password };
}

async function articleRows(authorId) {
  const { data, error } = await admin.from("articles").select("id, title, status").eq("author_id", authorId);
  assert.ifError(error);
  return data ?? [];
}

async function findArticleByTitle(authorId, title) {
  const { data, error } = await admin
    .from("articles")
    .select("id, title, slug, status, plain_text, content")
    .eq("author_id", authorId)
    .eq("title", title)
    .single();
  assert.ifError(error);
  return data;
}

async function insertDraft(authorId, title) {
  const { error } = await admin.from("articles").insert({
    author_id: authorId,
    title,
    slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${runId}`,
    excerpt: "Temporary deletion verification draft.",
    content: { format: "rich-html-v1", html: "<p>Temporary draft body.</p>", body: "Temporary draft body." },
    plain_text: "Temporary draft body.",
    status: "draft",
  });
  assert.ifError(error);
}

async function publishArticle(id) {
  const { error } = await admin
    .from("articles")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  assert.ifError(error);
}

async function cleanup() {
  if (journalist?.id) {
    await admin.from("articles").delete().eq("author_id", journalist.id);
    await admin.from("profiles").delete().eq("id", journalist.id);
    await admin.auth.admin.deleteUser(journalist.id);
    const list = await admin.storage.from("article-images").list(journalist.id);
    if (!list.error && list.data?.length) {
      await admin.storage
        .from("article-images")
        .remove(list.data.map((file) => `${journalist.id}/${file.name}`));
    }
  }
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "RESEND_TEST_RECIPIENT must be an email address");
  return `${local.split("+")[0]}+${tag}@${domain}`;
}

async function revealDeleteAction(targetPage, row) {
  await targetPage.setViewportSize({ width: 375, height: 900 });
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  assert.ok(box, "Expected draft row box");
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await targetPage.mouse.move(startX, y);
  await targetPage.mouse.down();
  await targetPage.mouse.move(startX - 96, y, { steps: 5 });
  await targetPage.mouse.up();
}
