import assert from "node:assert/strict";

const appUrl = process.env.PHASE2_APP_URL || "https://campuspress-ai.vercel.app";
const runId = Date.now();

async function postSignup(role) {
  const response = await fetch(`${appUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `phase2-${role}-${runId}@campuspress.test`,
      password: `Phase2Api${runId}!`,
      fullName: `Phase Two ${role}`,
      username: `phase2_${role}_${String(runId).slice(-6)}`,
      phoneNumber: role === "admin" ? "+2348000002201" : "+2348000002202",
      role,
      departmentCode: "SWE",
      entryYear: "2022",
      matricOrStaffId: "SWE/2022/301",
      interests: ["Campus news"],
    }),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

const adminAttempt = await postSignup("admin");
const editorAttempt = await postSignup("editor");

assert.equal(adminAttempt.status, 400, "Admin self-assignment API request must be denied");
assert.equal(editorAttempt.status, 400, "Editor self-assignment API request must be denied");
assert.equal(adminAttempt.body.ok, false);
assert.equal(editorAttempt.body.ok, false);

console.log(
  JSON.stringify({
    adminSelfAssignmentDenied: true,
    editorSelfAssignmentDenied: true,
    adminStatus: adminAttempt.status,
    editorStatus: editorAttempt.status,
  }),
);
