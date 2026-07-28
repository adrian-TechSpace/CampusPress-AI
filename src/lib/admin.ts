import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { flutterwaveConfigured } from "@/lib/flutterwave";
import { parseRosterCsv, type RosterDataKind } from "@/lib/roster-csv";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

export type AdminOverview = {
  metrics: {
    totalUsers: number;
    suspendedUsers: number;
    pendingModeration: number;
    rosterRows: number;
    matchedRosterRows: number;
    aiCostCents: number;
    paymentsTotalKobo: number;
  };
  users: AdminUserRow[];
  moderation: {
    articles: AdminArticleRow[];
    comments: AdminCommentRow[];
  };
  aiUsage: {
    byProvider: Array<{ provider: string; costCents: number; requests: number }>;
    recent: AdminUsageRow[];
  };
  monetisation: {
    payments: AdminPaymentRow[];
    subscriptions: AdminSubscriptionRow[];
    flutterwaveConfigured: boolean;
  };
  roster: {
    rows: AdminRosterRow[];
    latestJob: AdminJobRow | null;
  };
};

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  username: string | null;
  role: string;
  verified: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
};

export type AdminArticleRow = {
  id: string;
  title: string;
  status: string;
  authorId: string;
  authorName: string;
  updatedAt: string;
};

export type AdminCommentRow = {
  id: string;
  body: string;
  isHidden: boolean;
  articleId: string;
  authorId: string;
  createdAt: string;
};

export type AdminUsageRow = {
  id: string;
  provider: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
  status: string;
  createdAt: string;
};

export type AdminPaymentRow = {
  id: string;
  userId: string;
  providerReference: string | null;
  amountKobo: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type AdminSubscriptionRow = {
  id: string;
  userId: string;
  provider: string;
  status: string;
  currentPeriodEnd: string | null;
  createdAt: string;
};

export type AdminRosterRow = {
  id: string;
  departmentCode: string;
  matricOrStaffId: string;
  fullName: string;
  role: string;
  matchedProfileId: string | null;
  matchedAt: string | null;
  uploadedAt: string;
};

export type AdminJobRow = {
  id: string;
  jobName: string;
  status: string;
  endedAt: string | null;
  errorMessage: string | null;
};

export async function authenticateAdminRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    return { profile: null as AdminProfile | null, message: "Sign in as an administrator to continue." };
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (!userId) {
    return { profile: null as AdminProfile | null, message: "Sign in as an administrator to continue." };
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();

  const profile = (data ?? null) as AdminProfile | null;
  if (profile?.role !== "admin") {
    return { profile: null as AdminProfile | null, message: "Only administrators can use this workspace." };
  }

  return { profile, message: "" };
}

export async function loadAdminOverview(supabase = createServiceSupabaseClient()): Promise<AdminOverview> {
  const [
    usersResult,
    articlesResult,
    commentsResult,
    usageResult,
    paymentsResult,
    subscriptionsResult,
    rosterResult,
    jobsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, username, role, verified, suspended_at, suspension_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("articles")
      .select("id, title, status, author_id, updated_at")
      .in("status", ["submitted", "in_review", "revision_requested", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("comments")
      .select("id, body, is_hidden, article_id, author_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ai_usage_log")
      .select("id, provider, model_name, prompt_tokens, completion_tokens, cost_cents, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("payments")
      .select("id, user_id, provider_reference, amount_kobo, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("subscriptions")
      .select("id, user_id, provider, status, current_period_end, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("institution_roster")
      .select("id, department_code, matric_or_staff_id, full_name, role, matched_profile_id, matched_at, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(25),
    supabase
      .from("job_run_log")
      .select("id, job_name, status, ended_at, error_message")
      .eq("job_name", "roster-cross-check")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  for (const result of [usersResult, articlesResult, commentsResult, usageResult, paymentsResult, subscriptionsResult, rosterResult, jobsResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const users = ((usersResult.data ?? []) as Record<string, unknown>[]).map(mapUser);
  const profilesById = new Map(users.map((user) => [user.id, user.fullName]));
  const articles = ((articlesResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    title: stringValue(row.title),
    status: stringValue(row.status),
    authorId: stringValue(row.author_id),
    authorName: profilesById.get(stringValue(row.author_id)) ?? "CampusPress user",
    updatedAt: stringValue(row.updated_at),
  }));
  const comments = ((commentsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    body: stringValue(row.body),
    isHidden: Boolean(row.is_hidden),
    articleId: stringValue(row.article_id),
    authorId: stringValue(row.author_id),
    createdAt: stringValue(row.created_at),
  }));
  const usage = ((usageResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    provider: stringValue(row.provider),
    modelName: stringValue(row.model_name),
    promptTokens: numberValue(row.prompt_tokens),
    completionTokens: numberValue(row.completion_tokens),
    costCents: numberValue(row.cost_cents),
    status: stringValue(row.status),
    createdAt: stringValue(row.created_at),
  }));
  const payments = ((paymentsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    providerReference: nullableString(row.provider_reference),
    amountKobo: numberValue(row.amount_kobo),
    currency: stringValue(row.currency),
    status: stringValue(row.status),
    createdAt: stringValue(row.created_at),
  }));
  const subscriptions = ((subscriptionsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    provider: stringValue(row.provider),
    status: stringValue(row.status),
    currentPeriodEnd: nullableString(row.current_period_end),
    createdAt: stringValue(row.created_at),
  }));
  const rosterRows = ((rosterResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    departmentCode: stringValue(row.department_code),
    matricOrStaffId: stringValue(row.matric_or_staff_id),
    fullName: stringValue(row.full_name),
    role: stringValue(row.role),
    matchedProfileId: nullableString(row.matched_profile_id),
    matchedAt: nullableString(row.matched_at),
    uploadedAt: stringValue(row.uploaded_at),
  }));
  const latestJob = ((jobsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    jobName: stringValue(row.job_name),
    status: stringValue(row.status),
    endedAt: nullableString(row.ended_at),
    errorMessage: nullableString(row.error_message),
  }))[0] ?? null;
  const byProvider = groupUsageByProvider(usage);

  return {
    metrics: {
      totalUsers: users.length,
      suspendedUsers: users.filter((user) => user.suspendedAt).length,
      pendingModeration: articles.length + comments.filter((comment) => !comment.isHidden).length,
      rosterRows: rosterRows.length,
      matchedRosterRows: rosterRows.filter((row) => row.matchedProfileId).length,
      aiCostCents: usage.reduce((sum, row) => sum + row.costCents, 0),
      paymentsTotalKobo: payments.filter((row) => row.status === "succeeded").reduce((sum, row) => sum + row.amountKobo, 0),
    },
    users,
    moderation: { articles, comments },
    aiUsage: { byProvider, recent: usage },
    monetisation: {
      payments,
      subscriptions,
      flutterwaveConfigured: flutterwaveConfigured(),
    },
    roster: { rows: rosterRows, latestJob },
  };
}

export async function setUserSuspension(
  supabase: SupabaseClient,
  actorId: string,
  userId: string,
  suspended: boolean,
  reason: string,
) {
  const cleanReason = reason.trim();
  if (suspended && cleanReason.length < 6) {
    throw new Error("Add a plain reason before suspending this user.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      suspended_at: suspended ? new Date().toISOString() : null,
      suspension_reason: suspended ? cleanReason : null,
    })
    .eq("id", userId)
    .select("id, full_name, suspended_at")
    .single();

  if (error) {
    throw error;
  }

  await writeAudit(supabase, actorId, suspended ? "suspend_user" : "restore_user", "profiles", userId, {
    reason: cleanReason,
  });

  return {
    userId: data.id,
    suspendedAt: data.suspended_at as string | null,
    message: suspended ? "User suspended." : "User restored.",
  };
}

export async function moderateArticle(
  supabase: SupabaseClient,
  actorId: string,
  articleId: string,
  action: "publish" | "hide" | "restore",
) {
  const now = new Date().toISOString();
  const next =
    action === "publish"
      ? { status: "published", reviewed_at: now, published_at: now }
      : action === "hide"
        ? { status: "rejected", reviewed_at: now, published_at: null }
        : { status: "submitted", reviewed_at: null, published_at: null };

  const { data, error } = await supabase
    .from("articles")
    .update(next)
    .eq("id", articleId)
    .select("id, status")
    .single();

  if (error) {
    throw error;
  }

  await writeAudit(supabase, actorId, `moderate_article_${action}`, "articles", articleId, next);
  return {
    articleId: data.id,
    status: data.status,
    message: action === "hide" ? "Article hidden from publication." : action === "publish" ? "Article published." : "Article returned to review.",
  };
}

export async function moderateComment(
  supabase: SupabaseClient,
  actorId: string,
  commentId: string,
  hidden: boolean,
) {
  const { data, error } = await supabase
    .from("comments")
    .update({ is_hidden: hidden })
    .eq("id", commentId)
    .select("id, is_hidden")
    .single();

  if (error) {
    throw error;
  }

  await writeAudit(supabase, actorId, hidden ? "hide_comment" : "restore_comment", "comments", commentId, {
    is_hidden: hidden,
  });
  return {
    commentId: data.id,
    isHidden: Boolean(data.is_hidden),
    message: hidden ? "Comment hidden." : "Comment restored.",
  };
}

export async function ingestRosterCsv(supabase: SupabaseClient, actorId: string, csv: string, dataKind: RosterDataKind = "student") {
  const rows = parseRosterCsv(csv, dataKind);
  if (rows.length === 0) {
    throw new Error("Add at least one roster row before uploading.");
  }

  const { data: institution, error: institutionError } = await supabase
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();

  if (institutionError || !institution) {
    throw new Error("CampusPress could not find the Chrisland University institution row.");
  }

  const payload = rows.map((row) => ({
    institution_id: institution.id,
    department_code: row.department_code,
    matric_or_staff_id: row.matric_or_staff_id,
    full_name: row.full_name,
    role: row.role,
    uploaded_by: actorId,
    uploaded_at: new Date().toISOString(),
  }));
  const { data: upserted, error: upsertError } = await supabase
    .from("institution_roster")
    .upsert(payload, { onConflict: "department_code,matric_or_staff_id" })
    .select("id, matched_profile_id");

  if (upsertError) {
    throw upsertError;
  }

  const { data: crossCheck, error: crossCheckError } = await supabase.rpc("run_roster_cross_check", {
    target_profile_id: null,
  });

  if (crossCheckError) {
    throw crossCheckError;
  }

  const matchedProfiles = typeof crossCheck?.matched_profiles === "number" ? crossCheck.matched_profiles : 0;
  return {
    importedRows: rows.length,
    savedRows: upserted?.length ?? 0,
    alreadyMatchedRows: (upserted ?? []).filter((row) => row.matched_profile_id).length,
    matchedProfiles,
    message: `Roster upload saved ${rows.length} ${rows.length === 1 ? "row" : "rows"} and verified ${matchedProfiles} matching ${matchedProfiles === 1 ? "profile" : "profiles"}.`,
  };
}

async function writeAudit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  tableName: string,
  recordId: string,
  afterData: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    table_name: tableName,
    record_id: recordId,
    after_data: afterData,
  });
  if (error) {
    throw error;
  }
}

function mapUser(row: Record<string, unknown>): AdminUserRow {
  return {
    id: stringValue(row.id),
    email: stringValue(row.email),
    fullName: stringValue(row.full_name),
    username: nullableString(row.username),
    role: stringValue(row.role),
    verified: Boolean(row.verified),
    suspendedAt: nullableString(row.suspended_at),
    suspensionReason: nullableString(row.suspension_reason),
    createdAt: stringValue(row.created_at),
  };
}

function groupUsageByProvider(rows: AdminUsageRow[]) {
  const totals = new Map<string, { provider: string; costCents: number; requests: number }>();
  for (const row of rows) {
    const current = totals.get(row.provider) ?? { provider: row.provider, costCents: 0, requests: 0 };
    current.costCents += row.costCents;
    current.requests += 1;
    totals.set(row.provider, current);
  }
  return [...totals.values()].sort((a, b) => b.costCents - a.costCents);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
