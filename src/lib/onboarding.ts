import { canonicalCategories } from "@/lib/categories";

export const departments = [
  { name: "Accounting", code: "ACC" },
  { name: "Computer Science", code: "CSC" },
  { name: "Law", code: "LAW" },
  { name: "Software Engineering", code: "SWE" },
  { name: "Cybersecurity", code: "CYB" },
  { name: "Medical Lab Science", code: "MLS" },
  { name: "Political Science", code: "POL" },
  { name: "Business Administration", code: "BUS" },
  { name: "Nursing", code: "NSC" },
  { name: "Public Health", code: "PBH" },
  { name: "Criminology", code: "CRM" },
  { name: "Microbiology", code: "MCB" },
  { name: "Mathematics", code: "MTH" },
  { name: "Physiotherapy", code: "PST" },
  { name: "Mass Communication", code: "MAS" },
  { name: "Biochemistry", code: "BCH" },
  { name: "Economics", code: "ECO" },
] as const;

export const departmentCodes = departments.map((department) => department.code);

export const signupRoles = ["reader", "journalist"] as const;
export const appRoles = ["reader", "journalist", "editor", "admin", "subadmin"] as const;

export type SignupRole = (typeof signupRoles)[number];
export type AppRole = (typeof appRoles)[number];

export type AllowedSignupRole = SignupRole;

export type InstitutionalIdValidation = {
  valid: boolean;
  normalizedValue: string;
  message: string;
};

export const roleLabels: Record<SignupRole, string> = {
  reader: "Reader",
  journalist: "Student journalist",
};

export const roleDescriptions: Record<SignupRole, string> = {
  reader: "Read, follow, comment, bookmark, and personalize your campus feed.",
  journalist: "Draft stories, receive editorial feedback, and build a portfolio.",
};

export const appRoleLabels: Record<AppRole, string> = {
  reader: "Reader",
  journalist: "Student journalist",
  editor: "Editor or lecturer",
  admin: "Administrator",
  subadmin: "Subadministrator",
};

export const appRoleDescriptions: Record<AppRole, string> = {
  reader: "Read, follow, comment, bookmark, and personalize your campus feed.",
  journalist: "Draft stories, receive editorial feedback, and build a portfolio.",
  editor: "Review submissions and use the AI report as an editorial aid.",
  admin: "Manage users, roster verification, moderation, and platform settings.",
  subadmin: "Manage admin workflows except full administrator account removal and admin-tier invites.",
};

export const interestOptions = canonicalCategories.map((category) => category.name);

export function normalizeDepartmentCode(value: string) {
  return value.trim().toUpperCase();
}

export function isDepartmentCode(value: string) {
  return departmentCodes.includes(normalizeDepartmentCode(value) as (typeof departmentCodes)[number]);
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return {
      valid: false,
      username,
      message: "Use 3 to 20 lowercase letters, numbers, or underscores.",
    };
  }

  return {
    valid: true,
    username,
    message: "This username format works.",
  };
}

export function usernameBaseFromName(fullName: string) {
  const parts = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]}_${parts[1]}`.slice(0, 16);
  }

  return (parts[0] ?? "reader").slice(0, 16);
}

export function buildUsernameSuggestions(fullName: string, username: string) {
  const base = usernameBaseFromName(fullName) || normalizeUsername(username) || "reader";
  const normalizedBase = base.replace(/[^a-z0-9_]/g, "").slice(0, 16) || "reader";

  return [2, 3, 4, 24, 26]
    .map((suffix) => `${normalizedBase}${suffix}`)
    .filter((suggestion) => validateUsername(suggestion).valid)
    .slice(0, 3);
}

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }

  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }

  return trimmed;
}

export function validatePhoneNumber(value: string) {
  const phoneNumber = normalizePhoneNumber(value);

  if (!/^\+[1-9][0-9]{7,14}$/.test(phoneNumber)) {
    return {
      valid: false,
      phoneNumber,
      message: "Use a real phone number with country code, for example +2348012345678.",
    };
  }

  return {
    valid: true,
    phoneNumber,
    message: "This phone number format works.",
  };
}

export function validateInstitutionalId(
  value: string,
  departmentCode: string,
  entryYear: string,
): InstitutionalIdValidation {
  const normalizedValue = value.trim().toUpperCase();
  const normalizedDepartment = normalizeDepartmentCode(departmentCode);
  const normalizedYear = entryYear.trim();
  const codePattern = departmentCodes.join("|");
  const match = normalizedValue.match(
    new RegExp(`^(${codePattern})\\/([0-9]{4})\\/([0-9]{3})$`),
  );

  if (!match) {
    return {
      valid: false,
      normalizedValue,
      message: "Use the format XXX/YYYY/NNN with your selected department code.",
    };
  }

  const [, idDepartment, idYear] = match;

  if (idDepartment !== normalizedDepartment) {
    return {
      valid: false,
      normalizedValue,
      message: "The ID department code must match the selected department.",
    };
  }

  if (idYear !== normalizedYear) {
    return {
      valid: false,
      normalizedValue,
      message: "The ID year must match the selected entry year.",
    };
  }

  return {
    valid: true,
    normalizedValue,
    message: "This matches the Chrisland ID format.",
  };
}

export function getAllowedSignupRole(role: SignupRole): AllowedSignupRole {
  return role;
}

export function getRoleDestination(role: SignupRole | string) {
  if (role === "subadmin") {
    return "/dashboard/admin";
  }

  if (role === "editor") {
    return "/dashboard/editor";
  }

  if (role === "journalist") {
    return "/write";
  }

  return `/dashboard/${role}`;
}

export function isSignupRole(value: string): value is SignupRole {
  return signupRoles.includes(value as SignupRole);
}

export function isAppRole(value: string): value is AppRole {
  return appRoles.includes(value as AppRole);
}
