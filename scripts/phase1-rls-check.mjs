import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const values = {};
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }

    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim();
  }

  return values;
}

function createUserClient(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function createConfirmedUser(admin, email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  assert.ok(data.user?.id, "Expected Supabase Auth user id");
  return data.user.id;
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  assert.ok(data.session?.access_token, "Expected signed-in access token");
  return createUserClient(url, anonKey, data.session.access_token);
}

async function cleanup(admin, ids) {
  const tables = [
    "bookmarks",
    "messages",
    "notifications",
    "ai_analyses",
    "articles",
    "institution_roster",
    "profiles",
  ];

  for (const table of tables) {
    await admin.from(table).delete().in("id", ids.rows);
  }

  for (const userId of ids.users) {
    await admin.auth.admin.deleteUser(userId);
  }
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const runId = Date.now();
const password = `Phase1Check${runId}!`;
const emailA = `phase1-a-${runId}@campuspress.test`;
const emailB = `phase1-b-${runId}@campuspress.test`;
const ids = { rows: [], users: [] };

try {
  const userAId = await createConfirmedUser(admin, emailA, password);
  const userBId = await createConfirmedUser(admin, emailB, password);
  ids.users.push(userAId, userBId);

  const clientA = await signIn(url, anonKey, emailA, password);
  const clientB = await signIn(url, anonKey, emailB, password);

  const { data: institution } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();

  assert.ok(institution?.id, "Expected seeded institution");

  const profileA = {
    id: userAId,
    institution_id: institution.id,
    email: emailA,
    full_name: "Phase One User A",
    role: "journalist",
    department_code: "SWE",
    entry_year: 2022,
    matric_or_staff_id: "SWE/2022/091",
  };

  const profileB = {
    id: userBId,
    institution_id: institution.id,
    email: emailB,
    full_name: "Phase One User B",
    role: "reader",
    department_code: "NSC",
    entry_year: 2022,
    matric_or_staff_id: "NSC/2022/092",
  };

  const insertProfileA = await clientA.from("profiles").insert(profileA).select("id").single();
  assert.ifError(insertProfileA.error);
  const insertProfileB = await clientB.from("profiles").insert(profileB).select("id").single();
  assert.ifError(insertProfileB.error);

  const selfAssignAdmin = await clientB
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userBId);
  assert.ok(selfAssignAdmin.error, "User B must not self-assign admin role");

  const { data: category } = await clientB
    .from("categories")
    .select("id")
    .eq("slug", "campus-news")
    .single();
  assert.ok(category?.id, "User B should read public categories");

  const articleInsert = await clientA
    .from("articles")
    .insert({
      author_id: userAId,
      category_id: category.id,
      title: "Phase 1 private draft",
      slug: `phase-1-private-draft-${runId}`,
      plain_text: "Private draft text for RLS isolation.",
      status: "draft",
    })
    .select("id")
    .single();
  assert.ifError(articleInsert.error);
  ids.rows.push(articleInsert.data.id);

  const hiddenArticle = await clientB
    .from("articles")
    .select("id")
    .eq("id", articleInsert.data.id);
  assert.ifError(hiddenArticle.error);
  assert.equal(hiddenArticle.data.length, 0, "User B must not read User A draft");

  const messageInsert = await clientA
    .from("messages")
    .insert({
      sender_id: userAId,
      recipient_id: userAId,
      body: "Private message for RLS isolation.",
    })
    .select("id")
    .single();
  assert.ifError(messageInsert.error);
  ids.rows.push(messageInsert.data.id);

  const hiddenMessage = await clientB
    .from("messages")
    .select("id")
    .eq("id", messageInsert.data.id);
  assert.ifError(hiddenMessage.error);
  assert.equal(hiddenMessage.data.length, 0, "User B must not read User A message");

  const spoofMessage = await clientB.from("messages").insert({
    sender_id: userAId,
    recipient_id: userBId,
    body: "Spoofed message should fail.",
  });
  assert.ok(spoofMessage.error, "User B must not insert as User A");

  const notificationInsert = await admin
    .from("notifications")
    .insert({
      user_id: userAId,
      title: "Private notice",
      type: "phase1",
      body: "Private notification for isolation.",
    })
    .select("id")
    .single();
  assert.ifError(notificationInsert.error);
  ids.rows.push(notificationInsert.data.id);

  const hiddenNotification = await clientB
    .from("notifications")
    .select("id")
    .eq("id", notificationInsert.data.id);
  assert.ifError(hiddenNotification.error);
  assert.equal(hiddenNotification.data.length, 0, "User B must not read User A notification");

  const rosterInsert = await admin
    .from("institution_roster")
    .insert({
      institution_id: institution.id,
      department_code: "SWE",
      matric_or_staff_id: "SWE/2022/091",
      full_name: "Phase One User A",
      role: "journalist",
    })
    .select("id")
    .single();
  assert.ifError(rosterInsert.error);
  ids.rows.push(rosterInsert.data.id);

  const { data: verifiedProfile, error: verifiedError } = await admin
    .from("profiles")
    .select("verified, verified_at")
    .eq("id", userAId)
    .single();
  assert.ifError(verifiedError);
  assert.equal(verifiedProfile.verified, true, "Roster match should verify User A");
  assert.ok(verifiedProfile.verified_at, "Verified profile needs verified_at");

  const { data: jobRun, error: jobRunError } = await admin
    .from("job_run_log")
    .select("id")
    .eq("job_name", "roster-cross-check")
    .order("started_at", { ascending: false })
    .limit(1);
  assert.ifError(jobRunError);
  assert.ok(jobRun.length > 0, "Roster job should be logged");

  console.log(
    JSON.stringify({
      usersCreated: true,
      privateDraftHiddenFromSecondUser: true,
      privateMessageHiddenFromSecondUser: true,
      spoofedMessageDenied: true,
      privateNotificationHiddenFromSecondUser: true,
      publicCategoryReadable: true,
      rosterVerificationWorked: true,
      jobRunLogged: true,
    }),
  );
} finally {
  await cleanup(admin, ids);
}
