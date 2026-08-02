import { NextResponse } from "next/server";

import { authenticateActiveRequest } from "@/lib/account-enforcement";
import { loadRoleHome } from "@/lib/role-home";

export const runtime = "nodejs";

type HomeRouteContext = {
  params: Promise<{
    role: string;
  }>;
};

export async function GET(request: Request, context: HomeRouteContext) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { role } = await context.params;
  if (!canOpenRoleHome(auth.profile.role, role)) {
    return NextResponse.json(
      { ok: false, message: "This home page belongs to another CampusPress role." },
      { status: 403 },
    );
  }

  try {
    const home = await loadRoleHome(auth.profile);
    return NextResponse.json({ ok: true, home });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "CampusPress could not load this home page." },
      { status: 500 },
    );
  }
}

function canOpenRoleHome(actualRole: string, requestedRole: string) {
  if (requestedRole === "admin") {
    return actualRole === "admin" || actualRole === "subadmin";
  }

  return actualRole === requestedRole;
}
