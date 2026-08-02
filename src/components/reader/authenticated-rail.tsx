"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  Home,
  LayoutDashboard,
  LogOut,
  PenLine,
  Search,
  Shield,
  Users,
} from "lucide-react";

import logo from "../../../assets/Chrisland university logo.webp";
import { Button } from "@/components/ui/button";
import { RoleTutorial } from "@/components/onboarding/role-tutorial";
import type { AccountStatusPayload, AccountWarning } from "@/lib/account-enforcement";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Profile = {
  full_name: string;
  role: string;
  username: string | null;
};

type RailItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AuthenticatedRail />
      <AccountStatusGate />
      <RoleTutorial />
      <div className="min-h-dvh pl-16">{children}</div>
    </div>
  );
}

function AccountStatusGate() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [warning, setWarning] = useState<AccountWarning | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const checkStatus = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setWarning(null);
      return;
    }

    const response = await fetch("/api/auth/session-status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);

    if (!response) {
      return;
    }

    const result = (await response.json().catch(() => ({}))) as AccountStatusPayload;
    if (result.warning) {
      setWarning(result.warning);
    } else {
      setWarning(null);
    }

    if (response.status === 403 || result.forceSignOut) {
      window.sessionStorage.setItem(
        "campuspress_account_status",
        JSON.stringify({
          ...result,
          appealToken: result.appealToken ?? null,
          capturedAt: Date.now(),
        }),
      );
      await supabase.auth.signOut({ scope: "local" });
      window.location.href = "/auth/account-status";
    }
  }, [supabase]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void checkStatus(), 0);
    const interval = window.setInterval(() => void checkStatus(), 15000);
    const onFocus = () => void checkStatus();
    const onVisibility = () => {
      if (!document.hidden) {
        void checkStatus();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkStatus]);

  async function dismissWarning() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setWarning(null);
      return;
    }

    setDismissing(true);
    const response = await fetch("/api/account/warnings/ack", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    setDismissing(false);

    if (response?.ok) {
      setWarning(null);
    }
  }

  if (!warning) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 backdrop-blur">
      <section className="grid max-w-lg gap-5 rounded-md border bg-card p-6 shadow-sm">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-primary">Account warning</p>
          <h2 className="text-2xl font-semibold">Rules violation warning</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Your account has been flagged for a rules violation. Your account remains active, but continued violations may lead to suspension or a permanent ban.
          </p>
          <p className="rounded-md border bg-background p-3 text-sm leading-6">{warning.reason}</p>
          <Link className="text-sm font-semibold text-primary" href={warning.rulesUrl}>
            Read the platform rules
          </Link>
        </div>
        <div className="flex justify-end">
          <Button disabled={dismissing} onClick={dismissWarning} type="button">
            {dismissing ? "Dismissing..." : "I understand"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function AuthenticatedRail() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      let userId: string | undefined;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user.id;
      } catch {
        if (active) {
          setProfile(null);
        }
        return;
      }

      if (!userId) {
        if (active) {
          setProfile(null);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, username")
        .eq("id", userId)
        .single();

      if (active) {
        setProfile((data ?? null) as Profile | null);
      }
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const items = railItems(profile?.role ?? "reader");

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="group fixed inset-y-0 left-0 z-50 flex w-16 flex-col border-r bg-background transition-[width] duration-200 ease-out hover:w-64 focus-within:w-64">
      <Link className="m-3 grid size-10 place-items-center rounded-md hover:bg-accent" href={roleHomeHref(profile?.role ?? "reader")}>
        <Image alt="Chrisland University logo" className="size-8 object-contain" src={logo} />
      </Link>

      <nav className="grid gap-1 px-3 py-2">
        {items.map((item) => (
          <Link
            className="flex h-11 items-center gap-4 rounded-md px-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            href={item.href}
            key={item.href}
          >
            <span className="grid size-6 shrink-0 place-items-center">{item.icon}</span>
            <span className="w-0 overflow-hidden opacity-0 transition-opacity duration-150 group-hover:w-auto group-hover:opacity-100 group-focus-within:w-auto group-focus-within:opacity-100">
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto grid gap-2 border-t p-3" data-testid="signed-in-nav">
        <Link
          aria-label={`Open ${profile?.full_name ?? "signed-in user"} profile`}
          className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
          href={profileChipHref(profile)}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {initials(profile?.full_name ?? "User")}
          </span>
          <span className="w-0 truncate text-sm font-semibold opacity-0 transition-opacity duration-150 group-hover:w-auto group-hover:opacity-100 group-focus-within:w-auto group-focus-within:opacity-100">
            {profile?.full_name ?? "Signed in"}
          </span>
        </Link>
        <Button
          className="justify-start gap-4 px-2"
          onClick={signOut}
          size="sm"
          type="button"
          variant="outline"
        >
          <LogOut aria-hidden className="size-4 shrink-0" />
          <span className="w-0 overflow-hidden opacity-0 transition-opacity duration-150 group-hover:w-auto group-hover:opacity-100 group-focus-within:w-auto group-focus-within:opacity-100">
            Sign out
          </span>
        </Button>
      </div>
    </aside>
  );
}

function railItems(role: string): RailItem[] {
  const items: RailItem[] = [
    { href: roleHomeHref(role), label: "Home", icon: <Home aria-hidden className="size-5" /> },
    { href: "/search", label: "Search", icon: <Search aria-hidden className="size-5" /> },
    { href: "/bookmarks", label: "Bookmarks", icon: <Bookmark aria-hidden className="size-5" /> },
    { href: "/following", label: "Following", icon: <Users aria-hidden className="size-5" /> },
    { href: "/notifications", label: "Notifications", icon: <Bell aria-hidden className="size-5" /> },
  ];

  if (role === "journalist") {
    items.push({ href: "/write", label: "Write", icon: <PenLine aria-hidden className="size-5" /> });
  }

  if (role === "editor" || role === "admin" || role === "subadmin") {
    items.push({
      href: role === "subadmin" ? "/dashboard/admin" : `/dashboard/${role}`,
      label: role === "editor" ? "Editor" : "Admin",
      icon: role === "editor" ? <LayoutDashboard aria-hidden className="size-5" /> : <Shield aria-hidden className="size-5" />,
    });
  }

  return items;
}

function roleHomeHref(role: string) {
  if (role === "journalist") {
    return "/dashboard/journalist";
  }
  if (role === "reader") {
    return "/dashboard/reader";
  }
  if (role === "editor") {
    return "/dashboard/editor";
  }
  if (role === "subadmin") {
    return "/dashboard/admin";
  }
  return `/dashboard/${role}`;
}

function profileChipHref(profile: Profile | null) {
  if (!profile) {
    return "/auth";
  }

  if ((profile.role === "journalist" || profile.role === "editor") && profile.username) {
    return `/portfolio/${profile.username}`;
  }

  return roleHomeHref(profile.role);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}
