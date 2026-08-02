"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  FileDown,
  FileWarning,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildRosterSampleCsv,
  previewRosterCsv,
  rosterDataKinds,
  type RosterCsvRow,
  type RosterDataKind,
} from "@/lib/roster-csv";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AdminOverview, AdminUserRow } from "@/lib/admin";

type OverviewResponse = {
  ok?: boolean;
  message?: string;
  overview?: AdminOverview;
};

const initialRosterKind: RosterDataKind = "student";
type UserModerationAction = "warn" | "suspend" | "ban" | "restore";
const commonModerationReasons = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "misinformation", label: "Misinformation or fabricated reporting" },
  { value: "privacy", label: "Privacy or identity violation" },
  { value: "spam", label: "Spam or platform misuse" },
  { value: "other", label: "Other" },
];

export function AdminDashboardClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [message, setMessage] = useState("Loading administration workspace...");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [acting, setActing] = useState(false);
  const [userAction, setUserAction] = useState<{
    action: UserModerationAction;
    user: AdminUserRow;
  } | null>(null);
  const [durationHours, setDurationHours] = useState("168");
  const [reasonCode, setReasonCode] = useState("harassment");
  const [reason, setReason] = useState("Account flagged for a CampusPress rules violation.");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "admin" | "subadmin">("editor");
  const [appealNote, setAppealNote] = useState("Reviewed by CampusPress administration.");
  const [rosterKind, setRosterKind] = useState<RosterDataKind>(initialRosterKind);
  const [rosterCsv, setRosterCsv] = useState(() => buildRosterSampleCsv(initialRosterKind));
  const rosterPreview = useMemo(() => {
    try {
      return { error: "", rows: previewRosterCsv(rosterCsv, rosterKind).rows };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "CampusPress could not preview that roster CSV.",
        rows: [] as RosterCsvRow[],
      };
    }
  }, [rosterCsv, rosterKind]);

  const accessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadOverview = useCallback(async (successMessage = "Administration workspace loaded.") => {
    const token = await accessToken();
    if (!token) {
      setLoading(false);
      setMessage("Sign in as an administrator to open this workspace.");
      return;
    }

    const response = await fetch("/api/admin/overview", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = (await response.json().catch(() => ({}))) as OverviewResponse;
    setLoading(false);
    if (!response.ok || !result.ok || !result.overview) {
      setForbidden(response.status === 403);
      setMessage(result.message ?? "CampusPress could not load the administration workspace.");
      return;
    }

    setForbidden(false);
    setOverview(result.overview);
    setMessage(successMessage);
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOverview]);

  async function adminPost(path: string, body: BodyInit, contentType = "application/json") {
    const token = await accessToken();
    if (!token) {
      setMessage("Sign in as an administrator before saving changes.");
      return null;
    }

    setActing(true);
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body,
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; authorizationUrl?: string };
    setActing(false);

    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "CampusPress could not save that admin action.");
      return null;
    }

    setMessage(result.message ?? "Admin action saved.");
    return result;
  }

  async function confirmUserModeration() {
    if (!userAction) {
      return;
    }

    const result = await adminPost(
      "/api/admin/users/moderation",
      JSON.stringify({
        userId: userAction.user.id,
        action: userAction.action,
        durationHours: Number(durationHours),
        reasonCode,
        reason,
      }),
    );
    if (result) {
      setUserAction(null);
      await loadOverview(result.message);
    }
  }

  async function inviteAdminTier() {
    const result = await adminPost(
      "/api/admin/invites",
      JSON.stringify({
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
      }),
    );
    if (result) {
      setInviteName("");
      setInviteEmail("");
      await loadOverview(result.message);
    }
  }

  async function decideAppeal(appealId: string, decision: "accept" | "reject") {
    const result = await adminPost(
      `/api/admin/appeals/${encodeURIComponent(appealId)}/decision`,
      JSON.stringify({
        decision,
        decisionNote: appealNote,
      }),
    );
    if (result) {
      await loadOverview(result.message);
    }
  }

  async function moderateArticle(targetId: string, action: "publish" | "hide" | "restore") {
    const result = await adminPost(
      "/api/admin/moderation",
      JSON.stringify({ targetType: "article", targetId, action }),
    );
    if (result) {
      await loadOverview(result.message);
    }
  }

  async function moderateComment(targetId: string, hidden: boolean) {
    const result = await adminPost(
      "/api/admin/moderation",
      JSON.stringify({ targetType: "comment", targetId, hidden }),
    );
    if (result) {
      await loadOverview(result.message);
    }
  }

  async function uploadRoster() {
    if (rosterPreview.error || rosterPreview.rows.length === 0) {
      setMessage(rosterPreview.error || "Add at least one roster row before confirming upload.");
      return;
    }

    const result = await adminPost(`/api/admin/roster/upload?type=${encodeURIComponent(rosterKind)}`, rosterCsv, "text/csv");
    if (result) {
      await loadOverview(result.message);
    }
  }

  async function runFlutterwaveTest() {
    const result = await adminPost("/api/admin/flutterwave/initialize", JSON.stringify({}));
    if (!result?.authorizationUrl) {
      return;
    }

    window.location.href = result.authorizationUrl;
  }

  async function handleRosterFile(file: File | null) {
    if (!file) {
      return;
    }

    setRosterCsv(await file.text());
  }

  function changeRosterKind(nextKind: RosterDataKind) {
    setRosterKind(nextKind);
    setRosterCsv(buildRosterSampleCsv(nextKind));
  }

  function downloadRosterSample() {
    const blob = new Blob([buildRosterSampleCsv(rosterKind)], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campuspress-${rosterKind}-roster-sample.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <AuthenticatedShell>
      {forbidden ? (
        <main className="min-h-dvh bg-background px-6 py-8 text-foreground md:px-12" data-testid="admin-denied">
          <section className="mx-auto grid max-w-3xl gap-4 border-b pb-8">
            <p className="text-sm font-semibold text-primary">Administration</p>
            <h1 className="font-serif text-5xl font-semibold leading-tight">Access restricted</h1>
            <p className="text-sm leading-6 text-muted-foreground">{message}</p>
          </section>
        </main>
      ) : (
        <main className="min-h-dvh bg-background px-6 py-8 text-foreground md:px-12" data-testid="admin-dashboard">
        <section className="mx-auto grid max-w-7xl gap-8">
          <header className="grid gap-4 border-b pb-6">
            <p className="text-sm font-semibold text-primary">Administration</p>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="grid gap-3">
                <h1 className="font-serif text-5xl font-semibold leading-tight">Platform controls</h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Manage users, roster verification, moderation, AI cost monitoring, and Flutterwave test-mode records from one workspace.
                </p>
              </div>
              <Button disabled={loading || acting} onClick={() => void loadOverview()} type="button" variant="outline">
                {loading ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
                Refresh
              </Button>
            </div>
            <StatusMessage message={message} />
          </header>

          {overview ? (
            <>
              <Metrics overview={overview} />
              <div className="grid gap-8 xl:grid-cols-2">
                <UsersPanel
                  acting={acting}
                  onOpenAction={(user, action) => setUserAction({ user, action })}
                  overview={overview}
                />
                <ModerationPanel
                  acting={acting}
                  onModerateArticle={moderateArticle}
                  onModerateComment={moderateComment}
                  overview={overview}
                />
              </div>
              <div className="grid gap-8 xl:grid-cols-2">
                <AppealsPanel
                  acting={acting}
                  appealNote={appealNote}
                  onAppealNoteChange={setAppealNote}
                  onDecideAppeal={decideAppeal}
                  overview={overview}
                />
                <InvitesPanel
                  acting={acting}
                  inviteEmail={inviteEmail}
                  inviteName={inviteName}
                  inviteRole={inviteRole}
                  onInvite={inviteAdminTier}
                  setInviteEmail={setInviteEmail}
                  setInviteName={setInviteName}
                  setInviteRole={setInviteRole}
                  overview={overview}
                />
              </div>
              <div className="grid gap-8 xl:grid-cols-2">
                <RosterPanel
                  acting={acting}
                  onFile={handleRosterFile}
                  onDownloadSample={downloadRosterSample}
                  onKindChange={changeRosterKind}
                  onUpload={uploadRoster}
                  overview={overview}
                  previewError={rosterPreview.error}
                  previewRows={rosterPreview.rows}
                  rosterCsv={rosterCsv}
                  rosterKind={rosterKind}
                  setRosterCsv={setRosterCsv}
                />
                <UsagePanel overview={overview} />
              </div>
              <FlutterwavePanel acting={acting} onRunTest={runFlutterwaveTest} overview={overview} />
              <AuditLogPanel overview={overview} />
            </>
          ) : (
            <div className="rounded-md border bg-card p-6 text-sm leading-6 text-muted-foreground">
              {loading ? "Loading administration data..." : "No administration data is available."}
            </div>
          )}
        </section>
        {userAction ? (
          <UserModerationModal
            action={userAction.action}
            acting={acting}
            durationHours={durationHours}
            onCancel={() => setUserAction(null)}
            onConfirm={confirmUserModeration}
            reason={reason}
            reasonCode={reasonCode}
            setDurationHours={setDurationHours}
            setReason={setReason}
            setReasonCode={setReasonCode}
            user={userAction.user}
          />
        ) : null}
        </main>
      )}
    </AuthenticatedShell>
  );
}

function Metrics({ overview }: { overview: AdminOverview }) {
  const metrics = [
    { label: "Users", value: overview.metrics.totalUsers.toString(), icon: <Users aria-hidden /> },
    { label: "Suspended", value: overview.metrics.suspendedUsers.toString(), icon: <ShieldAlert aria-hidden /> },
    { label: "Moderation", value: overview.metrics.pendingModeration.toString(), icon: <FileWarning aria-hidden /> },
    { label: "Roster matches", value: `${overview.metrics.matchedRosterRows}/${overview.metrics.rosterRows}`, icon: <BadgeCheck aria-hidden /> },
    { label: "AI usage", value: `${overview.metrics.aiCostCents.toFixed(2)} cents`, icon: <RefreshCcw aria-hidden /> },
    { label: "Payments", value: formatNaira(overview.metrics.paymentsTotalKobo), icon: <Banknote aria-hidden /> },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <div className="grid gap-3 rounded-md border bg-card p-5" key={metric.label}>
          <div className="flex items-center justify-between gap-4 text-muted-foreground">
            <p className="text-sm font-semibold">{metric.label}</p>
            <span className="text-primary [&_svg]:size-5">{metric.icon}</span>
          </div>
          <p className="text-3xl font-semibold">{metric.value}</p>
        </div>
      ))}
    </section>
  );
}

function UsersPanel({
  acting,
  onOpenAction,
  overview,
}: {
  acting: boolean;
  onOpenAction: (user: AdminUserRow, action: UserModerationAction) => void;
  overview: AdminOverview;
}) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">User management</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Warn active accounts, suspend accounts for a timed review period, ban serious violations, or restore suspended users early.
        </p>
      </div>
      <div className="grid gap-3">
        {overview.users.slice(0, 8).map((user) => (
          <div className="grid gap-3 border-b pb-3 last:border-b-0 last:pb-0" data-testid={`admin-user-${user.id}`} key={user.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <p className="text-sm font-semibold">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{user.role}</Badge>
                  {user.verified ? <Badge variant="verified">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                  <Badge variant={user.accountStatus === "active" ? "outline" : "default"}>{user.accountStatus}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  aria-label={`Warn ${user.fullName}`}
                  disabled={acting || user.accountStatus === "banned" || isAdminTier(user.role)}
                  onClick={() => onOpenAction(user, "warn")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Warn
                </Button>
                <Button
                  aria-label={`Suspend ${user.fullName}`}
                  disabled={acting || user.accountStatus === "suspended" || user.accountStatus === "banned" || isAdminTier(user.role)}
                  onClick={() => onOpenAction(user, "suspend")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Suspend
                </Button>
                <Button
                  aria-label={`Ban ${user.fullName}`}
                  disabled={acting || user.accountStatus === "banned" || isAdminTier(user.role)}
                  onClick={() => onOpenAction(user, "ban")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Ban
                </Button>
                {user.accountStatus === "suspended" ? (
                  <Button
                    aria-label={`Restore ${user.fullName}`}
                    disabled={acting}
                    onClick={() => onOpenAction(user, "restore")}
                    size="sm"
                    type="button"
                  >
                    Restore
                  </Button>
                ) : null}
              </div>
            </div>
            {user.suspensionReason ? <p className="text-xs leading-5 text-muted-foreground">{user.suspensionReason}</p> : null}
            {user.suspendedUntil ? <p className="text-xs leading-5 text-muted-foreground">Restores {formatDate(user.suspendedUntil)}</p> : null}
            {user.bannedReason ? <p className="text-xs leading-5 text-muted-foreground">Ban reason: {user.bannedReason}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function UserModerationModal({
  action,
  acting,
  durationHours,
  onCancel,
  onConfirm,
  reason,
  reasonCode,
  setDurationHours,
  setReason,
  setReasonCode,
  user,
}: {
  action: UserModerationAction;
  acting: boolean;
  durationHours: string;
  onCancel: () => void;
  onConfirm: () => void;
  reason: string;
  reasonCode: string;
  setDurationHours: (value: string) => void;
  setReason: (value: string) => void;
  setReasonCode: (value: string) => void;
  user: AdminUserRow;
}) {
  const titleId = useId();
  const title =
    action === "warn"
      ? `Warn ${user.fullName}?`
      : action === "suspend"
        ? `Suspend ${user.fullName}?`
        : action === "ban"
          ? `Ban ${user.fullName}?`
          : `Restore ${user.fullName}?`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 backdrop-blur">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-lg gap-5 rounded-md border bg-card p-6 shadow-sm"
        role="dialog"
      >
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-primary">Account moderation</p>
          <h2 className="text-2xl font-semibold" id={titleId}>
            {title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {action === "warn"
              ? "Warn keeps the account active and shows a dismissible rules warning on the user's next page load."
              : action === "suspend"
                ? "Suspend signs the user out on their next request and shows the restoration date plus appeal option."
                : action === "ban"
                  ? "Ban signs the user out on their next request and blocks future login or signup with no appeal path."
                  : "Restore lifts the suspension immediately and allows the user to sign in again."}
          </p>
        </div>

        {action === "suspend" ? (
          <label className="grid gap-2 text-sm font-semibold">
            Suspension period
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setDurationHours(event.target.value)}
              value={durationHours}
            >
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </select>
          </label>
        ) : null}

        {action !== "restore" ? (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              Reason
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setReasonCode(event.target.value)}
                value={reasonCode}
              >
                {commonModerationReasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Plain-English note
              <textarea
                className="min-h-28 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
          </>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={acting} onClick={onConfirm} type="button">
            {acting ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function AppealsPanel({
  acting,
  appealNote,
  onAppealNoteChange,
  onDecideAppeal,
  overview,
}: {
  acting: boolean;
  appealNote: string;
  onAppealNoteChange: (value: string) => void;
  onDecideAppeal: (appealId: string, decision: "accept" | "reject") => void;
  overview: AdminOverview;
}) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Appeals</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Review suspended-user appeals. Accept lifts the suspension immediately. Reject permanently bans the account.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        Decision note
        <textarea
          className="min-h-24 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => onAppealNoteChange(event.target.value)}
          value={appealNote}
        />
      </label>
      <div className="grid gap-4">
        {overview.appeals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suspension appeals yet.</p>
        ) : (
          overview.appeals.slice(0, 5).map((appeal) => (
            <article className="grid gap-3 border-b pb-4 last:border-b-0" key={appeal.id}>
              <div className="grid gap-1">
                <p className="text-sm font-semibold">{appeal.userName}</p>
                <p className="text-xs text-muted-foreground">
                  {appeal.userEmail || "No email"} / {appeal.status} / submitted {formatDate(appeal.submittedAt)}
                </p>
              </div>
              <p className="rounded-md border bg-background p-3 text-sm leading-6">{appeal.explanation}</p>
              {Object.entries(appeal.answers).length > 0 ? (
                <div className="grid gap-2 rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
                  {Object.entries(appeal.answers).map(([key, value]) => (
                    <p key={key}>
                      <span className="font-semibold text-foreground">{key}: </span>
                      {String(value)}
                    </p>
                  ))}
                </div>
              ) : null}
              {appeal.idPhotoUrl ? (
                <a className="text-sm font-semibold text-primary" href={appeal.idPhotoUrl} rel="noreferrer" target="_blank">
                  Open submitted ID photo
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">ID photo signed link unavailable.</p>
              )}
              {appeal.status === "submitted" ? (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={acting} onClick={() => onDecideAppeal(appeal.id, "accept")} size="sm" type="button">
                    Accept
                  </Button>
                  <Button disabled={acting} onClick={() => onDecideAppeal(appeal.id, "reject")} size="sm" type="button" variant="outline">
                    Reject
                  </Button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function InvitesPanel({
  acting,
  inviteEmail,
  inviteName,
  inviteRole,
  onInvite,
  overview,
  setInviteEmail,
  setInviteName,
  setInviteRole,
}: {
  acting: boolean;
  inviteEmail: string;
  inviteName: string;
  inviteRole: "editor" | "admin" | "subadmin";
  onInvite: () => void;
  overview: AdminOverview;
  setInviteEmail: (value: string) => void;
  setInviteName: (value: string) => void;
  setInviteRole: (value: "editor" | "admin" | "subadmin") => void;
}) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Admin-created accounts</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Full admins can invite editors, admins, or subadmins. Subadmins cannot invite admin-tier users.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Name
          <Input onChange={(event) => setInviteName(event.target.value)} value={inviteName} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <Input onChange={(event) => setInviteEmail(event.target.value)} type="email" value={inviteEmail} />
        </label>
      </div>
      <div className="grid gap-3">
        <p className="text-sm font-semibold">Invite role</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: "Invite editor", value: "editor" },
            { label: "Invite admin", value: "admin" },
            { label: "Invite subadmin", value: "subadmin" },
          ].map((item) => (
            <button
              aria-pressed={inviteRole === item.value}
              className={
                inviteRole === item.value
                  ? "rounded-md border border-primary bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                  : "rounded-md border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground"
              }
              key={item.value}
              onClick={() => setInviteRole(item.value as "editor" | "admin" | "subadmin")}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <Button disabled={acting} onClick={onInvite} type="button">
        <UserPlus aria-hidden />
        Send invite
      </Button>
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold">Recent invites</h3>
        {overview.invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin-created invites yet.</p>
        ) : (
          overview.invitations.slice(0, 5).map((invite) => (
            <p className="text-xs text-muted-foreground" key={invite.id}>
              {invite.fullName} / {invite.email} / {invite.role} / {invite.status}
            </p>
          ))
        )}
      </div>
    </section>
  );
}

function ModerationPanel({
  acting,
  onModerateArticle,
  onModerateComment,
  overview,
}: {
  acting: boolean;
  onModerateArticle: (targetId: string, action: "publish" | "hide" | "restore") => void;
  onModerateComment: (targetId: string, hidden: boolean) => void;
  overview: AdminOverview;
}) {
  const articleCopy = {
    publish: "Publish: make this live for readers.",
    hide: "Hide: remove from public view without deleting it.",
    restore: "Restore: bring a hidden item back for review.",
  };

  return (
    <section className="grid gap-5 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Moderation</h2>
        <p className="text-sm leading-6 text-muted-foreground">Review submitted articles and recent comments from the platform record.</p>
      </div>
      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">Articles</h3>
        {overview.moderation.articles.slice(0, 5).map((article) => (
          <div className="grid gap-3 border-b pb-3 last:border-b-0" data-testid={`admin-article-${article.id}`} key={article.id}>
            <div>
              <p className="text-sm font-semibold">{article.title}</p>
              <p className="text-xs text-muted-foreground">{article.authorName} / {article.status}</p>
            </div>
            <div className="grid gap-2">
              <ModerationActionButton
                ariaLabel={`Publish ${article.title}`}
                disabled={acting}
                explanation={articleCopy.publish}
                label="Publish"
                onClick={() => onModerateArticle(article.id, "publish")}
              />
              <ModerationActionButton
                ariaLabel={`Hide ${article.title}`}
                disabled={acting}
                explanation={articleCopy.hide}
                label="Hide"
                onClick={() => onModerateArticle(article.id, "hide")}
                variant="outline"
              />
              <ModerationActionButton
                ariaLabel={`Restore ${article.title}`}
                disabled={acting}
                explanation={articleCopy.restore}
                label="Restore"
                onClick={() => onModerateArticle(article.id, "restore")}
                variant="outline"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">Comments</h3>
        {overview.moderation.comments.slice(0, 5).map((comment) => (
          <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-b-0" data-testid={`admin-comment-${comment.id}`} key={comment.id}>
            <div className="grid gap-1">
              <p className="text-sm leading-6">{clip(comment.body, 120)}</p>
              <p className="text-xs text-muted-foreground">{comment.isHidden ? "Hidden" : "Visible"}</p>
            </div>
            <ModerationActionButton
              ariaLabel={`${comment.isHidden ? "Restore" : "Hide"} comment ${comment.id}`}
              disabled={acting}
              explanation={
                comment.isHidden
                  ? "Restore: make this hidden comment visible again."
                  : "Hide: remove this comment from public view without deleting it."
              }
              label={comment.isHidden ? "Restore" : "Hide"}
              onClick={() => onModerateComment(comment.id, !comment.isHidden)}
              variant="outline"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ModerationActionButton({
  ariaLabel,
  disabled,
  explanation,
  label,
  onClick,
  variant = "default",
}: {
  ariaLabel: string;
  disabled: boolean;
  explanation: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <Button aria-label={ariaLabel} disabled={disabled} onClick={onClick} size="sm" type="button" variant={variant}>
        {label}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">{explanation}</p>
    </div>
  );
}

function RosterPanel({
  acting,
  onFile,
  onDownloadSample,
  onKindChange,
  onUpload,
  overview,
  previewError,
  previewRows,
  rosterCsv,
  rosterKind,
  setRosterCsv,
}: {
  acting: boolean;
  onFile: (file: File | null) => void;
  onDownloadSample: () => void;
  onKindChange: (kind: RosterDataKind) => void;
  onUpload: () => void;
  overview: AdminOverview;
  previewError: string;
  previewRows: RosterCsvRow[];
  rosterCsv: string;
  rosterKind: RosterDataKind;
  setRosterCsv: (value: string) => void;
}) {
  const hasPreview = previewRows.length > 0 && !previewError;

  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Roster CSV upload</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Upload department code, matric or staff ID, full name, and role. Matching profiles are verified retroactively.
        </p>
      </div>
      <div className="grid gap-3" role="radiogroup" aria-label="Roster data type">
        <p className="text-sm font-semibold">Roster type</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {rosterDataKinds.map((kind) => (
            <button
              aria-pressed={rosterKind === kind.id}
              className={`grid gap-1 rounded-md border p-4 text-left text-sm transition-colors ${
                rosterKind === kind.id ? "border-primary bg-primary/10" : "bg-background hover:bg-accent"
              }`}
              key={kind.id}
              onClick={() => onKindChange(kind.id)}
              type="button"
            >
              <span className="font-semibold">{kind.label}</span>
              <span className="leading-5 text-muted-foreground">{kind.description}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button className="whitespace-nowrap" onClick={onDownloadSample} type="button" variant="outline">
          <FileDown aria-hidden />
          Download sample CSV
        </Button>
        <Input
          accept=".csv,text/csv"
          aria-label="Choose roster CSV file"
          onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </div>
      <textarea
        aria-label="Roster CSV contents"
        className="min-h-48 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => setRosterCsv(event.target.value)}
        value={rosterCsv}
      />
      <div className="grid gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-sm font-semibold">Preview</h3>
          <p className="text-xs text-muted-foreground">
            {hasPreview ? `${previewRows.length} ${previewRows.length === 1 ? "row" : "rows"} parsed` : "No valid rows parsed yet"}
          </p>
        </div>
        {previewError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive" role="alert">
            {previewError}
          </p>
        ) : hasPreview ? (
          <>
            <div className="grid rounded-md border sm:hidden">
              {previewRows.slice(0, 6).map((row) => (
                <div className="grid gap-3 border-b p-3 last:border-b-0" key={`${row.department_code}-${row.matric_or_staff_id}`}>
                  <PreviewField label="Department" value={row.department_code} />
                  <PreviewField label="Matric or staff ID" value={row.matric_or_staff_id} />
                  <PreviewField label="Name" value={row.full_name} />
                  <PreviewField label="Role" value={row.role} />
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-md border sm:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Department</th>
                    <th className="px-3 py-2 font-semibold">Matric or staff ID</th>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 6).map((row) => (
                    <tr className="border-t" key={`${row.department_code}-${row.matric_or_staff_id}`}>
                      <td className="whitespace-nowrap px-3 py-2">{row.department_code}</td>
                      <td className="whitespace-nowrap px-3 py-2">{row.matric_or_staff_id}</td>
                      <td className="px-3 py-2">{row.full_name}</td>
                      <td className="whitespace-nowrap px-3 py-2">{row.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
            Choose a CSV file or paste rows to preview them before upload.
          </p>
        )}
        {previewRows.length > 6 ? <p className="text-xs text-muted-foreground">Showing 6 of {previewRows.length} rows.</p> : null}
      </div>
      <Button aria-label="Confirm roster CSV upload" disabled={acting || !hasPreview} onClick={onUpload} type="button">
        <Upload aria-hidden />
        Confirm upload
      </Button>
      <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
        <p>Latest roster job: {overview.roster.latestJob?.status ?? "No roster job yet"}</p>
        <p>Recent rows: {overview.roster.rows.length}</p>
      </div>
    </section>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="break-words text-sm">{value}</span>
    </div>
  );
}

function UsagePanel({ overview }: { overview: AdminOverview }) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">AI usage</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          This section shows real dollar and cent costs spent on AI providers, so admins can monitor platform AI spend.
        </p>
      </div>
      <div className="grid gap-3">
        {overview.aiUsage.byProvider.length > 0 ? overview.aiUsage.byProvider.map((row) => (
          <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0" key={row.provider}>
            <div>
              <p className="text-sm font-semibold">{row.provider}</p>
              <p className="text-xs text-muted-foreground">{row.requests} requests</p>
            </div>
            <p className="text-sm font-semibold">{row.costCents.toFixed(2)} cents</p>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">No AI usage rows are available yet.</p>
        )}
      </div>
      <div className="grid gap-2">
        {overview.aiUsage.recent.slice(0, 5).map((row) => (
          <p className="text-xs text-muted-foreground" key={row.id}>{row.provider} / {row.modelName} / {row.status}</p>
        ))}
      </div>
    </section>
  );
}

function FlutterwavePanel({
  acting,
  onRunTest,
  overview,
}: {
  acting: boolean;
  onRunTest: () => void;
  overview: AdminOverview;
}) {
  return (
    <section className="grid gap-5 rounded-md border bg-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="grid gap-2">
          <h2 className="text-xl font-semibold">Flutterwave monetisation scaffolding</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            This is a developer/admin testing tool for confirming the payment integration works. It is not a live revenue dashboard yet.
          </p>
        </div>
        <Button aria-label="Run Flutterwave test transaction" disabled={acting} onClick={onRunTest} type="button">
          <Banknote aria-hidden />
          Run test transaction
        </Button>
      </div>
      <Badge className="w-fit" variant={overview.monetisation.flutterwaveConfigured ? "verified" : "outline"}>
        {overview.monetisation.flutterwaveConfigured ? "Flutterwave keys configured" : "Flutterwave keys missing"}
      </Badge>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Recent payments</h3>
          {overview.monetisation.payments.slice(0, 5).map((payment) => (
            <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0" key={payment.id}>
              <div>
                <p className="text-sm font-semibold">{payment.status}</p>
                <p className="text-xs text-muted-foreground">{payment.providerReference ?? "No reference"}</p>
              </div>
              <p className="text-sm font-semibold">{formatNaira(payment.amountKobo)}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Subscriptions</h3>
          {overview.monetisation.subscriptions.slice(0, 5).map((subscription) => (
            <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0" key={subscription.id}>
              <div>
                <p className="text-sm font-semibold">{subscription.status}</p>
                <p className="text-xs text-muted-foreground">{subscription.provider}</p>
              </div>
              <p className="text-xs text-muted-foreground">{subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "No end date"}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AuditLogPanel({ overview }: { overview: AdminOverview }) {
  return (
    <section className="grid gap-5 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Audit log</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Review the most recent system actions recorded by the platform.
        </p>
      </div>
      {overview.auditLog.length === 0 ? (
        <p className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
          No audit entries are available yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Actor</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Table</th>
                <th className="px-3 py-2 font-semibold">Record id</th>
                <th className="px-3 py-2 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {overview.auditLog.map((entry) => (
                <tr className="border-t align-top" key={entry.id}>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{entry.actorName}</p>
                    {entry.actorEmail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{entry.actorEmail}</p>
                    ) : null}
                  </td>
                  <td className="break-words px-3 py-3 font-mono text-xs">{entry.action}</td>
                  <td className="px-3 py-3">{entry.tableName}</td>
                  <td className="break-all px-3 py-3 font-mono text-xs">
                    {entry.recordId ?? "No record id"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatDateTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusMessage({ message }: { message: string }) {
  return <p className="rounded-md border bg-card p-3 text-sm font-semibold text-muted-foreground">{message}</p>;
}

function formatNaira(amountKobo: number) {
  return new Intl.NumberFormat("en-NG", { currency: "NGN", style: "currency" }).format(amountKobo / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function clip(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isAdminTier(role: string) {
  return role === "admin" || role === "subadmin";
}
