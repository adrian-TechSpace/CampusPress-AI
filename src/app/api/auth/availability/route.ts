import { NextResponse } from "next/server";

import {
  buildUsernameSuggestions,
  normalizePhoneNumber,
  normalizeUsername,
  validatePhoneNumber,
  validateUsername,
} from "@/lib/onboarding";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const usernameInput = searchParams.get("username") ?? "";
  const phoneInput = searchParams.get("phoneNumber") ?? "";
  const fullName = searchParams.get("fullName") ?? "";
  const serviceSupabase = createServiceSupabaseClient();

  if (usernameInput) {
    const validation = validateUsername(usernameInput);

    if (!validation.valid) {
      return NextResponse.json({
        ok: false,
        available: false,
        message: validation.message,
        suggestions: [],
      });
    }

    const username = normalizeUsername(usernameInput);
    const { data } = await serviceSupabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        ok: true,
        available: true,
        message: "This username is available.",
        suggestions: [],
      });
    }

    const candidates = buildUsernameSuggestions(fullName, username);
    const { data: takenRows } = await serviceSupabase
      .from("profiles")
      .select("username")
      .in("username", candidates);
    const taken = new Set((takenRows ?? []).map((profile) => profile.username));

    return NextResponse.json({
      ok: true,
      available: false,
      message: "That username is taken, try one of these.",
      suggestions: candidates.filter((candidate) => !taken.has(candidate)),
    });
  }

  if (phoneInput) {
    const validation = validatePhoneNumber(phoneInput);

    if (!validation.valid) {
      return NextResponse.json({
        ok: false,
        available: false,
        message: validation.message,
      });
    }

    const phoneNumber = normalizePhoneNumber(phoneInput);
    const { data } = await serviceSupabase
      .from("profiles")
      .select("phone_number")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      available: !data,
      message: data
        ? "This phone number is already registered, try signing in instead."
        : "This phone number is available.",
    });
  }

  return NextResponse.json(
    { ok: false, message: "Check either a username or phone number." },
    { status: 400 },
  );
}
