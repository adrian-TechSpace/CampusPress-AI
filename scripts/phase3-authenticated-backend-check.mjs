import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.PHASE3_APP_URL || "https://campuspress-ai.vercel.app";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const newsletterEmail = process.env.RESEND_TEST_RECIPIENT;
const runId = Date.now().toString();
const suffix = runId.slice(-7);

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service key");
assert.ok(resendApiKey, "Missing Resend API key");
assert.ok(newsletterEmail, "Missing newsletter test recipient");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const article = await getArticle();
const actionUser = await createActionUser();
const actionClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const signIn = await actionClient.auth.signInWithPassword({
  email: actionUser.email,
  password: actionUser.password,
});

assert.ifError(signIn.error);
assert.equal(signIn.data.user.id, actionUser.id);

const anonBookmark = await anon.from("bookmarks").insert({
  user_id: actionUser.id,
  article_id: article.id,
});
assert.ok(anonBookmark.error, "Logged-out bookmark insert must fail under RLS");

await insertAuthenticatedReaderActions(actionClient, actionUser.id, article);
const counts = await countReaderRows(actionUser.id, article);
assert.equal(counts.bookmarks, 1, "Authenticated bookmark must write to bookmarks");
assert.equal(counts.likes, 1, "Authenticated like must write to article_likes");
assert.equal(counts.follows, 1, "Authenticated follow must write to follows");
assert.equal(counts.comments, 1, "Authenticated comment must write to comments");

const availability = await getJson(
  `/api/auth/availability?username=mara_adebayo&fullName=Mara%20Adebayo`,
);
assert.equal(availability.available, false, "Taken username must report unavailable");
assert.ok(
  Array.isArray(availability.suggestions) && availability.suggestions.length > 0,
  "Taken username must return suggestions",
);

const wizardEmail = plusAddress(newsletterEmail, `phase3-signup-${suffix}`);
const wizardPassword = `Phase3Wizard${suffix}!`;
const wizardUsername = `phase3_${suffix}`;
const wizardPhone = `+234800${suffix}`;
const wizardMatricNumber = String(300 + (Number(suffix.slice(-3)) % 600)).padStart(3, "0");
const signupStartedAt = new Date();
const wizardSignup = await postJson("/api/auth/signup", {
  email: wizardEmail,
  password: wizardPassword,
  fullName: "Phase Three Wizard",
  username: wizardUsername,
  phoneNumber: wizardPhone,
  departmentCode: "CSC",
  entryYear: "2024",
  matricOrStaffId: `CSC/2024/${wizardMatricNumber}`,
  role: "reader",
  interests: ["Campus news", "Research"],
});
assert.equal(
  wizardSignup.status,
  200,
  `Wizard signup payload should create account: ${JSON.stringify(wizardSignup.body)}`,
);
assert.equal(wizardSignup.body.ok, true);
assert.match(wizardSignup.body.message, /check your email/i);

const preConfirmLogin = await anon.auth.signInWithPassword({
  email: wizardEmail,
  password: wizardPassword,
});
assert.ok(preConfirmLogin.error, "Fresh signup must not sign in before email confirmation");

const signupEmail = await waitForSignupEmail(resendApiKey, wizardEmail, signupStartedAt);
const confirmationLink = extractSignupLink(signupEmail);
await resolveConfirmationUrl(confirmationLink);

const confirmedLogin = await anon.auth.signInWithPassword({
  email: wizardEmail,
  password: wizardPassword,
});
assert.ifError(confirmedLogin.error);
assert.ok(confirmedLogin.data.session?.access_token, "Confirmed signup must sign in");
await anon.auth.signOut();

const usernameCollision = await postJson("/api/auth/signup", {
  email: plusAddress(newsletterEmail, `phase3-username-${suffix}`),
  password: `Phase3User${suffix}!`,
  fullName: "Phase Three Collision",
  username: wizardUsername,
  phoneNumber: `+234801${suffix}`,
  departmentCode: "CSC",
  entryYear: "2024",
  matricOrStaffId: "CSC/2024/322",
  role: "reader",
  interests: ["Campus news"],
});
assert.equal(usernameCollision.status, 409);
assert.match(usernameCollision.body.message, /username is taken/i);
assert.ok(Array.isArray(usernameCollision.body.suggestions));

const phoneCollision = await postJson("/api/auth/signup", {
  email: plusAddress(newsletterEmail, `phase3-phone-${suffix}`),
  password: `Phase3Phone${suffix}!`,
  fullName: "Phase Three Phone",
  username: `phase3phone_${suffix.slice(-4)}`,
  phoneNumber: wizardPhone,
  departmentCode: "CSC",
  entryYear: "2024",
  matricOrStaffId: "CSC/2024/323",
  role: "reader",
  interests: ["Campus news"],
});
assert.equal(phoneCollision.status, 409);
assert.match(phoneCollision.body.message, /phone number is already registered/i);

const adminSignup = await postJson("/api/auth/signup", {
  email: plusAddress(newsletterEmail, `phase3-admin-${suffix}`),
  password: `Phase3Admin${suffix}!`,
  fullName: "Phase Three Admin Denied",
  username: `phase3admin_${suffix.slice(-4)}`,
  phoneNumber: `+234802${suffix}`,
  departmentCode: "LAW",
  entryYear: "2024",
  matricOrStaffId: "LAW/2024/324",
  role: "admin",
  interests: ["Campus news"],
});
assert.equal(adminSignup.status, 400, "Admin must not be self-selectable by API");

const newsletter = await postJson("/api/newsletter/subscribe", {
  email: newsletterEmail,
});
assert.equal(newsletter.status, 200, "Newsletter API should accept test recipient");
assert.equal(newsletter.body.ok, true);
const { data: newsletterRow, error: newsletterError } = await admin
  .from("newsletter_subscriptions")
  .select("email, confirmation_sent_at")
  .eq("email", newsletterEmail.toLowerCase())
  .single();
assert.ifError(newsletterError);
assert.ok(newsletterRow.confirmation_sent_at);

console.log(
  JSON.stringify(
    {
      appUrl,
      loggedOutRlsDenied: Boolean(anonBookmark.error),
      authenticatedRows: counts,
      usernameSuggestions: availability.suggestions,
      wizardSignupEmail: wizardEmail,
      signupBlockedBeforeConfirmation: Boolean(preConfirmLogin.error),
      signupConfirmationEmailReceived: Boolean(signupEmail.id),
      signupLoginWorkedAfterConfirmation: Boolean(
        confirmedLogin.data.session?.access_token,
      ),
      usernameCollisionHandled: usernameCollision.status === 409,
      phoneCollisionHandled: phoneCollision.status === 409,
      adminSelfAssignmentDenied: adminSignup.status === 400,
      newsletterStoredAndConfirmationSent: Boolean(newsletterRow.confirmation_sent_at),
    },
    null,
    2,
  ),
);

async function getArticle() {
  const { data, error } = await admin
    .from("articles")
    .select("id, author_id, slug")
    .eq("slug", "inside-chrisland-student-newsroom")
    .eq("status", "published")
    .single();

  assert.ifError(error);
  assert.ok(data);
  return data;
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "RESEND_TEST_RECIPIENT must be an email address");
  return `${local.split("+")[0]}+${tag}@${domain}`;
}

async function resend(path, apiKey) {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Resend API failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

function decodeEmailHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractSignupLink(email) {
  const content = decodeEmailHtml(`${email.html ?? ""}\n${email.text ?? ""}`);
  const urls = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const link = urls.find(
    (url) =>
      url.includes("type=signup") ||
      url.includes("type=email") ||
      url.includes("/auth/v1/verify"),
  );

  assert.ok(link, "Expected a signup confirmation link in the Resend email content");
  return link.replace(/[).,;]+$/g, "");
}

async function waitForSignupEmail(apiKey, recipient, startedAt) {
  const startedMs = startedAt.getTime();
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    const list = await resend("/emails?limit=100", apiKey);
    const candidates = (list.data ?? [])
      .filter((email) => email.to?.some((to) => to.toLowerCase() === recipient.toLowerCase()))
      .filter((email) => Date.parse(email.created_at) >= startedMs)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    if (candidates.length > 0) {
      const latest = await resend(`/emails/${candidates[0].id}`, apiKey);
      if (["delivered", "opened", "clicked"].includes(latest.last_event)) {
        return latest;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error("Timed out waiting for delivered signup confirmation email in Resend");
}

async function resolveConfirmationUrl(confirmationUrl) {
  let current = confirmationUrl;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(current, { redirect: "manual" });
    const location = response.headers.get("location");

    if (!location) {
      return response.url;
    }

    current = new URL(location, current).href;
  }

  return current;
}

async function createActionUser() {
  const email = plusAddress(newsletterEmail, `phase3-actions-${suffix}`);
  const password = `Phase3Actions${suffix}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Phase Three Actions",
    },
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
    full_name: "Phase Three Actions",
    username: `phase3actions_${suffix.slice(-4)}`,
    phone_number: `+234803${suffix}`,
    role: "reader",
    department_code: "CSC",
    entry_year: 2024,
    matric_or_staff_id: "CSC/2024/320",
    preferences: {
      interests: ["Campus news"],
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

async function insertAuthenticatedReaderActions(client, userId, targetArticle) {
  const commentBody = `Phase 3 RLS comment ${suffix}`;
  const bookmark = await client.from("bookmarks").insert({
    user_id: userId,
    article_id: targetArticle.id,
  });
  assert.ifError(bookmark.error);

  const like = await client.from("article_likes").insert({
    user_id: userId,
    article_id: targetArticle.id,
  });
  assert.ifError(like.error);

  const follow = await client.from("follows").insert({
    follower_id: userId,
    following_id: targetArticle.author_id,
  });
  assert.ifError(follow.error);

  const comment = await client.from("comments").insert({
    article_id: targetArticle.id,
    author_id: userId,
    body: commentBody,
  });
  assert.ifError(comment.error);
}

async function countReaderRows(userId, targetArticle) {
  const [bookmarks, likes, follows, comments] = await Promise.all([
    admin
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("article_id", targetArticle.id),
    admin
      .from("article_likes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("article_id", targetArticle.id),
    admin
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("following_id", targetArticle.author_id),
    admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .eq("article_id", targetArticle.id),
  ]);

  assert.ifError(bookmarks.error);
  assert.ifError(likes.error);
  assert.ifError(follows.error);
  assert.ifError(comments.error);

  return {
    bookmarks: bookmarks.count,
    likes: likes.count,
    follows: follows.count,
    comments: comments.count,
  };
}

async function postJson(path, body) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function getJson(path) {
  const response = await fetch(`${appUrl}${path}`);
  return response.json();
}
