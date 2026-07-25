import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.PHASE6_APP_URL || "http://127.0.0.1:3000";
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);
const outDir = ".playwright-mcp/phase6-review-queue";

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

await mkdir(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = { users: [], articles: [] };
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
  const journalist = await createUser("journalist", "author");
  const blockedJournalist = await createUser("journalist", "blocked");
  const editor = await createUser("editor");
  const article = await createSubmittedArticle(journalist.id);
  ids.articles.push(article.id);
  await insertPartialAnalysis(article.id, editor.id);
  const rlsProof = await verifyNonEditorRouteDenials(blockedJournalist, article.id);

  await signInEditor(page, editor);
  await page.goto(`${appUrl}/dashboard/editor`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("editor-review-queue").waitFor({ timeout: 30000 });

  await expectVisibleText(page, article.title);
  await page.getByRole("button", { name: new RegExp(article.title) }).click();
  await expectVisibleText(page, "AI editorial judgment and verification pass are temporarily unavailable.");
  for (const label of [
    "HuggingFace fake-news signal",
    "Cardiff RoBERTa sentiment",
    "LanguageTool grammar",
    "pg_trgm originality",
    "TF-IDF relevance",
    "9-point credibility rules",
  ]) {
    await expectVisibleText(page, label);
  }
  await page.screenshot({ path: `${outDir}/editor-review-queue-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: "Submitted", exact: true }).click();
  await expectVisibleText(page, article.title);
  await page.getByRole("button", { name: "Highest risk first" }).click();
  await expectVisibleText(page, article.title);

  const revisionNote = `Please add a named student source and clarify the date before resubmitting. Phase 6 ${runId}`;
  await page.getByLabel("Decision note").fill(revisionNote);
  await page.getByRole("button", { name: "Request revision" }).click();
  await expectVisibleText(page, "Revision request sent to the journalist.");
  await expectVisibleText(page, "Revision requested");
  await page.screenshot({ path: `${outDir}/editor-review-queue-revision.png`, fullPage: true });

  const { data: updatedArticle, error: articleError } = await admin
    .from("articles")
    .select("status, editor_id, reviewed_at")
    .eq("id", article.id)
    .single();
  assert.ifError(articleError);
  assert.equal(updatedArticle.status, "revision_requested");
  assert.equal(updatedArticle.editor_id, editor.id);
  assert.ok(updatedArticle.reviewed_at, "Review action should set reviewed_at");

  const { data: messages, error: messageError } = await admin
    .from("messages")
    .select("body")
    .eq("article_id", article.id)
    .eq("recipient_id", journalist.id);
  assert.ifError(messageError);
  assert.ok(messages.some((message) => message.body.includes(revisionNote)), "Revision request must reach the journalist as a message");

  const { data: notifications, error: notificationError } = await admin
    .from("notifications")
    .select("title, body")
    .eq("article_id", article.id)
    .eq("user_id", journalist.id);
  assert.ifError(notificationError);
  assert.ok(
    notifications.some((notification) => /revision/i.test(notification.title) && notification.body.includes("clear, specific next steps")),
    "Revision request must create a plain-English journalist notification",
  );

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${appUrl}/dashboard/editor`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("editor-review-queue").waitFor({ timeout: 30000 });
  await expectVisibleText(page, article.title);
  await page.getByRole("button", { name: new RegExp(article.title) }).click();
  await expectVisibleText(page, "AI editorial judgment and verification pass are temporarily unavailable.");
  await page.screenshot({ path: `${outDir}/editor-review-queue-mobile.png`, fullPage: true });

  const relevantConsoleMessages = consoleMessages.filter((message) => !/favicon/i.test(message));
  assert.deepEqual(relevantConsoleMessages, [], `Unexpected console messages: ${relevantConsoleMessages.join("\n")}`);

  console.log(
    JSON.stringify(
      {
        appUrl,
        articleId: article.id,
        partialOpenAiStateRendered: true,
        sixWorkingSignalsRendered: true,
        queueFilteringAndSortingRendered: true,
        revisionRequestUpdatedArticle: true,
        revisionMessageCreated: true,
        revisionNotificationCreated: true,
        nonEditorReviewQueueDenied: rlsProof.reviewQueueDenied,
        nonEditorOtherJournalistReportDenied: rlsProof.analysisReportDenied,
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
  if (process.env.PHASE6_KEEP_TEST_DATA !== "1") {
    await cleanup();
  }
}

async function createUser(role, label = role) {
  const email = plusAddress(testRecipient, `phase6-${label}-${runId}`);
  const password = `Phase6${role[0].toUpperCase()}${role.slice(1)}${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Phase Six ${role}` },
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

  const identifierSeed = role === "editor" ? 700 : label === "blocked" ? 650 : 600;
  const roleSlug = role === "editor" ? "ed" : label === "blocked" ? "bj" : "jr";
  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    institution_id: institution.id,
    email,
    full_name: `Phase Six ${role}`,
    username: `p6_${roleSlug}_${runId.slice(-6)}`,
    phone_number:
      role === "editor"
        ? `+23487${numericRunId}`
        : label === "blocked"
          ? `+23485${numericRunId}`
          : `+23486${numericRunId}`,
    role,
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: `MAS/2024/${String(identifierSeed + (Number(numericRunId.slice(-2)) % 80)).padStart(3, "0")}`,
    preferences: {
      interests: ["Campus news"],
      onboarding_complete: true,
    },
  });
  assert.ifError(profileError);

  return { id: userData.user.id, email, password };
}

async function verifyNonEditorRouteDenials(nonEditor, otherJournalistArticleId) {
  const session = await signIn(nonEditor.email, nonEditor.password);

  const reviewQueueResponse = await fetch(`${appUrl}/api/editor/review-queue`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const reviewQueueBody = await reviewQueueResponse.json().catch(() => ({}));
  assert.equal(
    reviewQueueResponse.status,
    403,
    `Non-editor review queue API request should be denied: ${JSON.stringify(reviewQueueBody)}`,
  );

  const reportResponse = await fetch(
    `${appUrl}/api/analysis/report?articleId=${encodeURIComponent(otherJournalistArticleId)}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );
  const reportBody = await reportResponse.json().catch(() => ({}));
  assert.equal(
    reportResponse.status,
    403,
    `Non-editor analysis report request should be denied: ${JSON.stringify(reportBody)}`,
  );

  return {
    reviewQueueDenied: true,
    analysisReportDenied: true,
  };
}

async function signIn(email, password) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.session, "Expected test user session");
  return data.session;
}

async function createSubmittedArticle(authorId) {
  const text = [
    "Chrisland University students interviewed two class representatives about proposed library hours.",
    "The report says the plan was discussed on Monday and includes context from the Students Affairs office.",
    "One source said the proposal is still under review, while another student asked for weekend access during examinations.",
    "The article avoids claiming that a final decision has already been made.",
  ].join(" ");

  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 6 editorial queue article ${runId}`,
      slug: `phase-6-editorial-queue-article-${runId}`,
      excerpt: "A submitted article used to verify the editor review queue.",
      content: { format: "rich-html-v1", html: `<p>${text}</p>`, body: text },
      plain_text: text,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id, title")
    .single();
  assert.ifError(error);
  return data;
}

async function insertPartialAnalysis(articleId, requestedBy) {
  const now = new Date().toISOString();
  const rows = [
    completedRow(articleId, requestedBy, "huggingface_fake_news", "huggingface", "mrm8488/bert-tiny-finetuned-fake-news-detection", "fake-news", "The model did not flag the article as likely fake news.", 0.84, 82),
    completedRow(articleId, requestedBy, "cardiff_sentiment", "huggingface", "cardiffnlp/twitter-roberta-base-sentiment-latest", "sentiment", "The article reads as neutral to slightly positive.", 0.78, 76),
    completedRow(articleId, requestedBy, "languagetool", "languagetool", "languagetool-public-en-US", "grammar", "LanguageTool found minor grammar issues only.", 0.73, 74),
    completedRow(articleId, requestedBy, "pg_trgm_originality", "supabase", "pg_trgm.similarity", "originality", "No close published match was found.", 0.88, 90),
    completedRow(articleId, requestedBy, "tfidf_relevance", "local", "campuspress-tfidf-v1", "tf-idf", "The article matches campus-news reader interests.", 0.7, 72),
    completedRow(articleId, requestedBy, "rule_credibility", "local", "campuspress-9-point-credibility", "rule-based", "The rule-based checklist mostly clears the article.", 0.81, 80),
    failedRow(articleId, requestedBy, "openai_editorial", "llm-editorial"),
    failedRow(articleId, requestedBy, "openai_verification", "llm-verification"),
  ].map((row) => ({ ...row, started_at: now, completed_at: now, created_at: now }));

  const { error } = await admin.from("ai_analyses").insert(rows);
  assert.ifError(error);
}

function completedRow(articleId, requestedBy, key, provider, modelName, modelFamily, verdict, confidence, score) {
  return {
    article_id: articleId,
    requested_by: requestedBy,
    provider,
    model_name: modelName,
    model_family: modelFamily,
    status: "completed",
    verdict,
    confidence,
    score,
    flagged_sentences: [
      {
        text: "The report says the plan was discussed on Monday.",
        reason: `${key} evidence check completed.`,
      },
    ],
    raw_output: {
      key,
      disclosure: null,
      output: { verification: "seeded phase 6 evidence" },
    },
    error_message: null,
  };
}

function failedRow(articleId, requestedBy, key, modelFamily) {
  return {
    article_id: articleId,
    requested_by: requestedBy,
    provider: "openai",
    model_name: "gpt-4.1-mini",
    model_family: modelFamily,
    status: "failed",
    verdict: "This check did not complete.",
    confidence: null,
    score: null,
    flagged_sentences: [],
    raw_output: {
      key,
      disclosure: "This OpenAI-dependent check is temporarily unavailable.",
      output: {},
    },
    error_message: "The AI editorial judgment and verification pass are temporarily unavailable.",
  };
}

async function signInEditor(targetPage, editor) {
  await targetPage.goto(`${appUrl}/auth?mode=login`, { waitUntil: "domcontentloaded" });
  await targetPage.getByLabel("Email").fill(editor.email);
  await targetPage.locator('input[autocomplete="current-password"]').fill(editor.password);
  await targetPage.locator("form").getByRole("button", { name: "Sign in" }).click();
  await targetPage.waitForURL(/\/dashboard\/editor/, { timeout: 30000 });
}

async function expectVisibleText(targetPage, text) {
  await targetPage.getByText(text, { exact: false }).first().waitFor({ timeout: 30000 });
}

async function cleanup() {
  if (ids.articles.length > 0) {
    await admin.from("messages").delete().in("article_id", ids.articles);
    await admin.from("notifications").delete().in("article_id", ids.articles);
    await admin.from("ai_analyses").delete().in("article_id", ids.articles);
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
