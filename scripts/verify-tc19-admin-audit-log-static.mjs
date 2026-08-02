import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminLib = readFileSync("src/lib/admin.ts", "utf8");
const adminDashboard = readFileSync("src/components/admin/admin-dashboard-client.tsx", "utf8");

assert.match(
  adminLib,
  /auditLog:\s*AdminAuditLogRow\[\]/,
  "Admin overview type must include audit log rows.",
);

assert.match(
  adminLib,
  /from\("audit_log"\)[\s\S]*order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)/,
  "Admin overview must load audit_log rows in most recent first order.",
);

assert.match(
  adminLib,
  /actorName/,
  "Audit log rows must include a display actor.",
);

assert.match(
  adminDashboard,
  /AuditLogPanel/,
  "Admin dashboard must render an audit log panel.",
);

for (const field of ["actorName", "action", "tableName", "recordId", "createdAt"]) {
  assert.match(
    adminDashboard,
    new RegExp(field),
    `Audit log panel must render ${field}.`,
  );
}

console.log("TC-19 admin audit log static checks passed.");
