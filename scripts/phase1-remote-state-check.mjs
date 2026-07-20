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

async function deleteUsersByPrefix(admin, prefix) {
  const removed = [];
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw error;
    }

    const users = data.users.filter((user) => user.email?.startsWith(prefix));
    for (const user of users) {
      const deletion = await admin.auth.admin.deleteUser(user.id);
      if (deletion.error) {
        throw deletion.error;
      }
      removed.push(user.id);
    }

    if (data.users.length < 100) {
      break;
    }
    page += 1;
  }

  return removed.length;
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

const cleanupTables = [
  "bookmarks",
  "messages",
  "notifications",
  "ai_analyses",
  "articles",
  "institution_roster",
  "profiles",
  "job_run_log",
];

const cleanupSummary = {};
for (const table of cleanupTables) {
  let query = admin.from(table).delete();
  if (table === "profiles") {
    query = query.like("email", "phase1-%@campuspress.test");
  } else if (table === "articles") {
    query = query.like("slug", "phase-1-%");
  } else if (table === "institution_roster") {
    query = query.in("matric_or_staff_id", ["SWE/2022/091", "NSC/2022/092"]);
  } else if (table === "job_run_log") {
    query = query.eq("job_name", "roster-cross-check").contains("metadata", {
      target_profile_id: null,
    });
  } else {
    query = query.or(
      [
        "body.ilike.%RLS isolation%",
        "body.ilike.%Private notification%",
        "title.ilike.Phase 1%",
      ].join(","),
    );
  }

  const { error, count } = await query.select("id", { count: "exact", head: true });
  if (error && error.code !== "42703" && error.code !== "PGRST100") {
    throw error;
  }
  cleanupSummary[table] = count ?? 0;
}

const orphanedAuthUsersRemoved = await deleteUsersByPrefix(admin, "phase1-");

const { data: status, error: statusError } = await admin.rpc("phase1_foundation_remote_status");
assert.ifError(statusError);

const response = await fetch(`${url}/functions/v1/roster-cross-check`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});

const functionResponse = await response.json().catch(() => ({}));

console.log(
  JSON.stringify({
    remoteStatusRpcReachable: true,
    allTablesPresent: status.all_tables_present === true,
    allRlsEnabled: status.all_rls_enabled === true,
    verifiedColumnsPresent: status.verified_columns_present === true,
    rosterTriggersPresent: status.roster_triggers_present === true,
    rosterFunctionPresent: status.roster_function_present === true,
    edgeFunctionDeployed: response.ok,
    serviceRoleSecretWorks: response.ok && functionResponse.ok === true,
    orphanedAuthUsersRemoved,
    cleanupSummary,
  }),
);
