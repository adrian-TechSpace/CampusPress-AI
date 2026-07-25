"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { GuestNav } from "@/components/reader/guest-nav";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export function ReaderChrome({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSignedIn(Boolean(data.session));
      }
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (signedIn) {
    return <AuthenticatedShell>{children}</AuthenticatedShell>;
  }

  return (
    <main className="min-h-dvh bg-background pt-16 text-foreground">
      <GuestNav />
      {children}
    </main>
  );
}
