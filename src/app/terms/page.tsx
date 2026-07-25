import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-12 text-foreground md:px-12 lg:px-24">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b pb-8">
          <p className="text-sm font-semibold text-primary">CampusPress AI</p>
          <h1 className="font-serif text-5xl font-semibold tracking-normal">
            Terms of Service
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Effective date: July 21, 2026
          </p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Use of the platform</h2>
          <p className="leading-8 text-muted-foreground">
            CampusPress AI is a Chrisland University student journalism platform for
            reading, writing, editing, and moderating campus stories. You agree to use
            it for lawful academic, editorial, and community purposes only.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Accounts and roles</h2>
          <p className="leading-8 text-muted-foreground">
            You are responsible for keeping your account secure. Reader and student
            journalist accounts may be created directly. Editor and administrator
            access must be assigned by an existing administrator or by the documented
            bootstrap process.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Editorial standards</h2>
          <p className="leading-8 text-muted-foreground">
            Users must not publish plagiarism, harassment, impersonation, or knowingly
            misleading material. AI analysis is an editorial aid and does not replace
            human review, source checking, or institutional policy.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Service changes</h2>
          <p className="leading-8 text-muted-foreground">
            CampusPress AI may update features, role permissions, and moderation rules
            as the project moves through its build phases. Material changes should be
            reflected in these terms before real users are onboarded.
          </p>
        </section>

        <Link className="text-sm font-semibold text-primary" href="/auth">
          Return to auth
        </Link>
      </article>
    </main>
  );
}
