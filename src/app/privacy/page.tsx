import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-12 text-foreground md:px-12 lg:px-24">
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b pb-8">
          <p className="text-sm font-semibold text-primary">CampusPress AI</p>
          <h1 className="font-serif text-5xl font-semibold tracking-normal">
            Privacy Policy
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Effective date: July 21, 2026
          </p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Information collected</h2>
          <p className="leading-8 text-muted-foreground">
            CampusPress AI collects account details, role selection, department, entry
            year, matric or staff ID, interests, articles, comments, messages, and
            moderation records needed to run the student newsroom.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Verification</h2>
          <p className="leading-8 text-muted-foreground">
            Matric and staff IDs are format-validated at signup. If an administrator
            uploads a roster later, matching profiles may be marked as verified. Until
            then, accounts remain usable but unverified.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">AI processing</h2>
          <p className="leading-8 text-muted-foreground">
            Drafts and submissions may be processed by grammar, readability,
            credibility, plagiarism, sentiment, and recommendation systems. Results are
            used to support writing and editorial review. Draft text may be sent to
            LanguageTool for grammar checking while a journalist writes.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Security and access</h2>
          <p className="leading-8 text-muted-foreground">
            Row-level security limits access by account and role. Administrators may
            access platform records needed for moderation, roster verification,
            support, and audit duties.
          </p>
        </section>

        <Link className="text-sm font-semibold text-primary" href="/auth">
          Return to auth
        </Link>
      </article>
    </main>
  );
}
