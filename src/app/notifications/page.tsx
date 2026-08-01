import { ReaderChrome } from "@/components/reader/reader-chrome";
import { NotificationsClient } from "@/components/reader/notifications-client";
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

        <NotificationsClient fallbackNotifications={notifications} />
      </section>
    </ReaderChrome>
  );
}
