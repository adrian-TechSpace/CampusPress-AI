import Link from "next/link";
import { notFound } from "next/navigation";
import {
  appRoleDescriptions,
  appRoleLabels,
  isAppRole,
  type AppRole,
} from "@/lib/onboarding";
import { ReaderHomeClient } from "@/components/reader/reader-home-client";
import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { loadPublishedFeedArticles } from "@/lib/reader-live-data";

type DashboardRolePageProps = {
  params: Promise<{
    role: string;
  }>;
};

export default async function DashboardRolePage({ params }: DashboardRolePageProps) {
  const { role } = await params;

  if (!isAppRole(role)) {
    notFound();
  }

  const typedRole = role as AppRole;

  if (typedRole === "reader") {
    const articles = await loadPublishedFeedArticles();

    return (
      <main className="min-h-dvh bg-background text-foreground">
        <AuthenticatedShell>
        <ReaderHomeClient initialArticles={articles} />
        </AuthenticatedShell>
      </main>
    );
  }

  if (typedRole === "admin") {
    return <AdminDashboardClient />;
  }

  return (
    <AuthenticatedShell>
      <main className="min-h-dvh bg-background px-6 py-12 text-foreground md:px-12 lg:px-24">
      <section className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4 border-b pb-8">
          <p className="text-sm font-semibold text-primary">CampusPress workspace</p>
          <h1 className="font-serif text-5xl font-semibold tracking-normal">
            {appRoleLabels[typedRole]}
          </h1>
          <p className="text-base leading-8 text-muted-foreground">
            {appRoleDescriptions[typedRole]}
          </p>
        </div>
        {typedRole === "journalist" ? (
          <div className="grid gap-4 rounded-md border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Journalist writing desk</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Draft stories, autosave work, review readability and grammar feedback,
              then submit finished articles for editorial review.
            </p>
            <Link
              className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              href="/write"
            >
              Open writing desk
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 rounded-md border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Phase 2 route confirmed</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              This placeholder will be replaced by the working role surface in its own
              phase. Auth can already route a signed-in profile here by role.
            </p>
            <Link className="text-sm font-semibold text-primary" href="/auth">
              Return to auth
            </Link>
          </div>
        )}
      </section>
      </main>
    </AuthenticatedShell>
  );
}
