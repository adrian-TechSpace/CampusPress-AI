"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { statusTooltip, technicalTermTooltips } from "@/lib/editor-tooltips";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { AnalysisReport } from "@/lib/analysis/types";

type AnalysisReportClientProps = {
  articleId: string;
};

export function AnalysisReportClient({ articleId }: AnalysisReportClientProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading the AI analysis report...");
  const [report, setReport] = useState<AnalysisReport | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (active) {
          setLoading(false);
          setMessage("Sign in as an editor or administrator to view this AI analysis report.");
        }
        return;
      }

      const response = await fetch(`/api/analysis/report?articleId=${encodeURIComponent(articleId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        report?: AnalysisReport;
      };

      if (!active) {
        return;
      }

      setLoading(false);
      if (!response.ok || !result.ok || !result.report) {
        setMessage(result.message ?? "CampusPress could not load this AI analysis report.");
        return;
      }

      setReport(result.report);
      setMessage("AI analysis report loaded.");
    }

    void loadReport();

    return () => {
      active = false;
    };
  }, [articleId, supabase]);

  return (
    <AuthenticatedShell>
      <main className="min-h-dvh bg-background px-6 py-8 text-foreground md:px-12">
        <section className="mx-auto grid max-w-6xl gap-8">
          <div className="grid gap-3 border-b pb-6">
            <p className="text-sm font-semibold text-primary">CampusPress AI analysis</p>
            <h1 className="font-serif text-4xl font-semibold tracking-normal">
              {report?.article.title ?? "Editor report"}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground" role="status">
              {loading ? "Loading the AI analysis report..." : message}
            </p>
          </div>

          {report ? (
            <AnalysisReportPanel report={report} />
          ) : (
            <div className="rounded-md border bg-card p-6 text-sm leading-6 text-muted-foreground">
              {message}
            </div>
          )}
        </section>
      </main>
    </AuthenticatedShell>
  );
}

export function AnalysisReportPanel({ report }: { report: AnalysisReport }) {
  const openAiUnavailable = getOpenAiUnavailableState(report);

  return (
    <>
      <section className="grid gap-2 rounded-md border bg-card p-5">
        <h2 className="text-xl font-semibold">How to use this report</h2>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          This report summarizes automated checks for editors. Treat it as a decision aid, not a verdict, and weigh it against the article itself because model disagreement and known limitations are disclosed instead of hidden.
        </p>
      </section>

      <section className="grid gap-4 rounded-md border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">Ensemble verdict</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {report.combinedVerdict}
            </p>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-semibold">
              <TooltipTerm description={statusTooltip(report.status)} label={`Status: ${report.status}`} />
            </span>
            <span className="text-muted-foreground">
              <TooltipTerm description={technicalTermTooltips.confidence} label="Confidence" />:{" "}
              {report.combinedConfidence === null ? "Not available" : `${Math.round(report.combinedConfidence * 100)}%`}
            </span>
          </div>
        </div>
        {openAiUnavailable ? <OpenAiUnavailableNotice /> : null}
        <div
          className={
            report.disagreement.present
              ? "rounded-md border border-destructive/30 bg-background p-4 text-sm leading-6 text-destructive"
              : "rounded-md border bg-background p-4 text-sm leading-6 text-muted-foreground"
          }
        >
          {report.disagreement.message}
        </div>
      </section>

      <section className="grid gap-4">
        {report.results.map((result) => (
          <article className="grid gap-4 rounded-md border bg-card p-5" key={`${result.key}-${result.modelName}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold">{labelForKey(result.key)}</h2>
                <p className="text-sm text-muted-foreground">
                  {result.provider}, {result.modelName}
                </p>
              </div>
              <StatusBadge status={result.status} />
            </div>

            <p className="text-sm leading-6 text-muted-foreground">{result.verdict}</p>

            {result.disclosure ? (
              <div className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">
                  <TooltipTerm description={technicalTermTooltips.knownLimitation} label="Known limitation" />:{" "}
                </span>
                {result.disclosure}
              </div>
            ) : null}

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Metric
                label={<TooltipTerm description={technicalTermTooltips.confidence} label="Confidence" />}
                value={
                  result.confidence === null ? (
                    <TooltipTerm description={technicalTermTooltips.didNotComplete} label="This check did not complete" />
                  ) : (
                    `${Math.round(result.confidence * 100)}%`
                  )
                }
              />
              <Metric
                label={<TooltipTerm description={technicalTermTooltips.score} label="Score" />}
                value={result.score === null ? "Not available" : result.score.toString()}
              />
            </div>

            {result.errorMessage ? (
              <p className="rounded-md border border-destructive/30 bg-background p-3 text-sm leading-6 text-destructive">
                {result.errorMessage}
              </p>
            ) : null}

            {result.flaggedSentences.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">Flagged evidence</h3>
                {result.flaggedSentences.map((flag, index) => (
                  <blockquote className="rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground" key={`${flag.text}-${index}`}>
                    <span className="font-semibold text-foreground">{flag.text}</span>
                    <br />
                    {flag.reason}
                  </blockquote>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}

function OpenAiUnavailableNotice() {
  return (
    <div className="rounded-md border border-destructive/30 bg-background p-4 text-sm leading-6 text-destructive">
      <p className="font-semibold">
        AI editorial judgment and verification pass are temporarily unavailable.
      </p>
      <p className="mt-2 text-muted-foreground">
        The six working signals are shown normally below. Use them as evidence, then make the final editorial decision manually.
      </p>
    </div>
  );
}

function getOpenAiUnavailableState(report: AnalysisReport) {
  const openAiKeys = new Set(["openai_editorial", "openai_verification"]);
  const openAiResults = report.results.filter((result) => openAiKeys.has(result.key));
  return openAiResults.length > 0 && openAiResults.every((result) => result.status === "failed");
}

function StatusBadge({ status }: { status: string }) {
  const statusDescription = statusTooltip(status);
  const description = status === "failed" ? technicalTermTooltips.didNotComplete : statusDescription;

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-primary" title={description}>
        <CheckCircle2 aria-hidden className="size-4" />
        Completed
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive" title={description}>
        <AlertTriangle aria-hidden className="size-4" />
        Did not complete
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-muted-foreground" title={description}>
      <CircleDashed aria-hidden className="size-4" />
      {status}
    </span>
  );
}

function Metric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function TooltipTerm({ description, label }: { description: string; label: string }) {
  return (
    <span className="cursor-help underline decoration-dotted underline-offset-4" title={description}>
      {label}
    </span>
  );
}

function labelForKey(key: string) {
  const labels: Record<string, string> = {
    openai_editorial: "OpenAI grammar, bias, and credibility",
    openai_verification: "OpenAI verification pass",
    huggingface_fake_news: "HuggingFace fake-news signal",
    cardiff_sentiment: "Cardiff RoBERTa sentiment",
    pg_trgm_originality: "pg_trgm originality",
    rule_credibility: "9-point credibility rules",
    flesch_kincaid: "Flesch-Kincaid readability",
    languagetool: "LanguageTool grammar",
    tfidf_relevance: "TF-IDF relevance",
  };

  return labels[key] ?? key;
}
