import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/202607200001_phase_1_foundation.sql";
const phase8MigrationPath = "supabase/migrations/202607260001_phase_8_admin_scaffolding.sql";
const edgeFunctionPath = "supabase/functions/roster-cross-check/index.ts";
const sql = [migrationPath, phase8MigrationPath]
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const requiredTables = [
  "profiles",
  "institutions",
  "articles",
  "comments",
  "messages",
  "notifications",
  "bookmarks",
  "follows",
  "article_likes",
  "ai_analyses",
  "ad_placements",
  "subscriptions",
  "payments",
  "audit_log",
  "user_interests",
  "categories",
  "achievements",
  "user_achievements",
  "ai_usage_log",
  "job_run_log",
  "institution_roster",
];

assert.ok(sql, `Missing migration: ${migrationPath}`);

for (const table of requiredTables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"), `Missing table ${table}`);
  const literalRls = new RegExp(`alter table public\\.${table}\\s+enable row level security`, "i").test(sql);
  const loopRls = /alter table public\.%I enable row level security/i.test(sql)
    && new RegExp(`'${table}'`, "i").test(sql);
  assert.ok(literalRls || loopRls, `Missing RLS enable for ${table}`);
}

assert.match(sql, /verified\s+boolean\s+not\s+null\s+default\s+false/i, "profiles.verified default is missing");
assert.match(sql, /verified_at\s+timestamptz/i, "profiles.verified_at is missing");
assert.match(sql, /suspended_at\s+timestamptz/i, "profiles.suspended_at is missing");
assert.match(sql, /suspension_reason\s+text/i, "profiles.suspension_reason is missing");

const requiredFunctions = [
  "is_admin",
  "is_editor",
  "is_suspended",
  "run_roster_cross_check",
  "handle_article_publish_count",
  "recalculate_profile_credibility",
  "write_audit_log",
];

for (const fn of requiredFunctions) {
  assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\b`, "i"), `Missing function ${fn}`);
}

const requiredTriggers = [
  "profiles_roster_cross_check",
  "institution_roster_cross_check",
  "articles_publish_count",
  "ai_analyses_recalculate_credibility",
  "profiles_audit",
  "articles_audit",
  "payments_audit",
  "subscriptions_audit",
  "ad_placements_audit",
  "institution_roster_audit",
];

for (const trigger of requiredTriggers) {
  assert.match(sql, new RegExp(`create trigger ${trigger}\\b`, "i"), `Missing trigger ${trigger}`);
}

assert.ok(existsSync(edgeFunctionPath), `Missing Edge Function: ${edgeFunctionPath}`);

console.log("schema verification passed");
