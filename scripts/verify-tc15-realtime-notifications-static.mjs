import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const analysisRoutePath = "src/app/api/analysis/run/route.ts";
const submissionNotificationsPath = "src/lib/submission-notifications.ts";
const notificationsClientPath = "src/components/reader/notifications-client.tsx";
const notificationsPagePath = "src/app/notifications/page.tsx";

const analysisRoute = readFileSync(analysisRoutePath, "utf8");
const submissionNotifications = readFileSync(submissionNotificationsPath, "utf8");
const notificationsPage = readFileSync(notificationsPagePath, "utf8");

assert.match(
  analysisRoute,
  /createEditorSubmissionNotifications/,
  "Article submission pipeline must create editor notification rows.",
);

assert.match(
  submissionNotifications,
  /article\.status\s*!==\s*"submitted"/,
  "Submission notifications must only be created for submitted articles.",
);

assert.match(
  submissionNotifications,
  /from\("profiles"\)[\s\S]*\.eq\("role",\s*"editor"\)/,
  "Submission notifications must target editor profiles.",
);

assert.match(
  submissionNotifications,
  /from\("notifications"\)[\s\S]*\.insert\(/,
  "Submission notifications must insert notification rows.",
);

assert.ok(
  existsSync(notificationsClientPath),
  "Notifications page must use a live client component.",
);

const notificationsClient = readFileSync(notificationsClientPath, "utf8");

assert.match(
  notificationsClient,
  /from\("notifications"\)/,
  "Notifications client must load notification rows from Supabase.",
);

assert.match(
  notificationsClient,
  /\.channel\(/,
  "Notifications client must create a Supabase Realtime channel.",
);

assert.match(
  notificationsClient,
  /postgres_changes/,
  "Notifications client must subscribe to Postgres changes.",
);

assert.match(
  notificationsClient,
  /filter:\s*`user_id=eq\.\$\{userId\}`/,
  "Realtime subscription must filter inserts to the signed-in user's notifications.",
);

assert.match(
  notificationsClient,
  /setInterval\(/,
  "Notifications client must include polling fallback for realtime delivery.",
);

assert.match(
  notificationsPage,
  /NotificationsClient/,
  "Notifications page must render the live notifications client.",
);

console.log("TC-15 realtime notification static checks passed.");
