export const rosterDataKinds = [
  {
    id: "student",
    label: "Student data",
    description: "Reader and journalist rows for student roster verification.",
  },
  {
    id: "staff",
    label: "Staff data",
    description: "Editor and admin rows for staff roster verification.",
  },
] as const;

export type RosterDataKind = (typeof rosterDataKinds)[number]["id"];
export type RosterRole = "reader" | "journalist" | "editor" | "admin";

export type RosterCsvRow = {
  department_code: string;
  matric_or_staff_id: string;
  full_name: string;
  role: RosterRole;
};

export type RosterPreview = {
  rows: RosterCsvRow[];
};

const requiredHeaders = ["department_code", "matric_or_staff_id", "full_name", "role"];
const allowedRolesByKind: Record<RosterDataKind, RosterRole[]> = {
  student: ["reader", "journalist"],
  staff: ["editor", "admin"],
};

const rosterSamples: Record<RosterDataKind, string[][]> = {
  student: [
    requiredHeaders,
    ["MAS", "MAS/2026/001", "Ada Student", "reader"],
    ["CSC", "CSC/2026/002", "Tolu Campus Reporter", "journalist"],
  ],
  staff: [
    requiredHeaders,
    ["LAW", "LAW/2026/101", "Dr Miriam Editor", "editor"],
    ["MAS", "MAS/2026/102", "Campus Administrator", "admin"],
  ],
};

export function isRosterDataKind(value: unknown): value is RosterDataKind {
  return value === "student" || value === "staff";
}

export function buildRosterSampleCsv(dataKind: RosterDataKind) {
  return rosterSamples[dataKind].map((row) => row.map(formatCsvField).join(",")).join("\n");
}

export function previewRosterCsv(csv: string, dataKind: RosterDataKind): RosterPreview {
  return { rows: parseRosterCsv(csv, dataKind) };
}

export function parseRosterCsv(csv: string, dataKind: RosterDataKind): RosterCsvRow[] {
  const trimmed = csv.trim();
  if (!trimmed) {
    return [];
  }

  const records = parseCsv(trimmed);
  if (records.length < 2) {
    return [];
  }

  const headers = records[0].map((header) => header.trim().toLowerCase());
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Roster CSV is missing the ${header} header.`);
    }
  }

  return records.slice(1).map((record, index) => {
    const row = Object.fromEntries(headers.map((header, columnIndex) => [header, record[columnIndex]?.trim() ?? ""]));
    const departmentCode = row.department_code.toUpperCase();
    const matricOrStaffId = row.matric_or_staff_id.toUpperCase();
    const fullName = row.full_name.replace(/\s+/g, " ").trim();
    const role = row.role.toLowerCase();
    const allowedRoles = allowedRolesByKind[dataKind];

    if (!/^(ACC|CSC|LAW|SWE|CYB|MLS|POL|BUS|NSC|PBH|CRM|MCB|MTH|PST|MAS|BCH|ECO)$/.test(departmentCode)) {
      throw new Error(`Roster row ${index + 2} has an invalid department code.`);
    }
    if (!/^(ACC|CSC|LAW|SWE|CYB|MLS|POL|BUS|NSC|PBH|CRM|MCB|MTH|PST|MAS|BCH|ECO)\/[0-9]{4}\/[0-9]{3}$/.test(matricOrStaffId)) {
      throw new Error(`Roster row ${index + 2} has an invalid matric or staff ID.`);
    }
    if (fullName.length < 2) {
      throw new Error(`Roster row ${index + 2} needs a full name.`);
    }
    if (!allowedRoles.includes(role as RosterRole)) {
      throw new Error(`${dataKind} roster row ${index + 2} has an invalid role. Use ${allowedRoles.join(" or ")}.`);
    }

    return {
      department_code: departmentCode,
      matric_or_staff_id: matricOrStaffId,
      full_name: fullName,
      role: role as RosterRole,
    };
  });
}

function parseCsv(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim().length > 0));
}

function formatCsvField(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
