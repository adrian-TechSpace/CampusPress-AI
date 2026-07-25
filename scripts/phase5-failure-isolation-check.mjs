import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://campuspress-ai.vercel.app";
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || "temmydaniel124@gmail.com";
const cronSecret = process.env.CRON_SECRET;
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);

assert.ok(supabaseUrl);
assert.ok(anonKey);
assert.ok(serviceRoleKey);
assert.ok(cronSecret, "CRON_SECRET is required for scoped failure-isolation verification");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = { users: [], articles: [] };

try {
  const journalist = await createUser("journalist");
  const article = await createArticle(journalist.id);
  ids.articles.push(article.id);
  const session = await signIn(journalist.email, journalist.password);

  const response = await fetch(`${appUrl}/api/analysis/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "x-phase5-failure-check": cronSecret,
    },
    body: JSON.stringify({
      articleId: article.id,
      breakModel: "huggingface_fake_news",
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));

  const { data: rows, error } = await admin
    .from("ai_analyses")
    .select("status, raw_output, provider")
    .eq("article_id", article.id);
  assert.ifError(error);

  const byKey = new Map(rows.map((row) => [row.raw_output?.key, row]));
  assert.equal(byKey.get("huggingface_fake_news")?.status, "failed", "Broken HF fake-news check must fail alone");
  for (const key of [
    "openai_editorial",
    "openai_verification",
    "cardiff_sentiment",
    "pg_trgm_originality",
    "rule_credibility",
    "flesch_kincaid",
    "languagetool",
    "tfidf_relevance",
  ]) {
    assert.equal(byKey.get(key)?.status, "completed", `${key} should still complete`);
  }

  console.log(
    JSON.stringify(
      {
        appUrl,
        articleId: article.id,
        brokenSignal: "huggingface_fake_news",
        failedOnlyBrokenSignal: true,
        realEnvironmentKeysMutated: false,
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
  const email = plusAddress(testRecipient, `phase5-failure-${runId}`);
  const password = `Phase5Failure${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Phase 5 Failure Writer" },
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
    full_name: "Phase 5 Failure Writer",
    username: `p5fail_${runId.slice(-5)}`,
    phone_number: `+23489${numericRunId}`,
    role,
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: `MAS/2024/${String(500 + (Number(numericRunId.slice(-2)) % 300)).padStart(3, "0")}`,
    preferences: { interests: ["Campus news"], onboarding_complete: true },
  });
  assert.ifError(profileError);
  return { id: userData.user.id, email, password };
}

async function createArticle(authorId) {
  const text = `${baseText()} ${baseText()}`;
  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title: `Phase 5 failure isolation ${runId}`,
      slug: `phase-5-failure-isolation-${runId}`,
      excerpt: "A test article for single-model failure isolation.",
      content: { format: "rich-html-v1", html: `<p>${text}</p>`, body: text },
      plain_text: text,
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

function baseText() {
  return "Chrisland University students interviewed three named sources about a campus transport proposal. The article includes dates, context, quotes, and a clear statement that no final administrative decision has been announced.";
}
