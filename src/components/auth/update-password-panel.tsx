"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Status = {
  tone: "neutral" | "success" | "error";
  message: string;
};

export function UpdatePasswordPanel() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({
    tone: "neutral",
    message: "Verifying your reset link...",
  });
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (tokenHash && type === "recovery") {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            setStatus({
              tone: "error",
              message: "This reset link could not be verified. Request a new reset email.",
            });
            return;
          }

          setStatus({
            tone: "success",
            message: "Reset link verified. Enter your new password.",
          });
        });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus({
          tone: "success",
          message: "Reset link verified. Enter your new password.",
        });
      }
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus({ tone: "neutral", message: "Updating your password..." });

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setStatus({
        tone: "error",
        message: "CampusPress could not update your password. Request a fresh reset link.",
      });
      return;
    }

    setStatus({
      tone: "success",
      message: "Password updated. You can now sign in with the new password.",
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 border bg-background/95 p-8 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-primary">Password reset</p>
        <h1 className="font-serif text-5xl font-semibold leading-none">
          Set a new password
        </h1>
        <p className="text-base leading-8 text-muted-foreground">
          Use at least eight characters. After the update, return to the sign in
          screen and use the new password.
        </p>
      </div>
      <form className="grid gap-6" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold">
          New password
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
              {showPassword ? (
                <EyeOff aria-hidden className="size-4" />
              ) : (
                <Eye aria-hidden className="size-4" />
              )}
            </button>
          </div>
        </label>
        <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
          <p
            className={
              status.tone === "error"
                ? "text-sm leading-6 text-destructive"
                : status.tone === "success"
                  ? "text-sm leading-6 text-primary"
                  : "text-sm leading-6 text-muted-foreground"
            }
            role="status"
          >
            {status.message}
          </p>
          <Button disabled={pending} type="submit">
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Update password
          </Button>
        </div>
      </form>
    </section>
  );
}
