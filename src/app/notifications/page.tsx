import { Bell } from "lucide-react";

import { ReaderChrome } from "@/components/reader/reader-chrome";
import { notifications } from "@/lib/reader-data";

export default function NotificationsPage() {
  return (
    <ReaderChrome>
      <section className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            Notifications
          </p>
          <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight">
            Plain-English updates about stories, saves, and follows.
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            These messages avoid raw system names and explain what changed in
            reader language.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {notifications.map((notification) => (
            <article
              className="rounded-md border bg-card p-6"
              key={notification.id}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                  <Bell className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{notification.time}</p>
                  <h2 className="mt-1 text-xl font-semibold">{notification.title}</h2>
                  <p className="mt-2 leading-7 text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </ReaderChrome>
  );
}
