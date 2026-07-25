import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testRecipient = process.env.RESEND_TEST_RECIPIENT;
const runId = Date.now().toString().slice(-7);

assert.ok(supabaseUrl, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");
assert.ok(testRecipient, "Missing test recipient");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const journalistAClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const journalistBClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const journalistA = await createJournalist("a");
const journalistB = await createJournalist("b");

const signInA = await journalistAClient.auth.signInWithPassword({
  email: journalistA.email,
  password: journalistA.password,
});
assert.ifError(signInA.error);

const signInB = await journalistBClient.auth.signInWithPassword({
  email: journalistB.email,
  password: journalistB.password,
});
assert.ifError(signInB.error);

const title = `Phase 4 RLS private draft ${runId}`;
const insertDraft = await journalistAClient
  .from("articles")
  .insert({
    author_id: journalistA.id,
    title,
    slug: `phase-4-rls-private-draft-${runId}`,
    excerpt: "A private draft used for journalist RLS verification.",
    content: {
      format: "plain-text-v1",
      body: "Journalist A private draft body.",
    },
    plain_text: "Journalist A private draft body.",
    status: "draft",
  })
  .select("id, author_id, status, plain_text")
  .single();
assert.ifError(insertDraft.error);
assert.equal(insertDraft.data.author_id, journalistA.id);
assert.equal(insertDraft.data.status, "draft");

const journalistBRead = await journalistBClient
  .from("articles")
  .select("id, title, plain_text")
  .eq("id", insertDraft.data.id);
assert.ifError(journalistBRead.error);
assert.equal(journalistBRead.data.length, 0, "Journalist B must not read Journalist A draft");

const journalistBUpdate = await journalistBClient
  .from("articles")
  .update({ plain_text: "Journalist B attempted update." })
  .eq("id", insertDraft.data.id)
  .select("id");
assert.ifError(journalistBUpdate.error);
assert.equal(
  journalistBUpdate.data.length,
  0,
  "Journalist B update must affect zero rows under RLS",
);

const journalistAReadBack = await journalistAClient
  .from("articles")
  .select("id, plain_text")
  .eq("id", insertDraft.data.id)
  .single();
assert.ifError(journalistAReadBack.error);
assert.equal(journalistAReadBack.data.plain_text, "Journalist A private draft body.");

console.log(
  JSON.stringify(
    {
      twoJournalistRlsProof: true,
      journalistACreatedDraft: true,
      journalistBCannotReadDraft: journalistBRead.data.length === 0,
      journalistBUpdateAffectedRows: journalistBUpdate.data.length,
      draftUnchangedAfterDeniedUpdate:
        journalistAReadBack.data.plain_text === "Journalist A private draft body.",
      articleId: insertDraft.data.id,
    },
    null,
    2,
  ),
);

async function createJournalist(label) {
  const email = plusAddress(testRecipient, `phase4-rls-${label}-${runId}`);
  const password = `Phase4Rls${label.toUpperCase()}${runId}!`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `Phase Four RLS Journalist ${label.toUpperCase()}`,
    },
  });
  assert.ifError(userError);
  assert.ok(userData.user?.id, "Expected RLS journalist user");

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
    full_name: `Phase Four RLS Journalist ${label.toUpperCase()}`,
    username: `phase4rls_${label}_${runId.slice(-4)}`,
    phone_number: label === "a" ? `+234830${runId}` : `+234831${runId}`,
    role: "journalist",
    department_code: "MAS",
    entry_year: 2024,
    matric_or_staff_id: label === "a" ? "MAS/2024/430" : "MAS/2024/431",
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

function plusAddress(email, tag) {
  const [local, domain] = email.split("@");
  assert.ok(local && domain, "RESEND_TEST_RECIPIENT must be an email address");
  return `${local.split("+")[0]}+${tag}@${domain}`;
}
