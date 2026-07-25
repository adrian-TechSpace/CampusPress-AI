import { NextResponse } from "next/server";
import { createAnonSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { email?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json(
      { ok: false, message: "Enter the email address for your CampusPress account." },
      { status: 400 },
    );
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const supabase = createAnonSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/update-password`,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: "CampusPress could not prepare a reset link for this account." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Password reset instructions have been sent if this account exists.",
  });
}
