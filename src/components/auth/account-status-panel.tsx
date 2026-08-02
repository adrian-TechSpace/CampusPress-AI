"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileImage, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccountStatusPayload } from "@/lib/account-enforcement";

type StoredStatus = AccountStatusPayload & {
  appealToken?: string | null;
  capturedAt?: number;
};

type AppealState = {
  tone: "neutral" | "success" | "error";
  message: string;
};

const appealSteps = ["Situation", "Explanation", "ID card", "Submit"] as const;

export function AccountStatusPanel() {
  const [status] = useState<StoredStatus | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.sessionStorage.getItem("campuspress_account_status");
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredStatus;
    } catch {
      return null;
    }
  });
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState("");
  const [improvementPlan, setImprovementPlan] = useState("");
  const [explanation, setExplanation] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [appealState, setAppealState] = useState<AppealState>({
    tone: "neutral",
    message: "A suspension can be appealed once with a written explanation and ID card photo.",
  });

  const canAppeal = status?.status === "suspended" && Boolean(status.appealToken);
  const restorationDate = status?.restorationDate
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(new Date(status.restorationDate))
    : null;

  function canContinue() {
    if (step === 0) {
      return situation.trim().length >= 10;
    }

    if (step === 1) {
      return explanation.trim().length >= 40;
    }

    if (step === 2) {
      return Boolean(idPhoto);
    }

    return true;
  }

  async function submitAppeal() {
    if (!status?.appealToken || !idPhoto) {
      setAppealState({ tone: "error", message: "Sign in again and upload your ID card photo before submitting." });
      return;
    }

    const form = new FormData();
    form.set("situation", situation);
    form.set("improvementPlan", improvementPlan);
    form.set("explanation", explanation);
    form.set("idPhoto", idPhoto);

    setPending(true);
    setAppealState({ tone: "neutral", message: "Submitting your suspension appeal..." });
    const response = await fetch("/api/account/appeals", {
      method: "POST",
      headers: { Authorization: `Bearer ${status.appealToken}` },
      body: form,
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    setPending(false);

    setAppealState({
      tone: response.ok && result.ok ? "success" : "error",
      message: result.message ?? "CampusPress could not submit that appeal.",
    });
  }

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-8 rounded-md border bg-background/95 p-8 shadow-sm backdrop-blur">
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-primary">Account status</p>
        <h1 className="font-serif text-5xl font-semibold leading-none">
          {status?.status === "banned" ? "Account banned" : status?.status === "suspended" ? "Account suspended" : "Account access"}
        </h1>
        {status ? (
          <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>{status.message}</p>
            {status.reason ? <p className="rounded-md border bg-card p-3 text-foreground">Reason: {status.reason}</p> : null}
            {restorationDate ? <p>Scheduled restoration: {restorationDate}</p> : null}
            <Link className="font-semibold text-primary" href={status.rulesUrl || "/terms"}>
              Read the platform rules
            </Link>
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Sign in to see your current account status. If your account is suspended or banned, CampusPress AI will show the reason here.
          </p>
        )}
      </div>

      {status?.status === "banned" ? (
        <div className="flex items-start gap-3 rounded-md border bg-card p-4">
          <AlertTriangle aria-hidden className="mt-1 size-5 text-destructive" />
          <p className="text-sm leading-6 text-muted-foreground">
            This is a permanent ban. No appeal option is available for banned accounts.
          </p>
        </div>
      ) : null}

      {status?.status === "suspended" ? (
        <section className="grid gap-5 border-t pt-6">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">Suspension appeal</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Submit a written explanation and a photo of your student or staff ID card. No live selfie or facial verification is required.
            </p>
          </div>

          {!canAppeal ? (
            <div className="grid gap-3 rounded-md border bg-card p-4 text-sm leading-6 text-muted-foreground">
              <p>Sign in again with this suspended account to unlock the appeal form.</p>
              <Link className="font-semibold text-primary" href="/auth?mode=login">
                Return to sign in
              </Link>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="grid grid-cols-4 gap-2">
                {appealSteps.map((item, index) => (
                  <div
                    aria-label={item}
                    className={index <= step ? "h-2 rounded-md bg-primary" : "h-2 rounded-md bg-muted"}
                    key={item}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold">
                Step {step + 1} of {appealSteps.length}: {appealSteps[step]}
              </p>

              {step === 0 ? (
                <label className="grid gap-2 text-sm font-semibold">
                  What happened?
                  <textarea
                    className="min-h-32 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(event) => setSituation(event.target.value)}
                    value={situation}
                  />
                </label>
              ) : null}

              {step === 1 ? (
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold">
                    Explain why the suspension should be reviewed
                    <textarea
                      className="min-h-40 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) => setExplanation(event.target.value)}
                      value={explanation}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    What will you improve if restored?
                    <textarea
                      className="min-h-24 rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onChange={(event) => setImprovementPlan(event.target.value)}
                      value={improvementPlan}
                    />
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <label className="grid gap-3 text-sm font-semibold">
                  Student or staff ID card photo
                  <Input
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setIdPhoto(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  {idPhoto ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <FileImage aria-hidden className="size-4" />
                      {idPhoto.name}
                    </span>
                  ) : null}
                </label>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4 rounded-md border bg-card p-4 text-sm leading-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 aria-hidden className="mt-1 size-5 text-primary" />
                    <p>Review your appeal details, then submit them for admin review.</p>
                  </div>
                  <p className="text-muted-foreground">
                    The admin notification email will not include your appeal text or ID photo.
                  </p>
                </div>
              ) : null}

              <p
                className={
                  appealState.tone === "error"
                    ? "text-sm font-semibold text-destructive"
                    : appealState.tone === "success"
                      ? "text-sm font-semibold text-primary"
                      : "text-sm text-muted-foreground"
                }
                role="status"
              >
                {appealState.message}
              </p>

              <div className="flex flex-wrap justify-end gap-3">
                {step > 0 ? (
                  <Button onClick={() => setStep((current) => Math.max(current - 1, 0))} type="button" variant="outline">
                    Back
                  </Button>
                ) : null}
                {step < appealSteps.length - 1 ? (
                  <Button
                    disabled={!canContinue()}
                    onClick={() => setStep((current) => Math.min(current + 1, appealSteps.length - 1))}
                    type="button"
                  >
                    Next
                  </Button>
                ) : (
                  <Button disabled={pending} onClick={submitAppeal} type="button">
                    {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
                    Submit appeal
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}

      <div className="border-t pt-6">
        <Link className="text-sm font-semibold text-primary" href="/auth?mode=login">
          Return to sign in
        </Link>
      </div>
    </section>
  );
}
