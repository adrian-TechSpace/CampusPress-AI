import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

import ts from "typescript";

const rosterModulePath = "src/lib/roster-csv.ts";
const dashboardPath = "src/components/admin/admin-dashboard-client.tsx";
const adminLibPath = "src/lib/admin.ts";
const routePath = "src/app/api/admin/roster/upload/route.ts";

assert.ok(existsSync(rosterModulePath), "Roster CSV helpers must live in src/lib/roster-csv.ts.");

const rosterSource = readFileSync(rosterModulePath, "utf8");
const transpiled = ts.transpileModule(rosterSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const sandboxModule = { exports: {} };
vm.runInNewContext(transpiled, { exports: sandboxModule.exports, module: sandboxModule });

const {
  buildRosterSampleCsv,
  isRosterDataKind,
  parseRosterCsv,
  previewRosterCsv,
  rosterDataKinds,
} = sandboxModule.exports;

assert.equal(typeof buildRosterSampleCsv, "function", "Roster helpers must build downloadable sample CSVs.");
assert.equal(typeof previewRosterCsv, "function", "Roster helpers must produce preview rows before upload.");
assert.equal(typeof parseRosterCsv, "function", "Roster parser must be reusable by the UI and upload API.");
assert.equal(JSON.stringify(rosterDataKinds.map((kind) => kind.id)), JSON.stringify(["student", "staff"]));
assert.equal(JSON.stringify(rosterDataKinds.map((kind) => kind.label)), JSON.stringify(["Student data", "Staff data"]));
assert.equal(isRosterDataKind("student"), true);
assert.equal(isRosterDataKind("staff"), true);
assert.equal(isRosterDataKind("reader"), false);

const studentSample = buildRosterSampleCsv("student");
assert.match(studentSample, /^department_code,matric_or_staff_id,full_name,role\n/);
assert.match(studentSample, /reader/);
assert.match(studentSample, /journalist/);
assert.doesNotMatch(studentSample, /Phase/i, "Sample CSVs must not create new Phase-tagged test data.");

const staffSample = buildRosterSampleCsv("staff");
assert.match(staffSample, /^department_code,matric_or_staff_id,full_name,role\n/);
assert.match(staffSample, /editor/);
assert.match(staffSample, /admin/);
assert.doesNotMatch(staffSample, /Phase/i, "Sample CSVs must not create new Phase-tagged test data.");

const parsedStudent = previewRosterCsv(
  "department_code,matric_or_staff_id,full_name,role\nmas,mas/2026/301,  Ada   Student  ,journalist",
  "student",
);
assert.equal(parsedStudent.rows.length, 1);
assert.equal(
  JSON.stringify(parsedStudent.rows[0]),
  JSON.stringify({
    department_code: "MAS",
    matric_or_staff_id: "MAS/2026/301",
    full_name: "Ada Student",
    role: "journalist",
  }),
);

assert.throws(
  () =>
    parseRosterCsv(
      "department_code,matric_or_staff_id,full_name,role\nMAS,MAS/2026/302,Wrong Staff Role,editor",
      "student",
    ),
  /student roster row 2 has an invalid role/i,
);

const dashboard = readFileSync(dashboardPath, "utf8");
assert.match(dashboard, /rosterDataKinds\.map/, "Admin roster UI must expose Student data and Staff data selectors from roster metadata.");
assert.match(dashboard, /Download sample CSV/, "Admin roster UI must include a sample CSV download button.");
assert.match(dashboard, /Preview/, "Admin roster UI must show a parsed preview section.");
assert.match(dashboard, /Confirm upload/, "Admin roster UI must require an explicit confirmation upload action.");
assert.match(dashboard, /previewRows/, "Admin roster UI must pass parsed preview rows into the panel.");

const adminLib = readFileSync(adminLibPath, "utf8");
assert.match(adminLib, /parseRosterCsv\(csv,\s*dataKind\)/, "Roster ingestion must parse with the selected data kind.");
assert.match(
  adminLib,
  /\.upsert\(payload,\s*\{\s*onConflict:\s*"department_code,matric_or_staff_id"\s*\}\)/,
  "Roster upload must upsert by department and matric or staff ID.",
);

const route = readFileSync(routePath, "utf8");
assert.match(route, /searchParams\.get\("type"\)/, "Roster upload API must accept the selected roster type.");
assert.match(route, /isRosterDataKind/, "Roster upload API must validate the selected roster type.");

console.log(
  JSON.stringify(
    {
      rosterDataKinds: rosterDataKinds.map((kind) => kind.id),
      studentPreviewRows: parsedStudent.rows.length,
      hasUpsertConflictTarget: true,
      uiControls: {
        studentSelector: true,
        staffSelector: true,
        sampleDownload: true,
        parsedPreview: true,
        confirmUpload: true,
      },
    },
    null,
    2,
  ),
);
