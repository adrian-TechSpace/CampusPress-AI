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

function userClient(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
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
  assert.ok(data.user?.id, `Expected user id for ${email}`);
  return data.user.id;
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  assert.ok(data.session?.access_token, `Expected session for ${email}`);
  return userClient(url, anonKey, data.session.access_token);
}

async function cleanup(admin, ids) {
  if (ids.categoryId) {
    await admin.from("categories").delete().eq("id", ids.categoryId);
  }
  if (ids.profileIds.length > 0) {
    await admin.from("profiles").delete().in("id", ids.profileIds);
  }
  for (const userId of ids.userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.PHASE2_APP_URL || "https://campuspress-ai.vercel.app";

assert.ok(url, "Missing Supabase URL");
assert.ok(anonKey, "Missing Supabase anon key");
assert.ok(serviceRoleKey, "Missing Supabase service role key");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = Date.now();
const password = `Phase2Admin${runId}!`;
const bootstrapEmail = `phase2-bootstrap-${runId}@campuspress.test`;
const readerEmail = `phase2-reader-${runId}@campuspress.test`;
const ids = { userIds: [], profileIds: [], categoryId: null };

try {
  const bootstrapUserId = await createConfirmedUser(admin, bootstrapEmail, password);
  const readerUserId = await createConfirmedUser(admin, readerEmail, password);
  ids.userIds.push(bootstrapUserId, readerUserId);
  ids.profileIds.push(bootstrapUserId, readerUserId);

  const { data: institution, error: institutionError } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();
  assert.ifError(institutionError);
  assert.ok(institution?.id, "Expected seeded Chrisland institution");

  const profiles = [
    {
      id: bootstrapUserId,
      institution_id: institution.id,
      email: bootstrapEmail,
      full_name: "Phase Two Bootstrap Admin",
      role: "reader",
      department_code: "SWE",
      entry_year: 2022,
      matric_or_staff_id: "SWE/2022/201",
    },
    {
      id: readerUserId,
      institution_id: institution.id,
      email: readerEmail,
      full_name: "Phase Two Reader Control",
      role: "reader",
      department_code: "NSC",
      entry_year: 2022,
      matric_or_staff_id: "NSC/2022/202",
    },
  ];

  const profileInsert = await admin.from("profiles").insert(profiles);
  assert.ifError(profileInsert.error);

  const promotion = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("email", bootstrapEmail)
    .eq("role", "reader")
    .select("id,email,role")
    .single();
  assert.ifError(promotion.error);
  assert.equal(promotion.data.role, "admin", "Bootstrap profile should be admin");

  const adminSessionClient = await signIn(url, anonKey, bootstrapEmail, password);
  const readerSessionClient = await signIn(url, anonKey, readerEmail, password);

  const readerInsert = await readerSessionClient.from("categories").insert({
    name: `Phase 2 Reader Denied ${runId}`,
    slug: `phase-2-reader-denied-${runId}`,
    description: "Reader insert should fail.",
  });
  assert.ok(readerInsert.error, "Reader must not insert admin-managed categories");

  const adminInsert = await adminSessionClient
    .from("categories")
    .insert({
      name: `Phase 2 Admin Allowed ${runId}`,
      slug: `phase-2-admin-allowed-${runId}`,
      description: "Admin insert should pass.",
    })
    .select("id")
    .single();
  assert.ifError(adminInsert.error);
  ids.categoryId = adminInsert.data.id;

  const dashboardResponse = await fetch(`${appUrl}/dashboard/admin`);
  assert.equal(dashboardResponse.status, 200, "Admin dashboard placeholder route should render");
  const dashboardHtml = await dashboardResponse.text();
  assert.match(dashboardHtml, /Administrator/, "Admin dashboard route should contain administrator heading");

  console.log(
    JSON.stringify({
      bootstrapPromotionWorked: true,
      adminDashboardRouteRendered: true,
      readerAdminActionDenied: true,
      promotedAdminActionAllowed: true,
      promotedEmail: bootstrapEmail,
    }),
  );
} finally {
  await cleanup(admin, ids);
}
