import { NextResponse } from "next/server";
import {
  buildUsernameSuggestions,
  getAllowedSignupRole,
  isDepartmentCode,
  isSignupRole,
  normalizeDepartmentCode,
  normalizePhoneNumber,
  normalizeUsername,
  validatePhoneNumber,
  validateInstitutionalId,
  validateUsername,
} from "@/lib/onboarding";
import {
  createAnonSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase-server";

type SignupPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  username?: string;
  phoneNumber?: string;
  role?: string;
  departmentCode?: string;
  entryYear?: string;
  matricOrStaffId?: string;
  interests?: string[];
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as SignupPayload;
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const fullName = payload.fullName?.trim() ?? "";
  const usernameValidation = validateUsername(payload.username ?? "");
  const phoneValidation = validatePhoneNumber(payload.phoneNumber ?? "");
  const departmentCode = normalizeDepartmentCode(payload.departmentCode ?? "");
  const entryYear = payload.entryYear?.trim() ?? "";
  const role = payload.role ?? "";
  const validation = validateInstitutionalId(
    payload.matricOrStaffId ?? "",
    departmentCode,
    entryYear,
  );

  if (
    !email ||
    !password ||
    !fullName ||
    !payload.username ||
    !payload.phoneNumber ||
    !departmentCode ||
    !entryYear ||
    !role
  ) {
    return NextResponse.json(
      { ok: false, message: "Complete every required signup field before continuing." },
      { status: 400 },
    );
  }

  if (!isSignupRole(role)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose Reader or Student Journalist. Editor and administrator access is granted separately.",
      },
      { status: 400 },
    );
  }

  const allowedRole = getAllowedSignupRole(role);

  if (!isDepartmentCode(departmentCode)) {
    return NextResponse.json(
      { ok: false, message: "Choose a valid Chrisland department." },
      { status: 400 },
    );
  }

  if (!usernameValidation.valid) {
    return NextResponse.json(
      { ok: false, message: usernameValidation.message },
      { status: 400 },
    );
  }

  if (!phoneValidation.valid) {
    return NextResponse.json(
      { ok: false, message: phoneValidation.message },
      { status: 400 },
    );
  }

  if (!validation.valid) {
    return NextResponse.json({ ok: false, message: validation.message }, { status: 400 });
  }

  const entryYearNumber = Number.parseInt(entryYear, 10);
  if (!Number.isInteger(entryYearNumber)) {
    return NextResponse.json(
      { ok: false, message: "Entry year must be a four digit year." },
      { status: 400 },
    );
  }

  const serviceSupabase = createServiceSupabaseClient();
  const username = normalizeUsername(payload.username ?? "");
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber ?? "");

  const { data: existingUsername } = await serviceSupabase
    .from("profiles")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  if (existingUsername) {
    const suggestions = await availableUsernameSuggestions(serviceSupabase, fullName, username);

    return NextResponse.json(
      {
        ok: false,
        message: "That username is taken, try one of these.",
        suggestions,
      },
      { status: 409 },
    );
  }

  const { data: existingPhone } = await serviceSupabase
    .from("profiles")
    .select("phone_number")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (existingPhone) {
    return NextResponse.json(
      {
        ok: false,
        message: "This phone number is already registered, try signing in instead.",
      },
      { status: 409 },
    );
  }

  const { data: existingEmail } = await serviceSupabase
    .from("profiles")
    .select("email, account_status, banned_reason")
    .eq("email", email)
    .maybeSingle();

  if (existingEmail) {
    if (existingEmail.account_status === "banned") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This email is permanently banned from CampusPress AI for a rules violation. No appeal option is available.",
          reason: existingEmail.banned_reason ?? "A CampusPress rule was violated.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "This email is already registered, try signing in instead.",
      },
      { status: 409 },
    );
  }

  const { data: institution, error: institutionError } = await serviceSupabase
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();

  if (institutionError || !institution?.id) {
    return NextResponse.json(
      {
        ok: false,
        message: "CampusPress could not load the Chrisland institution record. Try again.",
      },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;
  const authSupabase = createAnonSupabaseClient();
  const { data: authData, error: authError } = await authSupabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth?mode=login`,
      data: {
        full_name: fullName,
        username,
        phone_number: phoneNumber,
        department_code: departmentCode,
        entry_year: entryYearNumber,
        role: allowedRole,
      },
    },
  });

  if (authError || !authData.user?.id) {
    if (authError?.message.toLowerCase().includes("already")) {
      return NextResponse.json(
        {
          ok: false,
          message: "This email is already registered, try signing in instead.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: authError?.message ?? "CampusPress could not create this account.",
      },
      { status: 400 },
    );
  }

  const { error: profileError } = await serviceSupabase.from("profiles").insert({
    id: authData.user.id,
    institution_id: institution.id,
    email,
    full_name: fullName,
    username,
    phone_number: phoneNumber,
    role: allowedRole,
    department_code: departmentCode,
    entry_year: entryYearNumber,
    matric_or_staff_id: validation.normalizedValue,
    preferences: {
      interests: payload.interests?.slice(0, 6) ?? [],
      onboarding_complete: true,
    },
  });

  if (profileError) {
    await serviceSupabase.auth.admin.deleteUser(authData.user.id);

    if (
      profileError.code === "23505" &&
      profileError.message.toLowerCase().includes("username")
    ) {
      const suggestions = await availableUsernameSuggestions(serviceSupabase, fullName, username);

      return NextResponse.json(
        {
          ok: false,
          message: "That username is taken, try one of these.",
          suggestions,
        },
        { status: 409 },
      );
    }

    if (
      profileError.code === "23505" &&
      profileError.message.toLowerCase().includes("phone")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "This phone number is already registered, try signing in instead.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "CampusPress could not save the onboarding profile. Check the ID format.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Account created. Check your email to confirm it before signing in.",
    role: allowedRole,
  });
}

async function availableUsernameSuggestions(
  serviceSupabase: ReturnType<typeof createServiceSupabaseClient>,
  fullName: string,
  username: string,
) {
  const candidates = buildUsernameSuggestions(fullName, username);

  if (candidates.length === 0) {
    return [];
  }

  const { data } = await serviceSupabase
    .from("profiles")
    .select("username")
    .in("username", candidates);
  const taken = new Set((data ?? []).map((profile) => profile.username));

  return candidates.filter((candidate) => !taken.has(candidate));
}
