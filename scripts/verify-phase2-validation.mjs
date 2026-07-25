import assert from "node:assert/strict";

const {
  getAllowedSignupRole,
  getRoleDestination,
  isSignupRole,
  normalizeDepartmentCode,
  validateInstitutionalId,
} = await import("../src/lib/onboarding.ts");

assert.equal(normalizeDepartmentCode(" swe "), "SWE");

assert.deepEqual(validateInstitutionalId("SWE/2022/018", "SWE", "2022"), {
  valid: true,
  normalizedValue: "SWE/2022/018",
  message: "This matches the Chrisland ID format.",
});

assert.equal(
  validateInstitutionalId("SWE/2024/18", "SWE", "2024").valid,
  false,
  "Sequence must be exactly three digits",
);

assert.equal(
  validateInstitutionalId("MLS/2023/027", "SWE", "2023").valid,
  false,
  "Department code must match the selected department",
);

assert.equal(getAllowedSignupRole("reader"), "reader");
assert.equal(getAllowedSignupRole("journalist"), "journalist");
assert.equal(isSignupRole("editor"), false);
assert.equal(isSignupRole("admin"), false);

assert.equal(getRoleDestination("reader"), "/dashboard/reader");
assert.equal(getRoleDestination("journalist"), "/dashboard/journalist");
assert.equal(getRoleDestination("editor"), "/dashboard/editor");
assert.equal(getRoleDestination("admin"), "/dashboard/admin");

console.log("phase 2 validation verification passed");
