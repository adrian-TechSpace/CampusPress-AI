import Link from "next/link";

export default function DashboardIndexPage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-12 text-foreground md:px-12 lg:px-24">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 border-b pb-8">
        <p className="text-sm font-semibold text-primary">CampusPress workspace</p>
        <h1 className="font-serif text-5xl font-semibold tracking-normal">
          Choose a role workspace
        </h1>
        <p className="text-base leading-8 text-muted-foreground">
          Phase 2 has role-aware landing points so auth can route users into the correct
          workspace as each product surface comes online.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {["reader", "journalist", "editor", "admin"].map((role) => (
            <Link
              className="rounded-md border bg-card p-4 text-sm font-semibold shadow-sm"
              href={`/dashboard/${role}`}
              key={role}
            >
              {role}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
