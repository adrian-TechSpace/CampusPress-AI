import { notFound } from "next/navigation";
import { isAppRole, type AppRole } from "@/lib/onboarding";
import { ReaderHomeClient } from "@/components/reader/reader-home-client";
import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { RoleHomeClient } from "@/components/dashboard/role-home-client";
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
    return <RoleHomeClient role="admin" />;
  }

  if (typedRole === "journalist" || typedRole === "editor") {
    return <RoleHomeClient role={typedRole} />;
  }

  notFound();
}
