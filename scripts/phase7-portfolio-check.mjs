import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.PHASE7_APP_URL || "https://campuspress-ai.vercel.app";
const testRecipient = process.env.TEST_EMAIL_RECIPIENT || process.env.RESEND_TEST_RECIPIENT || "temmydaniel124@gmail.com";
const runId = Date.now().toString(36);
const numericRunId = String(Date.now()).slice(-7);
const outDir = ".playwright-mcp/phase7-portfolio";

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

await mkdir(outDir, { recursive: true });

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = { users: [], articles: [], roster: [], userAchievements: [] };
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
  const journalistA = await createJournalist("alpha", true);
  const journalistB = await createJournalist("bravo", false);

  const alphaPublished = await createArticle(journalistA.id, "published", "alpha published");
  const alphaDraft = await createArticle(journalistA.id, "draft", "alpha private draft");
  const bravoPublished = await createArticle(journalistB.id, "published", "bravo published");
  const bravoDraft = await createArticle(journalistB.id, "draft", "bravo private draft");
  ids.articles.push(alphaPublished.id, alphaDraft.id, bravoPublished.id, bravoDraft.id);

  await insertWorkingCredibilityEvidence(alphaPublished.id, journalistA.id);
  await awardExistingAchievement(journalistA.id, "Published Reporter");

  await verifyDirectRlsProofs(journalistB, alphaDraft);

  await page.goto(`${appUrl}/portfolio/${journalistA.username}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("journalist-portfolio").waitFor({ timeout: 30000 });
  await waitForPortfolioImages(page);
  await expectVisibleText(page, journalistA.fullName);
  await expectVisibleText(page, "Verified Chrisland Student/Staff");
  await expectVisibleText(page, "Published Reporter");
  await expectVisibleText(page, "Credibility Builder");
  await expectVisibleText(page, "Working-signal average: 80%");
  await expectVisibleText(page, alphaPublished.title);
  await assertPageOmits(page, alphaDraft.title, "Alpha draft title leaked on alpha portfolio");
  await assertPageOmits(page, alphaDraft.secretText, "Alpha draft body leaked on alpha portfolio");
  await assertPageOmits(page, bravoPublished.title, "Bravo published title leaked on alpha portfolio");
  await assertPageOmits(page, bravoDraft.title, "Bravo draft title leaked on alpha portfolio");
  await page.screenshot({ path: `${outDir}/portfolio-1440.png`, fullPage: true });

  await page.setViewportSize({ width: 768, height: 1000 });
  await page.goto(`${appUrl}/portfolio/${journalistA.username}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("journalist-portfolio").waitFor({ timeout: 30000 });
  await waitForPortfolioImages(page);
  await expectVisibleText(page, "Verified Chrisland Student/Staff");
  await page.screenshot({ path: `${outDir}/portfolio-768.png`, fullPage: true });

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${appUrl}/portfolio/${journalistA.username}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("journalist-portfolio").waitFor({ timeout: 30000 });
  await waitForPortfolioImages(page);
  await expectVisibleText(page, "Working-signal average: 80%");
  await page.screenshot({ path: `${outDir}/portfolio-375.png`, fullPage: true });

  await page.goto(`${appUrl}/portfolio/${journalistB.username}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("journalist-portfolio").waitFor({ timeout: 30000 });
  await expectVisibleText(page, journalistB.fullName);
  await assertPageOmits(page, "Verified Chrisland Student/Staff", "Unverified journalist showed verified badge");
  await assertPageOmits(page, alphaPublished.title, "Alpha article leaked on bravo portfolio");

  const relevantConsoleMessages = consoleMessages.filter(isRelevantConsoleMessage);
  assert.deepEqual(relevantConsoleMessages, [], `Unexpected console messages: ${relevantConsoleMessages.join("\n")}`);

  console.log(
    JSON.stringify(
      {
        appUrl,
        portfolioUrl: `${appUrl}/portfolio/${journalistA.username}`,
        verifiedBadgeFromRoster: true,
        publishedOnlyPortfolio: true,
        otherJournalistDataOmitted: true,
        guessedDraftArticleRouteDenied: true,
        anonDraftQueryDenied: true,
        signedInOtherJournalistDraftQueryDenied: true,
        openAiFailedRowsExcludedFromCredibilityAverage: true,
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
  if (process.env.PHASE7_KEEP_TEST_DATA !== "1") {
    await cleanup();
  }
}

async function createJournalist(label, verified) {
  const email = plusAddress(testRecipient, `phase7-${label}-${runId}`);
  const password = `Phase7${label}Journalist${runId}!`;
  const username = `p7_${label}_${runId.slice(-6)}`;
  const sequence = label === "alpha" ? `8${numericRunId.slice(-2)}` : `9${numericRunId.slice(-2)}`;
  const matricOrStaffId = `MAS/2024/${sequence.padStart(3, "0")}`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Phase Seven ${label}` },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, `Expected ${label} user id`);
  ids.users.push(userData.user.id);

  const { data: institution, error: institutionError } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();
  assert.ifError(institutionError);

  const fullName = label === "alpha" ? "Phase Seven Alpha" : "Phase Seven Bravo";
  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    institution_id: institution.id,
    email,
    full_name: fullName,
    username,
    phone_number: label === "alpha" ? `+23483${numericRunId}` : `+23482${numericRunId}`,
    role: "journalist",
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: matricOrStaffId,
    bio: `${fullName} reports on verified campus stories for Phase 7.`,
    preferences: {
      interests: ["Campus news"],
      onboarding_complete: true,
    },
  });
  assert.ifError(profileError);

  if (verified) {
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

    const { data: verification, error: verificationError } = await admin
      .from("profiles")
      .select("verified, verified_at")
      .eq("id", userData.user.id)
      .single();
    assert.ifError(verificationError);
    assert.equal(verification.verified, true, "Roster row should verify the test journalist");
    assert.ok(verification.verified_at, "Verified profile should record verified_at");
  }

  return {
    id: userData.user.id,
    email,
    password,
    username,
    fullName,
  };
}

async function createArticle(authorId, status, label) {
  const slug = `phase7-${label.replace(/\s+/g, "-")}-${runId}`;
  const secretText =
    status === "draft"
      ? `Private Phase 7 draft evidence ${label} ${runId}`
      : `Published Phase 7 portfolio evidence ${label} ${runId}`;
  const title =
    status === "draft"
      ? `Phase 7 ${label} should never appear`
      : `Phase 7 ${label} portfolio story`;

  const { data, error } = await admin
    .from("articles")
    .insert({
      author_id: authorId,
      title,
      slug,
      excerpt: `A ${status} story created for Phase 7 portfolio verification.`,
      content: { format: "rich-html-v1", html: `<p>${secretText}</p>`, body: secretText },
      plain_text: secretText,
      status,
      submitted_at: status === "published" ? new Date().toISOString() : null,
      reviewed_at: status === "published" ? new Date().toISOString() : null,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id, title, slug")
    .single();
  assert.ifError(error);

  return { ...data, secretText };
}

async function insertWorkingCredibilityEvidence(articleId, requestedBy) {
  const rows = [
    analysisRow(articleId, requestedBy, "huggingface_fake_news", "huggingface", "fake-news", 80),
    analysisRow(articleId, requestedBy, "cardiff_sentiment", "huggingface", "sentiment", 80),
    analysisRow(articleId, requestedBy, "languagetool", "languagetool", "grammar", 80),
    analysisRow(articleId, requestedBy, "pg_trgm_originality", "supabase", "originality", 80),
    analysisRow(articleId, requestedBy, "tfidf_relevance", "local", "tf-idf", 80),
    analysisRow(articleId, requestedBy, "rule_credibility", "local", "rule-based", 80),
    failedOpenAiRow(articleId, requestedBy, "openai_editorial", "llm-editorial"),
    failedOpenAiRow(articleId, requestedBy, "openai_verification", "llm-verification"),
  ];

  const { error } = await admin.from("ai_analyses").insert(rows);
  assert.ifError(error);
}

function analysisRow(articleId, requestedBy, key, provider, modelFamily, score) {
  return {
    article_id: articleId,
    requested_by: requestedBy,
    provider,
    model_name: `phase7-${modelFamily}`,
    model_family: modelFamily,
    status: "completed",
    verdict: `${key} completed for the portfolio credibility track record.`,
    confidence: 0.8,
    score,
    flagged_sentences: [],
    raw_output: {
      key,
      disclosure: null,
      output: { phase7: true },
    },
    error_message: null,
    completed_at: new Date().toISOString(),
  };
}

function failedOpenAiRow(articleId, requestedBy, key, modelFamily) {
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
    completed_at: new Date().toISOString(),
  };
}

async function awardExistingAchievement(userId, achievementName) {
  const { data: achievement, error: achievementError } = await admin
    .from("achievements")
    .select("id")
    .eq("name", achievementName)
    .single();
  assert.ifError(achievementError);

  const { data, error } = await admin
    .from("user_achievements")
    .insert({
      user_id: userId,
      achievement_id: achievement.id,
    })
    .select("id")
    .single();
  assert.ifError(error);
  ids.userAchievements.push(data.id);
}

async function verifyDirectRlsProofs(otherJournalist, privateDraft) {
  const privateDraftSlug = privateDraft.slug;
  const articleResponse = await fetch(`${appUrl}/articles/${privateDraftSlug}`);
  const articleText = await articleResponse.text();
  assert.notEqual(articleResponse.status, 200, "Guessed draft article route should not return 200");
  assert.equal(articleText.includes(privateDraft.title), false, "Guessed draft route should not expose draft title");
  assert.equal(articleText.includes(privateDraft.secretText), false, "Guessed draft route should not expose draft body");

  const { data: anonDraftRows, error: anonDraftError } = await anon
    .from("articles")
    .select("id, title, plain_text")
    .eq("slug", privateDraftSlug);
  assert.ifError(anonDraftError);
  assert.equal(anonDraftRows.length, 0, "Anon query should not read private draft rows");

  const signedInOther = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await signedInOther.auth.signInWithPassword({
    email: otherJournalist.email,
    password: otherJournalist.password,
  });
  assert.ifError(signIn.error);

  const { data: otherJournalistDraftRows, error: otherJournalistDraftError } = await signedInOther
    .from("articles")
    .select("id, title, plain_text")
    .eq("slug", privateDraftSlug);
  assert.ifError(otherJournalistDraftError);
  assert.equal(otherJournalistDraftRows.length, 0, "A separate journalist should not read another journalist draft");
}

async function expectVisibleText(targetPage, text) {
  await targetPage.getByText(text, { exact: false }).first().waitFor({ timeout: 30000 });
}

async function waitForPortfolioImages(targetPage) {
  await targetPage.waitForLoadState("networkidle");
  await targetPage.waitForFunction(() => {
    const portfolio = document.querySelector('[data-testid="journalist-portfolio"]');
    if (!portfolio) {
      return false;
    }

    const images = Array.from(portfolio.querySelectorAll("img"));
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
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

async function assertPageOmits(targetPage, text, message) {
  const bodyText = await targetPage.locator("body").innerText();
  assert.equal(bodyText.includes(text), false, message);
}

async function cleanup() {
  if (ids.userAchievements.length > 0) {
    await admin.from("user_achievements").delete().in("id", ids.userAchievements);
  }
  if (ids.articles.length > 0) {
    await admin.from("ai_analyses").delete().in("article_id", ids.articles);
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
