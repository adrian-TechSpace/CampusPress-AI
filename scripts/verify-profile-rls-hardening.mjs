import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase URL, anon key, and service role key are required.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const suffix = Date.now().toString(36);
const email = `profile-rls-${suffix}@example.com`;
const username = `rls_${suffix}`.slice(0, 20);
let userId = "";

try {
  const created = await admin.auth.admin.createUser({
    email,
    password: `RlsCheck${suffix}!`,
    email_confirm: true,
    user_metadata: { role: "reader", full_name: "Profile RLS Check" },
  });

  if (created.error || !created.data.user?.id) {
    throw created.error ?? new Error("Could not create verification auth user.");
  }

  userId = created.data.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    institution_id: await loadInstitutionId(),
    email,
    full_name: "Profile RLS Check",
    username,
    phone_number: "+2348000000099",
    role: "reader",
    department_code: "SWE",
    entry_year: 2022,
    matric_or_staff_id: "SWE/2022/099",
    bio: "Public bio for RLS verification.",
    avatar_url: "https://example.com/avatar.png",
    verified: true,
    verified_at: new Date().toISOString(),
  });

  if (profileError) {
    throw profileError;
  }

  const rawResult = await anon
    .from("profiles")
    .select("id, email, phone_number, matric_or_staff_id, full_name, username, role, bio, avatar_url, verified, verified_at")
    .eq("username", username);

  const rawRows = rawResult.data ?? [];
  const rawSensitiveLeak = rawRows.some(
    (row) =>
      row.email === email ||
      row.phone_number === "+2348000000099" ||
      row.matric_or_staff_id === "SWE/2022/099",
  );

  const publicResult = await anon
    .from("public_profiles")
    .select("id, full_name, username, role, bio, avatar_url, verified, verified_at, achievement_badges")
    .eq("username", username)
    .maybeSingle();

  const publicProfile = publicResult.data;
  const publicKeys = publicProfile && typeof publicProfile === "object" ? Object.keys(publicProfile).sort() : [];
  const forbiddenPublicKeys = publicKeys.filter((key) =>
    ["email", "phone_number", "matric_or_staff_id", "preferences", "entry_year"].includes(key),
  );

  const rawBlocked =
    rawResult.error &&
    ["42501", "PGRST205"].includes(String(rawResult.error.code ?? ""));

  const ok =
    !rawSensitiveLeak &&
    rawBlocked &&
    !publicResult.error &&
    publicProfile?.username === username &&
    publicProfile.full_name === "Profile RLS Check" &&
    forbiddenPublicKeys.length === 0;

  const proof = {
    ok,
    rawProfiles: {
      blocked: Boolean(rawBlocked),
      errorCode: rawResult.error?.code ?? null,
      rowCount: rawRows.length,
      leakedSensitiveValues: rawSensitiveLeak,
    },
    publicProfiles: {
      readable: Boolean(publicProfile),
      errorCode: publicResult.error?.code ?? null,
      keys: publicKeys,
      forbiddenKeys: forbiddenPublicKeys,
    },
  };

  console.log(JSON.stringify(proof, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
} finally {
  if (userId) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

async function loadInstitutionId() {
  const { data, error } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();

  if (error || !data?.id) {
    throw error ?? new Error("Chrisland institution row was not found.");
  }

  return data.id;
}
