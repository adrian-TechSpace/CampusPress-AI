"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Profile = {
  full_name: string;
  role: string;
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
      <div className="min-h-dvh pl-16">{children}</div>
    </div>
  );
}

export function AuthenticatedRail() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        if (active) {
          setProfile(null);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
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
        <div className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {initials(profile?.full_name ?? "User")}
          </span>
          <span className="w-0 truncate text-sm font-semibold opacity-0 transition-opacity duration-150 group-hover:w-auto group-hover:opacity-100 group-focus-within:w-auto group-focus-within:opacity-100">
            {profile?.full_name ?? "Signed in"}
          </span>
        </div>
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

  if (role === "editor" || role === "admin") {
    items.push({
      href: `/dashboard/${role}`,
      label: role === "admin" ? "Admin" : "Editor",
      icon: role === "admin" ? <Shield aria-hidden className="size-5" /> : <LayoutDashboard aria-hidden className="size-5" />,
    });
  }

  return items;
}

function roleHomeHref(role: string) {
  if (role === "journalist") {
    return "/write";
  }
  if (role === "reader") {
    return "/dashboard/reader";
  }
  return `/dashboard/${role}`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}
