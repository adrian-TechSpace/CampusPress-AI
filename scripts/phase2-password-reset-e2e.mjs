import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const values = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim();
  }
  return values;
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const visibleLocal = local.length <= 2 ? `${local[0] ?? ""}*` : `${local.slice(0, 2)}***`;
  return `${visibleLocal}@${domain}`;
}

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "RESEND_TEST_RECIPIENT must be an email address");
  const cleanLocal = local.split("+")[0];
  return `${cleanLocal}+${tag}@${domain}`;
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

function extractRecoveryLink(email) {
  const content = decodeEmailHtml(`${email.html ?? ""}\n${email.text ?? ""}`);
  const urls = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const link = urls.find(
    (url) =>
      url.includes("type=recovery") ||
      url.includes("/auth/update-password") ||
      url.includes("/auth/v1/verify"),
  );

  assert.ok(link, "Expected a recovery link in the Resend email content");
  return link.replace(/[).,;]+$/g, "");
}

async function waitForResetEmail(apiKey, recipient, startedAt) {
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

  throw new Error("Timed out waiting for delivered reset email in Resend");
}

async function resolveRecoveryUrl(recoveryUrl) {
  let current = recoveryUrl;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (
      current.includes("/auth/update-password") &&
      (current.includes("access_token=") || current.includes("token_hash="))
    ) {
      return current;
    }

    const response = await fetch(current, { redirect: "manual" });
    const location = response.headers.get("location");
    if (!location) {
      return response.url;
    }

    current = new URL(location, current).href;
  }

  return current;
}

async function establishRecoverySession(authClient, finalUrl) {
  const url = new URL(finalUrl);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  if (hashParams.has("access_token") && hashParams.has("refresh_token")) {
    const { error } = await authClient.auth.setSession({
      access_token: hashParams.get("access_token"),
      refresh_token: hashParams.get("refresh_token"),
    });
    assert.ifError(error);
    return "fragment-session";
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type === "recovery") {
    const { error } = await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    assert.ifError(error);
    return "token-hash";
  }

  throw new Error("Recovery URL did not contain a usable Supabase recovery session");
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = env.RESEND_API_KEY;
const testRecipient = env.RESEND_TEST_RECIPIENT;
const appUrl = process.env.PHASE2_APP_URL || "https://campuspress-ai.vercel.app";

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");
assert.ok(resendApiKey, "Missing RESEND_API_KEY");
assert.ok(testRecipient, "Missing RESEND_TEST_RECIPIENT");

const runId = Date.now();
const email = plusAddress(testRecipient, `campuspress-phase2-${runId}`);
const oldPassword = `OldPhase2${runId}!`;
const newPassword = `NewPhase2${runId}!`;
const ids = { userId: null };

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

try {
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  assert.ifError(authError);
  assert.ok(authData.user?.id, "Expected reset test user id");
  ids.userId = authData.user.id;

  const { data: institution, error: institutionError } = await serviceClient
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();
  assert.ifError(institutionError);

  const { error: profileError } = await serviceClient.from("profiles").insert({
    id: ids.userId,
    institution_id: institution.id,
    email,
    full_name: "Phase Two Reset User",
    role: "reader",
    department_code: "SWE",
    entry_year: 2022,
    matric_or_staff_id: "SWE/2022/401",
  });
  assert.ifError(profileError);

  const oldLogin = await authClient.auth.signInWithPassword({ email, password: oldPassword });
  assert.ifError(oldLogin.error);
  await authClient.auth.signOut();

  const startedAt = new Date();
  const resetResponse = await fetch(`${appUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const resetBody = await resetResponse.json();
  assert.equal(
    resetResponse.status,
    200,
    `Reset API should return 200. Body: ${JSON.stringify(resetBody)}`,
  );
  assert.equal(resetBody.ok, true, "Reset API should report ok");

  const deliveredEmail = await waitForResetEmail(resendApiKey, email, startedAt);
  const recoveryLink = extractRecoveryLink(deliveredEmail);
  const finalRecoveryUrl = await resolveRecoveryUrl(recoveryLink);
  const recoveryMode = await establishRecoverySession(authClient, finalRecoveryUrl);

  const updatePassword = await authClient.auth.updateUser({ password: newPassword });
  assert.ifError(updatePassword.error);
  await authClient.auth.signOut();

  const oldPasswordLogin = await authClient.auth.signInWithPassword({
    email,
    password: oldPassword,
  });
  assert.ok(oldPasswordLogin.error, "Old password must stop working after reset");

  const newPasswordLogin = await authClient.auth.signInWithPassword({
    email,
    password: newPassword,
  });
  assert.ifError(newPasswordLogin.error);
  assert.ok(newPasswordLogin.data.session?.access_token, "New password login should work");

  console.log(
    JSON.stringify({
      resetRequested: true,
      resendEmailReceived: true,
      passwordUpdated: true,
      newPasswordLoginWorked: true,
      oldPasswordRejected: true,
      recipient: maskEmail(email),
      resend: {
        id: deliveredEmail.id,
        subject: deliveredEmail.subject,
        created_at: deliveredEmail.created_at,
        last_event: deliveredEmail.last_event,
      },
      recoveryMode,
    }),
  );
} finally {
  if (ids.userId) {
    await serviceClient.from("profiles").delete().eq("id", ids.userId);
    await serviceClient.auth.admin.deleteUser(ids.userId);
  }
}
