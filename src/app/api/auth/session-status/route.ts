import { NextResponse } from "next/server";

import { bearerToken, loadAccountStatusForToken } from "@/lib/account-enforcement";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        status: "signed_out",
        forceSignOut: true,
        appealToken: null,
        message: "Sign in before continuing.",
      },
      { status: 401 },
    );
  }

  const account = await loadAccountStatusForToken(token);
  return NextResponse.json(account, {
    status: account.forceSignOut ? 403 : 200,
  });
}
