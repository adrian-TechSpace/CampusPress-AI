import { type SupabaseClient } from "@supabase/supabase-js";

import { authenticateActiveRequest, platformRulesUrl, updateAuthSessionVersion } from "@/lib/account-enforcement";
import {
  sendAdminInviteEmail,
  sendBanNoticeEmail,
  sendModerationWarningEmail,
  sendSuspensionAppealAcceptedEmail,
  sendSuspensionAppealRejectedEmail,
  sendSuspensionNoticeEmail,
} from "@/lib/email";
import { flutterwaveConfigured } from "@/lib/flutterwave";
import { parseRosterCsv, type RosterDataKind } from "@/lib/roster-csv";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  isFullAdmin: boolean;
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
  appeals: AdminAppealRow[];
  invitations: AdminInvitationRow[];
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
  accountStatus: string;
  sessionVersion: number;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  warningAcknowledgedAt: string | null;
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

export type AdminAppealRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  explanation: string;
  answers: Record<string, unknown>;
  idPhotoPath: string;
  idPhotoUrl: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type AdminInvitationRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  invitedAt: string;
  onboardingCompletedAt: string | null;
};

export async function authenticateAdminRequest(request: Request) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return {
      profile: null as AdminProfile | null,
      message: auth.message || "Sign in as an administrator to continue.",
      status: auth.status,
    };
  }

  if (!["admin", "subadmin"].includes(auth.profile.role)) {
    return {
      profile: null as AdminProfile | null,
      message: "Only administrators can use this workspace.",
      status: 403,
    };
  }

  return {
    profile: {
      id: auth.profile.id,
      email: auth.profile.email,
      full_name: auth.profile.full_name,
      role: auth.profile.role,
      isFullAdmin: auth.profile.role === "admin",
    },
    message: "",
    status: 200,
  };
}

export async function loadAdminOverview(supabase = createServiceSupabaseClient()): Promise<AdminOverview> {
  const [
    usersResult,
    articlesResult,
    commentsResult,
    appealsResult,
    invitationsResult,
    usageResult,
    paymentsResult,
    subscriptionsResult,
    rosterResult,
    jobsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, username, role, verified, account_status, session_version, suspended_at, suspended_until, suspension_reason, banned_at, banned_reason, warning_acknowledged_at, created_at")
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
      .from("suspension_appeals")
      .select("id, user_id, status, explanation, answers, id_photo_path, submitted_at, reviewed_at")
      .order("submitted_at", { ascending: false })
      .limit(25),
    supabase
      .from("account_invitations")
      .select("id, email, full_name, role, status, invited_at, onboarding_completed_at")
      .order("invited_at", { ascending: false })
      .limit(25),
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

  for (const result of [usersResult, articlesResult, commentsResult, appealsResult, invitationsResult, usageResult, paymentsResult, subscriptionsResult, rosterResult, jobsResult]) {
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
  const appeals = await Promise.all(
    ((appealsResult.data ?? []) as Record<string, unknown>[]).map(async (row) => {
      const user = users.find((item) => item.id === stringValue(row.user_id));
      return {
        id: stringValue(row.id),
        userId: stringValue(row.user_id),
        userName: user?.fullName ?? "CampusPress user",
        userEmail: user?.email ?? "",
        status: stringValue(row.status),
        explanation: stringValue(row.explanation),
        answers: recordValue(row.answers),
        idPhotoPath: stringValue(row.id_photo_path),
        idPhotoUrl: await signedAppealPhotoUrl(supabase, stringValue(row.id_photo_path)),
        submittedAt: stringValue(row.submitted_at),
        reviewedAt: nullableString(row.reviewed_at),
      } satisfies AdminAppealRow;
    }),
  );
  const invitations = ((invitationsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: stringValue(row.id),
    email: stringValue(row.email),
    fullName: stringValue(row.full_name),
    role: stringValue(row.role),
    status: stringValue(row.status),
    invitedAt: stringValue(row.invited_at),
    onboardingCompletedAt: nullableString(row.onboarding_completed_at),
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
      suspendedUsers: users.filter((user) => user.accountStatus === "suspended").length,
      pendingModeration: articles.length + comments.filter((comment) => !comment.isHidden).length,
      rosterRows: rosterRows.length,
      matchedRosterRows: rosterRows.filter((row) => row.matchedProfileId).length,
      aiCostCents: usage.reduce((sum, row) => sum + row.costCents, 0),
      paymentsTotalKobo: payments.filter((row) => row.status === "succeeded").reduce((sum, row) => sum + row.amountKobo, 0),
    },
    users,
    moderation: { articles, comments },
    appeals,
    invitations,
    aiUsage: { byProvider, recent: usage },
    monetisation: {
      payments,
      subscriptions,
      flutterwaveConfigured: flutterwaveConfigured(),
    },
    roster: { rows: rosterRows, latestJob },
  };
}

export async function warnUserAccount(
  supabase: SupabaseClient,
  actorId: string,
  userId: string,
  reason: string,
) {
  const cleanReason = requireModerationReason(reason, "Add a plain reason before warning this user.");
  const target = await loadTargetProfile(supabase, userId);
  ensureModeratableTarget(target);

  const { data: action, error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      actor_id: actorId,
      target_user_id: userId,
      action: "warn",
      reason_text: cleanReason,
    })
    .select("id")
    .single();

  if (actionError || !action) {
    throw actionError ?? new Error("CampusPress could not save that warning.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: "warned",
      active_warning_action_id: action.id,
      warning_acknowledged_at: null,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  await writeAudit(supabase, actorId, "warn_user", "profiles", userId, { reason: cleanReason });
  const email = await sendModerationWarningEmail({
    to: target.email,
    fullName: target.full_name,
    reason: cleanReason,
    rulesUrl: absoluteUrl(platformRulesUrl),
  });

  return {
    userId,
    actionId: action.id as string,
    email,
    message: "User warned. They will see the warning on their next page load.",
  };
}

export async function suspendUserAccount(
  supabase: SupabaseClient,
  actorId: string,
  userId: string,
  input: {
    durationHours: number;
    reasonCode: string;
    reason: string;
  },
) {
  const cleanReason = requireModerationReason(input.reason, "Add a plain reason before suspending this user.");
  const durationHours = Number(input.durationHours);
  if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 8760) {
    throw new Error("Choose a suspension duration between 1 hour and 365 days.");
  }

  const target = await loadTargetProfile(supabase, userId);
  ensureModeratableTarget(target);
  const now = new Date();
  const suspendedUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
  const nextSessionVersion = numberValue(target.session_version) + 1;

  const { data: action, error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      actor_id: actorId,
      target_user_id: userId,
      action: "suspend",
      reason_code: input.reasonCode || "other",
      reason_text: cleanReason,
      starts_at: now.toISOString(),
      ends_at: suspendedUntil,
    })
    .select("id")
    .single();

  if (actionError || !action) {
    throw actionError ?? new Error("CampusPress could not save that suspension.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: "suspended",
      suspended_at: now.toISOString(),
      suspended_until: suspendedUntil,
      suspension_reason: cleanReason,
      active_warning_action_id: null,
      warning_acknowledged_at: null,
      session_version: nextSessionVersion,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  await updateAuthSessionVersion(userId, nextSessionVersion);
  await writeAudit(supabase, actorId, "suspend_user", "profiles", userId, {
    reason: cleanReason,
    suspendedUntil,
  });
  const email = await sendSuspensionNoticeEmail({
    to: target.email,
    fullName: target.full_name,
    reason: cleanReason,
    rulesUrl: absoluteUrl(platformRulesUrl),
    restorationDate: formatEmailDate(suspendedUntil),
  });

  return {
    userId,
    actionId: action.id as string,
    suspendedUntil,
    email,
    message: "User suspended. Their current sessions will stop on the next request.",
  };
}

export async function banUserAccount(
  supabase: SupabaseClient,
  actorId: string,
  userId: string,
  reason: string,
  actionName: "ban" | "appeal_reject" = "ban",
  sendEmail = true,
) {
  const cleanReason = requireModerationReason(reason, "Add a plain reason before banning this user.");
  const target = await loadTargetProfile(supabase, userId);
  ensureModeratableTarget(target);
  const now = new Date().toISOString();
  const nextSessionVersion = numberValue(target.session_version) + 1;

  const { data: action, error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      actor_id: actorId,
      target_user_id: userId,
      action: actionName,
      reason_text: cleanReason,
      starts_at: now,
    })
    .select("id")
    .single();

  if (actionError || !action) {
    throw actionError ?? new Error("CampusPress could not save that ban.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: "banned",
      suspended_at: null,
      suspended_until: null,
      suspension_reason: null,
      banned_at: now,
      banned_reason: cleanReason,
      active_warning_action_id: null,
      warning_acknowledged_at: null,
      session_version: nextSessionVersion,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  await updateAuthSessionVersion(userId, nextSessionVersion);
  await writeAudit(supabase, actorId, actionName === "ban" ? "ban_user" : "reject_appeal_ban_user", "profiles", userId, {
    reason: cleanReason,
  });
  const email = sendEmail
    ? await sendBanNoticeEmail({
        to: target.email,
        fullName: target.full_name,
        reason: cleanReason,
        rulesUrl: absoluteUrl(platformRulesUrl),
      })
    : { sent: false, message: "Generic ban email suppressed for appeal decision." };

  return {
    userId,
    actionId: action.id as string,
    email,
    message: "User banned. Their current sessions will stop on the next request.",
  };
}

export async function restoreUserAccount(
  supabase: SupabaseClient,
  actorId: string,
  userId: string,
  reason = "Suspension restored by an administrator.",
) {
  const target = await loadTargetProfile(supabase, userId);
  if (target.account_status === "banned") {
    throw new Error("Banned accounts do not have a restore action.");
  }

  const { data: action, error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      actor_id: actorId,
      target_user_id: userId,
      action: "restore",
      reason_text: reason,
    })
    .select("id")
    .single();

  if (actionError || !action) {
    throw actionError ?? new Error("CampusPress could not save that restore action.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: "active",
      suspended_at: null,
      suspended_until: null,
      suspension_reason: null,
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  await updateAuthSessionVersion(userId, numberValue(target.session_version));
  await writeAudit(supabase, actorId, "restore_user", "profiles", userId, { reason });

  return {
    userId,
    actionId: action.id as string,
    message: "User restored.",
  };
}

export async function setUserSuspension(
  supabase: SupabaseClient,
  actorId: string,
  userId: string,
  suspended: boolean,
  reason: string,
) {
  if (suspended) {
    return suspendUserAccount(supabase, actorId, userId, {
      durationHours: 24 * 7,
      reasonCode: "other",
      reason,
    });
  }

  return restoreUserAccount(supabase, actorId, userId, reason || "Suspension restored by an administrator.");
}

export async function decideSuspensionAppeal(
  supabase: SupabaseClient,
  actorId: string,
  appealId: string,
  decision: "accept" | "reject",
  decisionNote: string,
) {
  const { data: appeal, error: appealError } = await supabase
    .from("suspension_appeals")
    .select("id, user_id, status")
    .eq("id", appealId)
    .single();

  if (appealError || !appeal) {
    throw appealError ?? new Error("CampusPress could not find that appeal.");
  }

  if (appeal.status !== "submitted") {
    throw new Error("This appeal has already been reviewed.");
  }

  const target = await loadTargetProfile(supabase, stringValue(appeal.user_id));
  const note = decisionNote.trim() || (decision === "accept" ? "Appeal accepted." : "Appeal rejected.");
  const reviewedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("suspension_appeals")
    .update({
      status: decision === "accept" ? "accepted" : "rejected",
      reviewed_by: actorId,
      reviewed_at: reviewedAt,
      decision_note: note,
    })
    .eq("id", appealId);

  if (updateError) {
    throw updateError;
  }

  if (decision === "accept") {
    await restoreUserAccount(supabase, actorId, target.id, "Suspension appeal accepted.");
    const email = await sendSuspensionAppealAcceptedEmail({
      to: target.email,
      fullName: target.full_name,
      reason: note,
      rulesUrl: absoluteUrl(platformRulesUrl),
    });
    return { appealId, email, message: "Appeal accepted. The suspension was lifted immediately." };
  }

  await banUserAccount(supabase, actorId, target.id, note, "appeal_reject", false);
  const email = await sendSuspensionAppealRejectedEmail({
    to: target.email,
    fullName: target.full_name,
    reason: note,
    rulesUrl: absoluteUrl(platformRulesUrl),
  });
  return { appealId, email, message: "Appeal rejected. The account is now permanently banned." };
}

export async function inviteAdminTierAccount(
  supabase: SupabaseClient,
  actor: AdminProfile,
  input: {
    email: string;
    fullName: string;
    role: "editor" | "admin" | "subadmin";
    origin: string;
  },
) {
  if (!actor.isFullAdmin) {
    throw new Error("Only a full administrator can invite editors, admins, or subadmins.");
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2) {
    throw new Error("Enter a valid invite email and name.");
  }

  if (!["editor", "admin", "subadmin"].includes(input.role)) {
    throw new Error("Choose Editor, Admin, or Subadmin for this invite.");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, account_status")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    throw new Error("This email already has a CampusPress account.");
  }

  const invitationId = globalThis.crypto.randomUUID();
  const redirectTo = `${input.origin}/auth/invite/onboarding`;
  const { error: invitationError } = await supabase.from("account_invitations").insert({
    id: invitationId,
    email,
    full_name: fullName,
    role: input.role,
    invited_by: actor.id,
  });

  if (invitationError) {
    throw invitationError;
  }

  const generated = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        full_name: fullName,
        role: input.role,
        invitation_id: invitationId,
      },
      redirectTo,
    },
  });

  const linkProperties = generated.data.properties as {
    action_link?: string;
    hashed_token?: string;
  };

  if (generated.error || !generated.data.user?.id || !linkProperties.action_link) {
    await supabase.from("account_invitations").delete().eq("id", invitationId);
    throw generated.error ?? new Error("CampusPress could not generate a secure invite link.");
  }

  const userId = generated.data.user.id;
  const { data: institution, error: institutionError } = await supabase
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();

  if (institutionError || !institution?.id) {
    throw new Error("CampusPress could not load the Chrisland institution record.");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    institution_id: institution.id,
    email,
    full_name: fullName,
    role: input.role,
    department_code: "MAS",
    entry_year: new Date().getUTCFullYear(),
    matric_or_staff_id: `MAS/${new Date().getUTCFullYear()}/000`,
    preferences: {
      onboarding_complete: false,
      invited_role: input.role,
    },
    invited_at: new Date().toISOString(),
    invited_by: actor.id,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from("account_invitations").delete().eq("id", invitationId);
    throw profileError;
  }

  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: input.role, session_version: 0 },
    user_metadata: {
      full_name: fullName,
      role: input.role,
      invitation_id: invitationId,
    },
  });

  const { error: updateInviteError } = await supabase
    .from("account_invitations")
    .update({ auth_user_id: userId })
    .eq("id", invitationId);

  if (updateInviteError) {
    throw updateInviteError;
  }

  const emailResult = await sendAdminInviteEmail({
    to: email,
    fullName,
    role: input.role,
    inviteUrl: linkProperties.action_link,
  });

  await writeAudit(supabase, actor.id, "invite_admin_tier_account", "account_invitations", invitationId, {
    email,
    role: input.role,
  });

  const proofInviteUrl = linkProperties.hashed_token
    ? `${redirectTo}?token_hash=${encodeURIComponent(linkProperties.hashed_token)}&type=invite`
    : linkProperties.action_link;

  return {
    invitationId,
    userId,
    inviteUrl: linkProperties.action_link,
    proofInviteUrl,
    email: emailResult,
    message: `Invite ${emailResult.sent ? "sent" : "created"} for ${fullName}.`,
  };
}

export async function removeAdminAccount(
  supabase: SupabaseClient,
  actor: AdminProfile,
  userId: string,
) {
  if (!actor.isFullAdmin) {
    throw new Error("Only a full administrator can remove an admin account.");
  }

  if (actor.id === userId) {
    throw new Error("You cannot remove your own admin account.");
  }

  const target = await loadTargetProfile(supabase, userId);
  if (!["admin", "subadmin"].includes(target.role)) {
    throw new Error("This removal action is only for admin-tier accounts.");
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }

  await writeAudit(supabase, actor.id, "remove_admin_account", "profiles", userId, {
    email: target.email,
    role: target.role,
  });

  return { userId, message: "Admin account removed." };
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

async function loadTargetProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, account_status, session_version")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw error ?? new Error("CampusPress could not find that user.");
  }

  return {
    id: stringValue(data.id),
    email: stringValue(data.email),
    full_name: stringValue(data.full_name),
    role: stringValue(data.role),
    account_status: stringValue(data.account_status),
    session_version: numberValue(data.session_version),
  };
}

function ensureModeratableTarget(target: { role: string; account_status: string }) {
  if (["admin", "subadmin"].includes(target.role)) {
    throw new Error("Admin-tier accounts must be managed by a full administrator.");
  }

  if (target.account_status === "banned") {
    throw new Error("This account is already permanently banned.");
  }
}

function requireModerationReason(reason: string, message: string) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 6) {
    throw new Error(message);
  }
  return cleanReason;
}

async function signedAppealPhotoUrl(supabase: SupabaseClient, path: string) {
  if (!path) {
    return null;
  }

  const { data } = await supabase.storage.from("appeal-ids").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://campuspress-ai.vercel.app";
  return new URL(path, base).toString();
}

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function mapUser(row: Record<string, unknown>): AdminUserRow {
  return {
    id: stringValue(row.id),
    email: stringValue(row.email),
    fullName: stringValue(row.full_name),
    username: nullableString(row.username),
    role: stringValue(row.role),
    verified: Boolean(row.verified),
    accountStatus: stringValue(row.account_status) || "active",
    sessionVersion: numberValue(row.session_version),
    suspendedAt: nullableString(row.suspended_at),
    suspendedUntil: nullableString(row.suspended_until),
    suspensionReason: nullableString(row.suspension_reason),
    bannedAt: nullableString(row.banned_at),
    bannedReason: nullableString(row.banned_reason),
    warningAcknowledgedAt: nullableString(row.warning_acknowledged_at),
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
