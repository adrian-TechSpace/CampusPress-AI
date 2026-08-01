"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";

import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  article_id: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
};

type StaticNotification = {
  id: string;
  time: string;
  title: string;
  description: string;
};

type DisplayNotification = {
  id: string;
  time: string;
  title: string;
  description: string;
  unread: boolean;
};

type NotificationsClientProps = {
  fallbackNotifications: StaticNotification[];
};

export function NotificationsClient({ fallbackNotifications }: NotificationsClientProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [supabase]);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, article_id, actor_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setErrorMessage("CampusPress could not load your notifications.");
      return;
    }

    setErrorMessage(null);
    setRows((data ?? []) as NotificationRow[]);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setRows((current) => mergeNotificationRows([payload.new as NotificationRow, ...current]));
        },
      )
      .subscribe();

    const poller = window.setInterval(() => {
      void loadNotifications();
    }, 5000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(poller);
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, supabase, userId]);

  const displayNotifications = useMemo<DisplayNotification[]>(() => {
    if (userId) {
      return rows.map((notification) => ({
        id: notification.id,
        time: formatNotificationTime(notification.created_at),
        title: notification.title,
        description: notification.body,
        unread: !notification.read_at,
      }));
    }

    return fallbackNotifications.map((notification) => ({
      id: notification.id,
      time: notification.time,
      title: notification.title,
      description: notification.description,
      unread: false,
    }));
  }, [fallbackNotifications, rows, userId]);

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {loading ? (
        <article className="rounded-md border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading notifications.</p>
        </article>
      ) : null}

      {errorMessage ? (
        <article className="rounded-md border bg-card p-6">
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </article>
      ) : null}

      {!loading && displayNotifications.length === 0 ? (
        <article className="rounded-md border bg-card p-6">
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </article>
      ) : null}

      {displayNotifications.map((notification) => (
        <article
          className="rounded-md border bg-card p-6"
          key={notification.id}
        >
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
              <Bell className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {notification.time}
                {notification.unread ? ", Unread" : ""}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{notification.title}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                {notification.description}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function mergeNotificationRows(rows: NotificationRow[]) {
  const byId = new Map<string, NotificationRow>();

  for (const row of rows) {
    byId.set(row.id, row);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function formatNotificationTime(value: string) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(createdAt);
}
