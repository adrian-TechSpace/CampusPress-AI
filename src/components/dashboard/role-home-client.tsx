"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquareWarning,
  PenLine,
  Shield,
  UploadCloud,
} from "lucide-react";

import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { buttonVariants } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AdminHomePayload, EditorHomePayload, JournalistHomePayload, RoleHomePayload } from "@/lib/role-home";

type RoleHomeClientProps = {
  role: "journalist" | "editor" | "admin";
};

type HomeResponse = {
  ok?: boolean;
  message?: string;
  home?: RoleHomePayload;
};

export function RoleHomeClient({ role }: RoleHomeClientProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [home, setHome] = useState<RoleHomePayload | null>(null);
  const [message, setMessage] = useState("Loading your CampusPress home...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (active) {
          setLoading(false);
          setMessage("Sign in with the right role to open this CampusPress home.");
        }
        return;
      }

      const response = await fetch(`/api/home/${role}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as HomeResponse;
      if (!active) {
        return;
      }

      setLoading(false);
      if (!response.ok || !result.ok || !result.home) {
        setMessage(result.message ?? "CampusPress could not load this home page.");
        return;
      }

      setHome(result.home);
      setMessage("Home loaded.");
    }

    void loadHome();

    return () => {
      active = false;
    };
  }, [role, supabase]);

  return (
    <AuthenticatedShell>
      <main className="min-h-dvh bg-background px-6 py-8 text-foreground md:px-12" data-testid={`${role}-home`}>
        <section className="mx-auto grid max-w-7xl gap-8">
          {home ? <RoleHome home={home} /> : <LoadingState loading={loading} message={message} role={role} />}
        </section>
      </main>
    </AuthenticatedShell>
  );
}

function RoleHome({ home }: { home: RoleHomePayload }) {
  if (home.kind === "journalist") {
    return <JournalistHome home={home} />;
  }

  if (home.kind === "editor") {
    return <EditorHome home={home} />;
  }

  return <AdminHome home={home} />;
}

function JournalistHome({ home }: { home: JournalistHomePayload }) {
  return (
    <>
      <WorkspaceHeader
        action={<Link className={buttonVariants()} href="/write"><PenLine aria-hidden className="size-4" />Open writing desk</Link>}
        eyebrow="Journalist home"
        title={`Welcome back, ${firstName(home.profile.fullName)}.`}
        subtitle="Track your drafts, submissions, AI report status, and published engagement from one place."
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={<PenLine aria-hidden className="size-4" />} label="Drafts" value={String(home.metrics.drafts)} />
        <MetricCard icon={<Clock3 aria-hidden className="size-4" />} label="Submitted" value={String(home.metrics.submitted)} />
        <MetricCard icon={<MessageSquareWarning aria-hidden className="size-4" />} label="Revisions" value={String(home.metrics.revisionRequested)} />
        <MetricCard icon={<FileText aria-hidden className="size-4" />} label="Published" value={String(home.metrics.published)} />
        <MetricCard icon={<BarChart3 aria-hidden className="size-4" />} label="Likes" value={String(home.metrics.totalLikes)} />
        <MetricCard icon={<BarChart3 aria-hidden className="size-4" />} label="Comments" value={String(home.metrics.totalComments)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title="Recent writing activity">
          <RowList
            empty="No articles have been started yet."
            rows={home.recentArticles.map((article) => ({
              id: article.id,
              title: article.title,
              meta: `${statusLabel(article.status)} / updated ${formatDate(article.updatedAt)}`,
              href: article.status === "published" && article.slug ? `/articles/${article.slug}` : "/write",
            }))}
          />
        </Panel>

        <Panel title="AI report status">
          <RowList
            empty="Submit an article to see AI report status here."
            rows={home.aiStatuses.map((item) => ({
              id: item.articleId,
              title: item.title,
              meta: `${item.completedSignals} complete, ${item.pendingSignals} pending, ${item.failedSignals} failed`,
            }))}
          />
        </Panel>
      </section>

      <Panel title="Published engagement">
        <RowList
          empty="Published article engagement will appear here."
          rows={home.engagement.map((article) => ({
            id: article.articleId,
            title: article.title,
            meta: `${article.likes} likes / ${article.comments} comments / ${formatDate(article.publishedAt)}`,
            href: article.slug ? `/articles/${article.slug}` : undefined,
          }))}
        />
      </Panel>
    </>
  );
}

function EditorHome({ home }: { home: EditorHomePayload }) {
  return (
    <>
      <WorkspaceHeader
        action={<Link className={buttonVariants()} href="/dashboard/editor/review"><FileText aria-hidden className="size-4" />Open review queue</Link>}
        eyebrow="Editor home"
        title={`Editorial desk for ${firstName(home.profile.fullName)}.`}
        subtitle="See review pressure, time-sensitive submissions, and your recent decisions before opening the full queue."
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={<Clock3 aria-hidden className="size-4" />} label="Pending review" value={String(home.metrics.pendingReview)} />
        <MetricCard icon={<FileText aria-hidden className="size-4" />} label="Submitted" value={String(home.metrics.submitted)} />
        <MetricCard icon={<Clock3 aria-hidden className="size-4" />} label="In review" value={String(home.metrics.inReview)} />
        <MetricCard icon={<MessageSquareWarning aria-hidden className="size-4" />} label="Revision requested" value={String(home.metrics.revisionRequested)} />
        <MetricCard icon={<CheckCircle2 aria-hidden className="size-4" />} label="Your decisions" value={String(home.metrics.completedByYou)} />
        <MetricCard icon={<BarChart3 aria-hidden className="size-4" />} label="Average review" value={home.metrics.averageReviewHours === null ? "None yet" : `${home.metrics.averageReviewHours}h`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title="Time-sensitive submissions">
          <RowList
            empty="No submissions are waiting for review."
            rows={home.timeSensitive.map((article) => ({
              id: article.id,
              title: article.title,
              meta: `${statusLabel(article.status)} / ${article.authorName} / submitted ${formatDate(article.submittedAt)}`,
              href: "/dashboard/editor/review",
            }))}
          />
        </Panel>

        <Panel title="Common AI report flags">
          <RowList
            empty="No common flags yet."
            rows={home.commonFlags.map((flag) => ({
              id: flag.label,
              title: flag.label,
              meta: `${flag.count} ${flag.count === 1 ? "submission" : "submissions"}`,
            }))}
          />
        </Panel>
      </section>

      <Panel title="Recently completed decisions">
        <RowList
          empty="Your completed decisions will appear here."
          rows={home.recentDecisions.map((decision) => ({
            id: decision.id,
            title: decision.title,
            meta: `${statusLabel(decision.status)} / reviewed ${formatDate(decision.reviewedAt)}`,
            href: "/dashboard/editor/review",
          }))}
        />
      </Panel>
    </>
  );
}

function AdminHome({ home }: { home: AdminHomePayload }) {
  return (
    <>
      <WorkspaceHeader
        action={<Link className={buttonVariants()} href="/dashboard/admin/manage"><Shield aria-hidden className="size-4" />Open control panel</Link>}
        eyebrow={home.profile.role === "subadmin" ? "Subadmin home" : "Admin home"}
        title={`Platform summary for ${firstName(home.profile.fullName)}.`}
        subtitle="Check moderation movement, pending appeals, roster verification, and staff-provisioned invites before opening the full control panel."
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard icon={<AlertCircle aria-hidden className="size-4" />} label="Pending appeals" value={String(home.metrics.pendingAppeals)} />
        <MetricCard icon={<Shield aria-hidden className="size-4" />} label="Recent actions" value={String(home.metrics.recentModerationActions)} />
        <MetricCard icon={<UploadCloud aria-hidden className="size-4" />} label="Roster rows" value={String(home.metrics.rosterRows)} />
        <MetricCard icon={<CheckCircle2 aria-hidden className="size-4" />} label="Matched rows" value={String(home.metrics.matchedRosterRows)} />
        <MetricCard icon={<FileText aria-hidden className="size-4" />} label="Pending invites" value={String(home.metrics.pendingInvites)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title="Recent moderation actions">
          <RowList
            empty="No recent moderation actions."
            rows={home.recentModeration.map((action) => ({
              id: action.id,
              title: moderationActionLabel(action.action),
              meta: `${action.targetName} / ${formatDate(action.createdAt)}`,
            }))}
          />
        </Panel>

        <Panel title="Roster upload status">
          <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p><span className="font-semibold text-foreground">Latest upload:</span> {formatDate(home.roster.latestUploadAt)}</p>
            <p><span className="font-semibold text-foreground">Cross-check:</span> {home.roster.latestJobStatus}</p>
            <p><span className="font-semibold text-foreground">Finished:</span> {formatDate(home.roster.latestJobEndedAt)}</p>
            {home.roster.latestJobError ? <p className="text-destructive">{home.roster.latestJobError}</p> : null}
          </div>
        </Panel>
      </section>

      <Panel title="Appeals snapshot">
        <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
          <p><span className="font-semibold text-foreground">Pending appeals:</span> {home.appeals.pending}</p>
          <p><span className="font-semibold text-foreground">Latest submitted:</span> {formatDate(home.appeals.latestSubmittedAt)}</p>
        </div>
      </Panel>
    </>
  );
}

function WorkspaceHeader({
  action,
  eyebrow,
  subtitle,
  title,
}: {
  action: ReactNode;
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  return (
    <header className="grid gap-5 border-b pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="grid gap-3">
        <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        <h1 className="font-serif text-4xl font-semibold tracking-normal md:text-5xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function LoadingState({ loading, message, role }: { loading: boolean; message: string; role: string }) {
  return (
    <section className="grid max-w-2xl gap-5 rounded-md border bg-card p-6 shadow-sm" data-testid={`${role}-home-state`}>
      <p className="text-sm font-semibold text-primary">CampusPress home</p>
      <h1 className="font-serif text-4xl font-semibold">{loading ? "Loading workspace" : "Workspace unavailable"}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      {!loading ? (
        <Link className={buttonVariants({ className: "w-fit" })} href="/auth">Sign in</Link>
      ) : null}
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid min-h-28 content-between gap-4 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function RowList({
  empty,
  rows,
}: {
  empty: string;
  rows: Array<{
    id: string;
    title: string;
    meta: string;
    href?: string;
  }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const content = (
          <>
            <span className="text-sm font-semibold">{row.title}</span>
            <span className="text-xs leading-5 text-muted-foreground">{row.meta}</span>
          </>
        );

        return row.href ? (
          <Link className="grid gap-1 rounded-md border bg-background p-4 hover:border-primary" href={row.href} key={row.id}>
            {content}
          </Link>
        ) : (
          <div className="grid gap-1 rounded-md border bg-background p-4" key={row.id}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "there";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: "Approved",
    draft: "Draft",
    in_review: "In review",
    published: "Published",
    rejected: "Rejected",
    revision_requested: "Revision requested",
    submitted: "Submitted",
  };

  return labels[status] ?? status;
}

function moderationActionLabel(action: string) {
  const labels: Record<string, string> = {
    appeal_accept: "Appeal accepted",
    appeal_reject: "Appeal rejected",
    ban: "User banned",
    restore: "User restored",
    suspend: "User suspended",
    warn: "User warned",
  };

  return labels[action] ?? action;
}
