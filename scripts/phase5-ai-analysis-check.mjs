import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://campuspress-ai.vercel.app";
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);
const screenshotsDirectory = "C:/tmp/campuspress-phase5-analysis";

assert.ok(supabaseUrl, "Supabase URL is required");
assert.ok(anonKey, "Supabase anon key is required");
assert.ok(serviceRoleKey, "Supabase service role key is required");
assert.ok(process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required");
assert.ok(process.env.HF_TOKEN, "HF_TOKEN is required");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = {
  users: [],
  articles: [],
};

try {
  await mkdir(screenshotsDirectory, { recursive: true });
  const journalist = await createUser("journalist");
  const editor = await createUser("editor");
  const corpusArticle = await createPublishedCorpusArticle(editor.id);
  ids.articles.push(corpusArticle.id);
  const article = await createSubmittedArticle(journalist.id);
  ids.articles.push(article.id);

  const journalistSession = await signIn(journalist.email, journalist.password);
  const response = await fetch(`${appUrl}/api/analysis/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${journalistSession.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ articleId: article.id }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);

  const { data: rows, error: rowsError } = await admin
    .from("ai_analyses")
    .select("provider, model_name, model_family, status, raw_output")
    .eq("article_id", article.id);
  assert.ifError(rowsError);

  const keys = new Set(rows.map((row) => row.raw_output?.key));
  const requiredKeys = [
    "openai_editorial",
    "openai_verification",
    "huggingface_fake_news",
    "cardiff_sentiment",
    "pg_trgm_originality",
    "rule_credibility",
    "flesch_kincaid",
    "languagetool",
    "tfidf_relevance",
  ];
  for (const key of requiredKeys) {
    assert.ok(keys.has(key), `Missing analysis signal ${key}`);
  }
  assert.equal(rows.filter((row) => row.status === "failed").length, 0, "No main analysis signal should fail");

  const { data: usageRows, error: usageError } = await admin
    .from("ai_usage_log")
    .select("provider, model_name, prompt_tokens, completion_tokens, cost_cents, status")
    .eq("article_id", article.id);
  assert.ifError(usageError);
  assert.ok(usageRows.some((row) => row.provider === "openai"), "OpenAI usage must be logged");
  assert.ok(usageRows.some((row) => row.provider === "huggingface"), "HuggingFace usage must be logged");

  const { data: jobRows, error: jobError } = await admin
    .from("job_run_log")
    .select("job_name, status, metadata")
    .eq("job_name", "article-analysis")
    .contains("metadata", { articleId: article.id })
    .order("started_at", { ascending: false })
    .limit(1);
  assert.ifError(jobError);
  assert.equal(jobRows?.[0]?.status, "completed");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await loginThroughUi(page, editor);
    await page.goto(`${appUrl}${body.reportUrl}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Ensemble verdict", { timeout: 30000 });
    await page.waitForSelector("text=Known limitation", { timeout: 30000 });
    await page.screenshot({ path: `${screenshotsDirectory}/report-1440.png`, fullPage: true });

    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector("text=Ensemble verdict", { timeout: 30000 });
      await page.screenshot({ path: `${screenshotsDirectory}/report-${width}.png`, fullPage: true });
    }
  } finally {
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        appUrl,
        articleId: article.id,
        allSignalsReturned: true,
        analysisRows: rows.length,
        usageRows: usageRows.length,
        jobRunLogged: true,
        reportRouteRenderedForEditor: true,
        screenshotsDirectory,
      },
      null,
      2,
    ),
  );
} finally {
  if (process.env.PHASE5_KEEP_TEST_DATA !== "1") {
    await cleanup();
  }
}

async function createUser(role) {
  const suffix = `${role}-${runId}`;
  const email = plusAddress(testRecipient, `phase5-${suffix}`);
  const password = `Phase5${role}${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Phase 5 ${role}` },
  });
  assert.ifError(userError);
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
    full_name: `Phase 5 ${role}`,
    username: `p5_${role}_${runId.slice(-5)}`,
    phone_number: `+23488${String(ids.users.length).padStart(2, "0")}${numericRunId}`,
    role,
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: `MAS/2024/${String(300 + ids.users.length).padStart(3, "0")}`,
    preferences: { interests: ["Campus news"], onboarding_complete: true },
  });
  assert.ifError(profileError);

  return { id: userData.user.id, email, password, role };
}

async function createPublishedCorpusArticle(authorId) {
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 5 corpus reference ${runId}`,
      slug: `phase-5-corpus-${runId}`,
      excerpt: "Reference article for similarity and TF-IDF checks.",
      content: { format: "rich-html-v1", html: `<p>${analysisText()}</p>`, body: analysisText() },
      plain_text: analysisText(),
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert.ifError(error);
  return data;
}

async function createSubmittedArticle(authorId) {
  const text = `${analysisText()} ${ambiguousText()}`;
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 5 AI analysis article ${runId}`,
      slug: `phase-5-ai-analysis-${runId}`,
      excerpt: "A deliberately detailed campus story for AI analysis verification.",
      content: { format: "rich-html-v1", html: `<p>${text}</p>`, body: text },
      plain_text: text,
      featured_image_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
      featured_image_alt: "Students on campus",
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert.ifError(error);
  return data;
}

async function signIn(email, password) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return data.session;
}

async function loginThroughUi(page, user) {
  await page.goto(`${appUrl}/auth?mode=login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill(user.password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/dashboard/${user.role}`), { timeout: 30000 });
}

async function cleanup() {
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
  const [name, domain] = email.split("@");
  return `${name}+${tag}@${domain}`;
}

function analysisText() {
  return [
    "Chrisland University students gathered on Monday to discuss a proposed library timetable change after several department representatives said evening access would help project work.",
    "According to Student Affairs officer Daniel Adeyemi, the proposal is still under review because security staffing and transport timing must be checked before approval.",
    "Mass Communication student Ruth Okafor said the current closing time makes it difficult for students in practical classes to use reference materials after lectures.",
    "The university has not announced a final decision, but the student council said it will collect written feedback from departments before sending a formal memo.",
    "The discussion matters because library access affects research, exam preparation, and the ability of student journalists to verify campus records before publication.",
  ].join(" ");
}

function ambiguousText() {
  return [
    "Some students claimed the change would definitely fix every academic problem on campus, while others said the claim was too broad and needed stronger evidence.",
    "One anonymous message also alleged that officials had already rejected the proposal, but no named source or document confirmed that claim at the time of reporting.",
  ].join(" ");
}
