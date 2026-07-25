"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquareText,
  RefreshCcw,
  Send,
} from "lucide-react";

import { AnalysisReportPanel } from "@/components/editor/analysis-report-client";
import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AnalysisReport } from "@/lib/analysis/types";
import type { ReviewAnalytics, ReviewDecision, ReviewQueueItem, ReviewStatus } from "@/lib/editor-review";

type QueueResponse = {
  ok?: boolean;
  message?: string;
  items?: ReviewQueueItem[];
  analytics?: ReviewAnalytics;
};

type ReportResponse = {
  ok?: boolean;
  message?: string;
  report?: AnalysisReport;
};

type FilterValue = "all" | ReviewStatus;
type SortValue = "oldest" | "risk";

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "In review", value: "in_review" },
  { label: "Revision requested", value: "revision_requested" },
];

export function EditorReviewQueueClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("oldest");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("Loading submissions for editorial review...");
  const [reportMessage, setReportMessage] = useState("Choose a submission to load its AI analysis report.");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const accessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      const token = await accessToken();
      if (!token) {
        if (active) {
          setLoading(false);
          setMessage("Sign in as an editor or administrator to open the review queue.");
        }
        return;
      }

      const response = await fetch("/api/editor/review-queue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => ({}))) as QueueResponse;
      if (!active) {
        return;
      }

      setLoading(false);
      if (!response.ok || !result.ok || !result.items || !result.analytics) {
        setMessage(result.message ?? "CampusPress could not load the editorial review queue.");
        return;
      }

      const queueItems = result.items;
      setItems(queueItems);
      setAnalytics(result.analytics);
      setSelectedId((current) => current ?? queueItems[0]?.id ?? null);
      setMessage(
        result.items.length === 0
          ? "No submissions are waiting for editorial review."
          : `${result.items.length} ${result.items.length === 1 ? "article" : "articles"} ready for review.`,
      );
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      if (!selectedId) {
        setReport(null);
        setReportMessage("Choose a submission to load its AI analysis report.");
        return;
      }

      setReport(null);
      setReportMessage("Loading the AI analysis report for this submission...");
      const token = await accessToken();
      if (!token) {
        if (active) {
          setReportMessage("Sign in as an editor or administrator to view this AI analysis report.");
        }
        return;
      }

      const response = await fetch(`/api/analysis/report?articleId=${encodeURIComponent(selectedId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => ({}))) as ReportResponse;
      if (!active) {
        return;
      }

      if (!response.ok || !result.ok || !result.report) {
        setReportMessage(result.message ?? "CampusPress could not load this AI analysis report.");
        return;
      }

      setReport(result.report);
      setReportMessage("AI analysis report loaded.");
    }

    void loadReport();

    return () => {
      active = false;
    };
  }, [accessToken, selectedId]);

  const visibleItems = useMemo(() => {
    const filtered = filter === "all" ? items : items.filter((item) => item.status === filter);
    return [...filtered].sort((a, b) => {
      if (sort === "risk") {
        return (b.analysis.riskScore ?? -1) - (a.analysis.riskScore ?? -1);
      }
      return new Date(a.submittedAt ?? a.updatedAt).getTime() - new Date(b.submittedAt ?? b.updatedAt).getTime();
    });
  }, [filter, items, sort]);

  const selected = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null;

  async function sendDecision(action: ReviewDecision) {
    if (!selected) {
      return;
    }

    setActing(true);
    setMessage("Saving the editorial decision...");
    const token = await accessToken();
    if (!token) {
      setActing(false);
      setMessage("Sign in again before sending an editorial decision.");
      return;
    }

    const response = await fetch("/api/editor/review-queue/action", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleId: selected.id, action, note }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      status?: string;
    };

    setActing(false);
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "CampusPress could not save that editorial decision.");
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === selected.id && result.status
          ? { ...item, status: result.status as ReviewStatus }
          : item,
      ),
    );
    if (result.status && filter !== "all" && result.status !== filter) {
      setFilter("all");
    }
    setNote("");
    setMessage(result.message ?? "Editorial decision saved.");
  }

  return (
    <AuthenticatedShell>
      <main className="min-h-dvh bg-background px-6 py-8 text-foreground md:px-12" data-testid="editor-review-queue">
        <section className="mx-auto grid max-w-7xl gap-8">
          <header className="grid gap-4 border-b pb-6">
            <p className="text-sm font-semibold text-primary">Editorial review queue</p>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-3">
                <h1 className="font-serif text-4xl font-semibold tracking-normal md:text-5xl">
                  Review submissions with evidence beside the article.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground" role="status">
                  {loading ? "Loading submissions for editorial review..." : message}
                </p>
              </div>
              <Button onClick={() => window.location.reload()} type="button" variant="outline">
                <RefreshCcw aria-hidden className="size-4" />
                Refresh
              </Button>
            </div>
          </header>

          <AnalyticsStrip analytics={analytics} />

          <section className="grid gap-6 xl:grid-cols-[24rem_1fr]">
            <aside className="grid h-fit gap-4 rounded-md border bg-card p-4">
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((option) => (
                    <Button
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value);
                        const nextItems =
                          option.value === "all"
                            ? items
                            : items.filter((item) => item.status === option.value);
                        if (!selectedId || !nextItems.some((item) => item.id === selectedId)) {
                          setSelectedId(nextItems[0]?.id ?? null);
                        }
                      }}
                      size="sm"
                      type="button"
                      variant={filter === option.value ? "default" : "outline"}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Button
                  className="justify-start"
                  onClick={() => setSort((current) => (current === "risk" ? "oldest" : "risk"))}
                  type="button"
                  variant="outline"
                >
                  <ArrowDownWideNarrow aria-hidden className="size-4" />
                  {sort === "risk" ? "Oldest first" : "Highest risk first"}
                </Button>
              </div>

              <div className="grid gap-2">
                {visibleItems.length > 0 ? (
                  visibleItems.map((item) => (
                    <button
                      className={
                        selected?.id === item.id
                          ? "grid gap-2 rounded-md border border-primary bg-background p-4 text-left"
                          : "grid gap-2 rounded-md border bg-background p-4 text-left hover:border-primary"
                      }
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      type="button"
                    >
                      <span className="text-sm font-semibold">{item.title}</span>
                      <span className="text-xs leading-5 text-muted-foreground">
                        {item.author.fullName}, {statusLabel(item.status)}
                      </span>
                      <span className="text-xs leading-5 text-muted-foreground">
                        {item.analysis.completedSignals} completed signals, {item.analysis.failedOpenAiSignals} OpenAI unavailable
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-md border bg-background p-4 text-sm leading-6 text-muted-foreground">
                    No articles match this filter.
                  </div>
                )}
              </div>
            </aside>

            <section className="grid gap-6">
              {selected ? (
                <>
                  <article className="grid gap-5 rounded-md border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="grid gap-2">
                        <p className="text-sm font-semibold text-primary">{statusLabel(selected.status)}</p>
                        <h2 className="font-serif text-3xl font-semibold">{selected.title}</h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                          By {selected.author.fullName}, {selected.author.departmentCode}
                          {selected.author.verified ? ", verified" : ", unverified"}
                        </p>
                      </div>
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <span>Submitted: {formatDate(selected.submittedAt)}</span>
                        <span>Risk score: {selected.analysis.riskScore === null ? "Not available" : selected.analysis.riskScore}</span>
                      </div>
                    </div>
                    <p className="text-base leading-8 text-muted-foreground">
                      {selected.excerpt ?? "No excerpt was provided."}
                    </p>
                    <div className="grid gap-4 border-t pt-4">
                      <h3 className="text-sm font-semibold">Article text</h3>
                      <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-sm leading-7 text-muted-foreground">
                        {selected.plainText}
                      </div>
                    </div>
                  </article>

                  <section className="grid gap-4 rounded-md border bg-card p-5">
                    <div className="grid gap-2">
                      <h2 className="text-xl font-semibold">Editorial decision</h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Use the article text and AI evidence together. Revision and rejection notes should be specific enough for the journalist to act on.
                      </p>
                    </div>
                    <label className="grid gap-2 text-sm font-semibold">
                      Decision note
                      <textarea
                        className="min-h-24 rounded-md border bg-background px-4 py-3 text-sm font-normal leading-6 outline-none ring-ring focus:ring-2"
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Add the exact change the journalist should make."
                        value={note}
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <Button disabled={acting} onClick={() => void sendDecision("approve")} type="button">
                        <CheckCircle2 aria-hidden className="size-4" />
                        Approve
                      </Button>
                      <Button disabled={acting} onClick={() => void sendDecision("request_revision")} type="button" variant="outline">
                        <MessageSquareText aria-hidden className="size-4" />
                        Request revision
                      </Button>
                      <Button disabled={acting} onClick={() => void sendDecision("reject")} type="button" variant="outline">
                        <AlertTriangle aria-hidden className="size-4" />
                        Reject
                      </Button>
                    </div>
                  </section>

                  <section className="grid gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">AI analysis report</h2>
                      <p className="text-sm text-muted-foreground">{reportMessage}</p>
                    </div>
                    {report ? (
                      <AnalysisReportPanel report={report} />
                    ) : (
                      <div className="rounded-md border bg-card p-5 text-sm leading-6 text-muted-foreground">
                        {reportMessage}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="rounded-md border bg-card p-6 text-sm leading-6 text-muted-foreground">
                  {loading ? "Loading submissions for editorial review..." : "No submission is selected."}
                </div>
              )}
            </section>
          </section>
        </section>
      </main>
    </AuthenticatedShell>
  );
}

function AnalyticsStrip({ analytics }: { analytics: ReviewAnalytics | null }) {
  const commonFlag = analytics?.commonFlags[0];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricCard
        icon={<FileText aria-hidden className="size-4" />}
        label="Submission volume"
        value={analytics ? `${analytics.activeSubmissions} ${analytics.activeSubmissions === 1 ? "article" : "articles"}` : "Loading"}
      />
      <MetricCard
        icon={<Clock3 aria-hidden className="size-4" />}
        label="Average review time"
        value={analytics?.averageReviewHours === null || !analytics ? "No completed reviews yet" : `${analytics.averageReviewHours} hours`}
      />
      <MetricCard
        icon={<Send aria-hidden className="size-4" />}
        label="Most common flag"
        value={commonFlag ? `${commonFlag.label} (${commonFlag.count})` : "No flags yet"}
      />
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-md border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    revision_requested: "Revision requested",
  };

  return labels[status] ?? status;
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
