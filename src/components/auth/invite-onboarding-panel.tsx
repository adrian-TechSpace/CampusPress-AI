"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Status = {
  tone: "neutral" | "success" | "error";
  message: string;
};

type InviteProfile = {
  role: string;
  full_name: string;
};

const orientationCopy: Record<string, string[]> = {
  editor: [
    "Use AI reports as a decision aid, not a verdict.",
    "Send concrete revision guidance when an article needs work.",
    "Keep student identity and newsroom records private.",
  ],
  admin: [
    "Admin actions can affect access, payments, roster verification, and moderation records.",
    "Only full admins can invite admin-tier users or remove another admin account.",
    "Use test payment tools only for integration verification.",
  ],
  subadmin: [
    "Subadmins can manage normal admin workflows.",
    "Subadmins cannot invite editors, admins, or subadmins.",
    "Subadmins cannot remove another admin account.",
  ],
};

export function InviteOnboardingPanel() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [status, setStatus] = useState<Status>({
    tone: "neutral",
    message: "Verifying your invite link...",
  });
  const [profile, setProfile] = useState<InviteProfile | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    async function verifyInvite() {
      if (tokenHash && type === "invite") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });

        if (error) {
          setStatus({
            tone: "error",
            message: "This invite link could not be verified. Ask an administrator for a fresh invite.",
          });
          return;
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setStatus({
          tone: "error",
          message: "This invite session is missing. Open the latest invite email again.",
        });
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", userId)
        .single();

      if (!data || !["editor", "admin", "subadmin"].includes(data.role)) {
        setStatus({
          tone: "error",
          message: "This invite is not for an editor or admin account.",
        });
        return;
      }

      setProfile(data as InviteProfile);
      setStatus({
        tone: "success",
        message: "Invite verified. Create your password to continue.",
      });
    }

    void verifyInvite();
  }, [supabase]);

  async function createPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus({ tone: "neutral", message: "Saving your password..." });
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setStatus({
        tone: "error",
        message: "CampusPress could not save that password. Open the invite email again.",
      });
      return;
    }

    setPasswordSet(true);
    setStatus({ tone: "success", message: "Password saved. Review your role orientation." });
  }

  async function completeOrientation() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus({ tone: "error", message: "Sign in through the invite link again before finishing setup." });
      return;
    }

    setPending(true);
    const response = await fetch("/api/auth/invite/complete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orientation: {
          acknowledged,
          role: profile?.role,
        },
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      destination?: string;
    };
    setPending(false);

    if (!response.ok || !result.ok) {
      setStatus({ tone: "error", message: result.message ?? "CampusPress could not finish setup." });
      return;
    }

    router.push(result.destination ?? "/dashboard/admin");
  }

  const points = orientationCopy[profile?.role ?? "editor"] ?? orientationCopy.editor;

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-8 rounded-md border bg-background/95 p-8 shadow-sm backdrop-blur">
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-primary">CampusPress AI invite</p>
        <h1 className="font-serif text-5xl font-semibold leading-none">Complete setup</h1>
        <p className="text-base leading-8 text-muted-foreground">
          {profile ? `Welcome, ${profile.full_name}. Your role is ${roleLabel(profile.role)}.` : "Your role is set by the invite."}
        </p>
      </div>

      {!passwordSet ? (
        <form className="grid gap-6" onSubmit={createPassword}>
          <label className="grid gap-2 text-sm font-semibold">
            Password
            <div className="relative">
              <Input
                autoComplete="new-password"
                className="pr-10"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground"
                onClick={() => setShowPassword((current) => !current)}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
              </button>
            </div>
          </label>
          <StatusLine status={status} />
          <Button disabled={pending || !profile} type="submit">
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Create password
          </Button>
        </form>
      ) : (
        <section className="grid gap-6">
          <div className="grid gap-3">
            <h2 className="text-xl font-semibold">{roleLabel(profile?.role ?? "editor")} orientation</h2>
            {points.map((point) => (
              <p className="flex items-start gap-3 text-sm leading-6 text-muted-foreground" key={point}>
                <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                {point}
              </p>
            ))}
          </div>
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input
              checked={acknowledged}
              className="mt-1"
              onChange={(event) => setAcknowledged(event.target.checked)}
              type="checkbox"
            />
            I understand this role and will follow CampusPress AI account rules.
          </label>
          <StatusLine status={status} />
          <Button disabled={pending || !acknowledged} onClick={completeOrientation} type="button">
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Finish onboarding
          </Button>
        </section>
      )}
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  return (
    <p
      className={
        status.tone === "error"
          ? "text-sm font-semibold text-destructive"
          : status.tone === "success"
            ? "text-sm font-semibold text-primary"
            : "text-sm text-muted-foreground"
      }
      role="status"
    >
      {status.message}
    </p>
  );
}

function roleLabel(role: string) {
  if (role === "admin") {
    return "administrator";
  }
  if (role === "subadmin") {
    return "subadministrator";
  }
  return "editor";
}
