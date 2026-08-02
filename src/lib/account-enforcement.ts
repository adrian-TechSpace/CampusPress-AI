import { createHmac, timingSafeEqual } from "crypto";

import { createClient } from "@supabase/supabase-js";

import { createServiceSupabaseClient } from "@/lib/supabase-server";

export type AccountProfile = {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  role: string;
  account_status: "active" | "warned" | "suspended" | "banned";
  session_version: number;
  suspended_at: string | null;
  suspension_reason: string | null;
  suspended_until: string | null;
  banned_at: string | null;
  banned_reason: string | null;
  active_warning_action_id: string | null;
  warning_acknowledged_at: string | null;
};

export type AccountWarning = {
  id: string;
  reason: string;
  rulesUrl: string;
};

export type AccountStatusPayload = {
  ok: boolean;
  authenticated: boolean;
  status: AccountProfile["account_status"] | "signed_out";
  forceSignOut: boolean;
  sessionStale: boolean;
  message: string;
  reason: string | null;
  restorationDate: string | null;
  rulesUrl: string;
  appealToken: string | null;
  warning: AccountWarning | null;
  profile: {
    id: string;
    email: string;
    fullName: string;
    username: string | null;
    role: string;
  } | null;
};

export type AuthenticatedRequestResult =
  | {
      ok: true;
      token: string;
      userId: string;
      profile: AccountProfile;
      account: AccountStatusPayload;
    }
  | {
      ok: false;
      status: number;
      message: string;
      account: AccountStatusPayload | null;
    };

export const platformRulesUrl = "/terms";
export const adminTierRoles = ["admin", "subadmin"] as const;

export function bearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
}

export async function authenticateActiveRequest(request: Request): Promise<AuthenticatedRequestResult> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Sign in before continuing.",
      account: null,
    };
  }

  const account = await loadAccountStatusForToken(token);
  if (!account.profile) {
    return {
      ok: false,
      status: 401,
      message: account.message,
      account,
    };
  }

  if (account.forceSignOut || account.status === "suspended" || account.status === "banned") {
    return {
      ok: false,
      status: 403,
      message: account.message,
      account,
    };
  }

  const profile = await loadProfileById(account.profile.id);
  if (!profile) {
    return {
      ok: false,
      status: 401,
      message: "Your account profile could not be loaded.",
      account,
    };
  }

  return {
    ok: true,
    token,
    userId: profile.id,
    profile,
    account,
  };
}

export async function authenticateSuspendedRequest(request: Request): Promise<AuthenticatedRequestResult> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Sign in again before submitting an appeal.",
      account: null,
    };
  }

  const account = token.startsWith("sat.")
    ? (await loadAccountStatusForAppealToken(token)) ??
      signedOutStatus("Sign in again with this suspended account before submitting an appeal.")
    : await loadAccountStatusForToken(token);
  if (!account.profile) {
    return {
      ok: false,
      status: 401,
      message: account.message,
      account,
    };
  }

  if (account.sessionStale) {
    return {
      ok: false,
      status: 403,
      message: "Sign in again before submitting an appeal.",
      account,
    };
  }

  if (account.status !== "suspended") {
    return {
      ok: false,
      status: 403,
      message: "Only suspended accounts can submit a suspension appeal.",
      account,
    };
  }

  const profile = await loadProfileById(account.profile.id);
  if (!profile) {
    return {
      ok: false,
      status: 401,
      message: "Your account profile could not be loaded.",
      account,
    };
  }

  return {
    ok: true,
    token,
    userId: profile.id,
    profile,
    account,
  };
}

export async function loadAccountStatusForToken(token: string): Promise<AccountStatusPayload> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return signedOutStatus("Supabase public environment variables are missing.");
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData.user?.id ?? null;
  if (!userId) {
    return signedOutStatus("Sign in before continuing.");
  }

  const profile = await loadProfileById(userId);
  if (!profile) {
    return signedOutStatus("Your account profile could not be loaded.");
  }

  const normalizedProfile = await autoRestoreExpiredSuspension(profile);
  const tokenVersion = tokenSessionVersion(token);
  const sessionStale = normalizedProfile.session_version > tokenVersion;
  const status = normalizedProfile.account_status;
  const reason = moderationReason(normalizedProfile);
  const restorationDate = normalizedProfile.suspended_until;
  const forceSignOut = sessionStale || status === "suspended" || status === "banned";
  const warning = await loadWarning(normalizedProfile);

  if (status === "banned") {
    return payloadForProfile(normalizedProfile, {
      forceSignOut,
      message: "This account was permanently banned for a rules violation.",
      reason,
      restorationDate: null,
      sessionStale,
      warning: null,
    });
  }

  if (status === "suspended") {
    return payloadForProfile(normalizedProfile, {
      forceSignOut,
      message: "This account is suspended for a rules violation.",
      reason,
      restorationDate,
      sessionStale,
      warning: null,
    });
  }

  if (sessionStale) {
    return payloadForProfile(normalizedProfile, {
      forceSignOut: true,
      message: "Your session changed. Sign in again to continue.",
      reason: null,
      restorationDate: null,
      sessionStale: true,
      warning: null,
    });
  }

  return payloadForProfile(normalizedProfile, {
    forceSignOut: false,
    message: "Account active.",
    reason: null,
    restorationDate: null,
    sessionStale: false,
    warning,
  });
}

export async function loadProfileById(userId: string) {
  const { data, error } = await createServiceSupabaseClient()
    .from("profiles")
    .select(
      "id, email, full_name, username, role, account_status, session_version, suspended_at, suspension_reason, suspended_until, banned_at, banned_reason, active_warning_action_id, warning_acknowledged_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AccountProfile;
}

export async function updateAuthSessionVersion(userId: string, sessionVersion: number) {
  const supabase = createServiceSupabaseClient();
  const { data, error: loadError } = await supabase.auth.admin.getUserById(userId);
  if (loadError) {
    throw loadError;
  }
  const currentAppMetadata = data.user?.app_metadata ?? {};
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...currentAppMetadata,
      session_version: sessionVersion,
    },
  });

  if (error) {
    throw error;
  }
}

function signedOutStatus(message: string): AccountStatusPayload {
  return {
    ok: false,
    authenticated: false,
    status: "signed_out",
    forceSignOut: true,
    sessionStale: false,
    message,
    reason: null,
    restorationDate: null,
    rulesUrl: platformRulesUrl,
    appealToken: null,
    warning: null,
    profile: null,
  };
}

function payloadForProfile(
  profile: AccountProfile,
  options: {
    forceSignOut: boolean;
    message: string;
    reason: string | null;
    restorationDate: string | null;
    sessionStale: boolean;
    warning: AccountWarning | null;
  },
): AccountStatusPayload {
  return {
    ok: !options.forceSignOut,
    authenticated: true,
    status: profile.account_status,
    forceSignOut: options.forceSignOut,
    sessionStale: options.sessionStale,
    message: options.message,
    reason: options.reason,
    restorationDate: options.restorationDate,
    rulesUrl: platformRulesUrl,
    appealToken:
      profile.account_status === "suspended" && !options.sessionStale
        ? createSuspensionAppealToken(profile)
        : null,
    warning: options.warning,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      username: profile.username,
      role: profile.role,
    },
  };
}

type SuspensionAppealTokenPayload = {
  purpose: "suspension_appeal";
  sub: string;
  email: string;
  sessionVersion: number;
  exp: number;
};

const suspensionAppealTokenTtlMs = 1000 * 60 * 60 * 24 * 7;

async function loadAccountStatusForAppealToken(token: string): Promise<AccountStatusPayload | null> {
  const payload = verifySuspensionAppealToken(token);
  if (!payload) {
    return null;
  }

  const profile = await loadProfileById(payload.sub);
  if (!profile || profile.email !== payload.email) {
    return null;
  }

  const normalizedProfile = await autoRestoreExpiredSuspension(profile);
  if (
    normalizedProfile.account_status !== "suspended" ||
    normalizedProfile.session_version !== payload.sessionVersion
  ) {
    return null;
  }

  return payloadForProfile(normalizedProfile, {
    forceSignOut: true,
    message: "This account is suspended for a rules violation.",
    reason: moderationReason(normalizedProfile),
    restorationDate: normalizedProfile.suspended_until,
    sessionStale: false,
    warning: null,
  });
}

function createSuspensionAppealToken(profile: AccountProfile) {
  const secret = moderationTokenSecret();
  if (!secret) {
    return null;
  }

  const payload: SuspensionAppealTokenPayload = {
    purpose: "suspension_appeal",
    sub: profile.id,
    email: profile.email,
    sessionVersion: profile.session_version,
    exp: Date.now() + suspensionAppealTokenTtlMs,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `sat.${body}.${signature}`;
}

function verifySuspensionAppealToken(token: string) {
  const secret = moderationTokenSecret();
  const [, body, signature] = token.split(".");
  if (!secret || !body || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SuspensionAppealTokenPayload>;
    if (
      payload.purpose !== "suspension_appeal" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    return payload as SuspensionAppealTokenPayload;
  } catch {
    return null;
  }
}

function moderationTokenSecret() {
  return process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

async function autoRestoreExpiredSuspension(profile: AccountProfile) {
  if (profile.account_status !== "suspended" || !profile.suspended_until) {
    return profile;
  }

  if (new Date(profile.suspended_until).getTime() > Date.now()) {
    return profile;
  }

  const { data, error } = await createServiceSupabaseClient()
    .from("profiles")
    .update({
      account_status: "active",
      suspended_at: null,
      suspended_until: null,
      suspension_reason: null,
    })
    .eq("id", profile.id)
    .select(
      "id, email, full_name, username, role, account_status, session_version, suspended_at, suspension_reason, suspended_until, banned_at, banned_reason, active_warning_action_id, warning_acknowledged_at",
    )
    .single();

  if (error || !data) {
    return profile;
  }

  return data as AccountProfile;
}

async function loadWarning(profile: AccountProfile): Promise<AccountWarning | null> {
  if (!profile.active_warning_action_id || profile.warning_acknowledged_at) {
    return null;
  }

  const { data } = await createServiceSupabaseClient()
    .from("moderation_actions")
    .select("id, reason_text")
    .eq("id", profile.active_warning_action_id)
    .maybeSingle();

  if (!data?.id) {
    return null;
  }

  return {
    id: data.id as string,
    reason: (data.reason_text as string) || "A CampusPress rule was violated.",
    rulesUrl: platformRulesUrl,
  };
}

function moderationReason(profile: AccountProfile) {
  if (profile.account_status === "banned") {
    return profile.banned_reason || "A CampusPress rule was violated.";
  }

  return profile.suspension_reason || "A CampusPress rule was violated.";
}

function tokenSessionVersion(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    return 0;
  }

  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      app_metadata?: { session_version?: unknown };
    };
    const version = Number(json.app_metadata?.session_version ?? 0);
    return Number.isFinite(version) ? version : 0;
  } catch {
    return 0;
  }
}
