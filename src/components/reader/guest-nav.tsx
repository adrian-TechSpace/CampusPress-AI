"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import logo from "../../../assets/Chrisland university logo.webp";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const navItems = [
  { href: "/feed", label: "Feed" },
  { href: "/search", label: "Search" },
  { href: "/bookmarks", label: "Bookmarks" },
];

export function GuestNav() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSignedIn(Boolean(data.session));
      }
    });

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

  if (signedIn !== false) {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link className="flex items-center gap-3" href="/">
          <Image
            alt="Chrisland University logo"
            className="size-8 object-contain"
            height={32}
            priority
            src={logo}
            width={32}
          />
          <span className="text-sm font-semibold text-foreground">CampusPress AI</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          href="/auth"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
