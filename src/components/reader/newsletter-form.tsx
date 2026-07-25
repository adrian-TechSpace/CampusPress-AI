"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Get published story highlights by email.");

  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("Saving your subscription...");

    const response = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json()) as { ok: boolean; message: string };

    setPending(false);
    setMessage(result.message);

    if (result.ok) {
      setEmail("");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={subscribe}>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="newsletter-email">
        Newsletter
        <div className="flex flex-col gap-3">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pl-10"
              id="newsletter-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <Button disabled={pending} type="submit">
            Subscribe
          </Button>
        </div>
      </label>
      <p className="text-sm leading-6 text-muted-foreground" role="status">
        {message}
      </p>
    </form>
  );
}
