"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  FileWarning,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";

import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AdminOverview, AdminUserRow } from "@/lib/admin";

type OverviewResponse = {
  ok?: boolean;
  message?: string;
  overview?: AdminOverview;
};

const sampleCsv = [
  "department_code,matric_or_staff_id,full_name,role",
  "MAS,MAS/2024/101,Phase Eight Journalist,journalist",
].join("\n");

export function AdminDashboardClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [message, setMessage] = useState("Loading administration workspace...");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [acting, setActing] = useState(false);
  const [reason, setReason] = useState("Account paused by CampusPress administration.");
  const [rosterCsv, setRosterCsv] = useState(sampleCsv);

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
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; authorizationUrl?: string; simulated?: boolean };
    setActing(false);

    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "CampusPress could not save that admin action.");
      return null;
    }

    setMessage(result.message ?? "Admin action saved.");
    return result;
  }

  async function toggleSuspension(user: AdminUserRow) {
    const result = await adminPost(
      "/api/admin/users/suspension",
      JSON.stringify({
        userId: user.id,
        suspended: !user.suspendedAt,
        reason,
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
    const result = await adminPost("/api/admin/roster/upload", rosterCsv, "text/csv");
    if (result) {
      await loadOverview(result.message);
    }
  }

  async function runPaystackTest() {
    const result = await adminPost("/api/admin/paystack/initialize", JSON.stringify({}));
    if (!result?.authorizationUrl) {
      return;
    }

    if (result.simulated) {
      const callbackUrl = new URL(result.authorizationUrl);
      const callback = await fetch(`${callbackUrl.pathname}${callbackUrl.search}`);
      await loadOverview(callback.ok ? "Local Paystack test payment completed." : "Local Paystack callback failed.");
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
                  Manage users, roster verification, moderation, AI cost monitoring, and Paystack test-mode records from one workspace.
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
                <UsersPanel acting={acting} onToggleSuspension={toggleSuspension} overview={overview} reason={reason} setReason={setReason} />
                <ModerationPanel
                  acting={acting}
                  onModerateArticle={moderateArticle}
                  onModerateComment={moderateComment}
                  overview={overview}
                />
              </div>
              <div className="grid gap-8 xl:grid-cols-2">
                <RosterPanel
                  acting={acting}
                  onFile={handleRosterFile}
                  onUpload={uploadRoster}
                  overview={overview}
                  rosterCsv={rosterCsv}
                  setRosterCsv={setRosterCsv}
                />
                <UsagePanel overview={overview} />
              </div>
              <PaystackPanel acting={acting} onRunTest={runPaystackTest} overview={overview} />
            </>
          ) : (
            <div className="rounded-md border bg-card p-6 text-sm leading-6 text-muted-foreground">
              {loading ? "Loading administration data..." : "No administration data is available."}
            </div>
          )}
        </section>
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
  onToggleSuspension,
  overview,
  reason,
  setReason,
}: {
  acting: boolean;
  onToggleSuspension: (user: AdminUserRow) => void;
  overview: AdminOverview;
  reason: string;
  setReason: (value: string) => void;
}) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">User management</h2>
        <p className="text-sm leading-6 text-muted-foreground">Suspend accounts that should not publish or comment while under review.</p>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        Suspension reason
        <Input onChange={(event) => setReason(event.target.value)} value={reason} />
      </label>
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
                  {user.suspendedAt ? <Badge variant="default">Suspended</Badge> : null}
                </div>
              </div>
              <Button
                aria-label={`${user.suspendedAt ? "Restore" : "Suspend"} ${user.fullName}`}
                disabled={acting || user.role === "admin"}
                onClick={() => onToggleSuspension(user)}
                size="sm"
                type="button"
                variant="outline"
              >
                {user.suspendedAt ? "Restore" : "Suspend"}
              </Button>
            </div>
            {user.suspensionReason ? <p className="text-xs leading-5 text-muted-foreground">{user.suspensionReason}</p> : null}
          </div>
        ))}
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
            <div className="flex flex-wrap gap-2">
              <Button aria-label={`Publish ${article.title}`} disabled={acting} onClick={() => onModerateArticle(article.id, "publish")} size="sm" type="button">Publish</Button>
              <Button aria-label={`Hide ${article.title}`} disabled={acting} onClick={() => onModerateArticle(article.id, "hide")} size="sm" type="button" variant="outline">Hide</Button>
              <Button aria-label={`Restore ${article.title}`} disabled={acting} onClick={() => onModerateArticle(article.id, "restore")} size="sm" type="button" variant="outline">Restore</Button>
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
            <Button
              aria-label={`${comment.isHidden ? "Restore" : "Hide"} comment ${comment.id}`}
              disabled={acting}
              onClick={() => onModerateComment(comment.id, !comment.isHidden)}
              size="sm"
              type="button"
              variant="outline"
            >
              {comment.isHidden ? "Restore" : "Hide"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function RosterPanel({
  acting,
  onFile,
  onUpload,
  overview,
  rosterCsv,
  setRosterCsv,
}: {
  acting: boolean;
  onFile: (file: File | null) => void;
  onUpload: () => void;
  overview: AdminOverview;
  rosterCsv: string;
  setRosterCsv: (value: string) => void;
}) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Roster CSV upload</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Upload department code, matric or staff ID, full name, and role. Matching profiles are verified retroactively.
        </p>
      </div>
      <Input accept=".csv,text/csv" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} type="file" />
      <textarea
        className="min-h-48 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => setRosterCsv(event.target.value)}
        value={rosterCsv}
      />
      <Button aria-label="Upload roster CSV" disabled={acting} onClick={onUpload} type="button">
        <Upload aria-hidden />
        Upload roster
      </Button>
      <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
        <p>Latest roster job: {overview.roster.latestJob?.status ?? "No roster job yet"}</p>
        <p>Recent rows: {overview.roster.rows.length}</p>
      </div>
    </section>
  );
}

function UsagePanel({ overview }: { overview: AdminOverview }) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">AI usage</h2>
        <p className="text-sm leading-6 text-muted-foreground">Current provider cost and usage based on `ai_usage_log`.</p>
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

function PaystackPanel({
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
          <h2 className="text-xl font-semibold">Paystack monetisation scaffolding</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Test-mode payments write to `payments` and activate `subscriptions`. Without a Paystack secret, CampusPress uses a local test callback.
          </p>
        </div>
        <Button aria-label="Run Paystack test transaction" disabled={acting} onClick={onRunTest} type="button">
          <Banknote aria-hidden />
          Run test transaction
        </Button>
      </div>
      <Badge className="w-fit" variant={overview.monetisation.paystackConfigured ? "verified" : "outline"}>
        {overview.monetisation.paystackConfigured ? "Paystack secret configured" : "Local test mode"}
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

function StatusMessage({ message }: { message: string }) {
  return <p className="rounded-md border bg-card p-3 text-sm font-semibold text-muted-foreground">{message}</p>;
}

function formatNaira(amountKobo: number) {
  return new Intl.NumberFormat("en-NG", { currency: "NGN", style: "currency" }).format(amountKobo / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function clip(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
