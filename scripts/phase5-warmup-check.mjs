import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://campuspress-ai.vercel.app";
const cronSecret = process.env.CRON_SECRET;

assert.ok(supabaseUrl);
assert.ok(serviceRoleKey);
assert.ok(cronSecret, "CRON_SECRET is required to trigger warmup-models manually");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const before = new Date().toISOString();
const response = await fetch(`${appUrl}/api/cron/warmup-models`, {
  headers: {
    Authorization: `Bearer ${cronSecret}`,
  },
});
const body = await response.json().catch(() => ({}));
assert.equal(response.status, 200, JSON.stringify(body));
assert.equal(body.ok, true);

const { data, error } = await admin
  .from("job_run_log")
  .select("job_name, status, metadata, started_at")
  .eq("job_name", "warmup-models")
  .gte("started_at", before)
  .order("started_at", { ascending: false })
  .limit(1);
assert.ifError(error);
assert.equal(data?.[0]?.status, "completed");

console.log(
  JSON.stringify(
    {
      appUrl,
      warmupEndpointReturned: true,
      jobRunLogged: true,
      hobbyScheduleDisclosure: data[0].metadata?.schedule,
    },
    null,
    2,
  ),
);
