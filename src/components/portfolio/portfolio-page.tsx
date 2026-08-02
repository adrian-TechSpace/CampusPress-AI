import Image from "next/image";
import Link from "next/link";
import { Award, BadgeCheck, FileText, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import logo from "../../../assets/Chrisland university logo.webp";
import campusHero from "../../../assets/Chrisland University College of Law building.jpg";
import { Badge } from "@/components/ui/badge";
import type { JournalistPortfolio, PortfolioBadge } from "@/lib/portfolio";

export function PortfolioPage({ portfolio }: { portfolio: JournalistPortfolio }) {
  const { profile, articles, badges, credibility } = portfolio;

  return (
    <article className="bg-background text-foreground" data-testid="journalist-portfolio">
      <header className="relative min-h-[34rem] overflow-hidden">
        <Image
          alt="Chrisland University campus building"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={campusHero}
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="relative mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-end gap-8 px-6 py-16">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-md border bg-background/90">
              <Image
                alt="Chrisland University logo"
                className="size-12 object-contain"
                height={48}
                priority
                src={logo}
                width={48}
              />
            </span>
            <div>
              <p className="text-sm font-semibold text-primary">CampusPress portfolio</p>
              <p className="text-sm text-muted-foreground">Chrisland University student journalism</p>
            </div>
          </div>

          <div className="grid max-w-4xl gap-5">
            <div className="flex flex-wrap items-center gap-3">
              {profile.verified ? (
                <ExplainedBadge
                  description="Roster verification means CampusPress matched this account to a Chrisland student record. It confirms identity, not article quality or university endorsement."
                  variant="verified"
                >
                  <BadgeCheck aria-hidden className="mr-2 size-4" />
                  Verified Chrisland Student
                </ExplainedBadge>
              ) : (
                <ExplainedBadge
                  description="Unverified means no roster match has been recorded for this account yet. The profile can still publish if the account role allows it."
                  variant="outline"
                >
                  Unverified
                </ExplainedBadge>
              )}
              <Badge variant="outline">{profile.departmentCode}</Badge>
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-tight md:text-7xl">
              {profile.fullName}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
              {profile.bio ?? "CampusPress journalist building a public record of published reporting."}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-16 px-6 py-16">
        <section className="grid gap-4 md:grid-cols-3">
          <StatBlock label="Published articles" value={articles.length.toString()} />
          <StatBlock
            label="Credibility average"
            value={credibility.workingSignalAverage === null ? "No evidence yet" : `${credibility.workingSignalAverage}%`}
          />
          <StatBlock
            label="Completed checks"
            value={credibility.completedWorkingSignals.toString()}
          />
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="grid gap-6">
            <div className="grid gap-3 border-b pb-5">
              <p className="text-sm font-semibold text-primary">Published work</p>
              <h2 className="font-serif text-4xl font-semibold">Articles on record</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                This portfolio only lists articles that have been published. Drafts,
                submitted stories, and revision work stay private.
              </p>
            </div>

            {articles.length > 0 ? (
              <div className="grid gap-4">
                {articles.map((article) => (
                  <Link
                    className="grid gap-3 rounded-md border bg-card p-5 transition-colors hover:border-primary md:grid-cols-[1fr_auto]"
                    href={`/articles/${article.slug}`}
                    key={article.id}
                  >
                    <div className="grid gap-2">
                      <p className="text-sm font-semibold text-primary">
                        {article.publishedAt ? formatDate(article.publishedAt) : "Published"}
                      </p>
                      <h3 className="font-serif text-3xl font-semibold leading-tight">
                        {article.title}
                      </h3>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        {article.excerpt ?? clipText(article.plainText, 160)}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <FileText aria-hidden className="size-4" />
                      Read article
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border bg-card p-6 text-sm leading-6 text-muted-foreground">
                No published articles are available on this portfolio yet.
              </div>
            )}
          </div>

          <aside className="grid h-fit gap-6">
            <section className="grid gap-4 rounded-md border bg-card p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Credibility track record</h2>
              </div>
              <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Working-signal average:{" "}
                  <span className="font-semibold text-foreground">
                    {credibility.workingSignalAverage === null ? "Not available" : `${credibility.workingSignalAverage}%`}
                  </span>
                </p>
                <p>
                  Completed working checks:{" "}
                  <span className="font-semibold text-foreground">
                    {credibility.completedWorkingSignals}
                  </span>
                </p>
                <p>
                  OpenAI checks excluded:{" "}
                  <span className="font-semibold text-foreground">
                    {credibility.openAiExcludedSignals}
                  </span>
                </p>
                <p>
                  OpenAI-dependent checks are excluded from this average while
                  they are unavailable, so failed provider rows never count as zero.
                </p>
              </div>
            </section>

            <section className="grid gap-4 rounded-md border bg-card p-5">
              <div className="flex items-center gap-2">
                <Award aria-hidden className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Earned badges</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Achievement badges are earned from CampusPress records, not
                official university awards or grades.
              </p>
              {badges.length > 0 ? (
                <div className="grid gap-3">
                  {badges.map((badge) => (
                    <BadgeEvidence badge={badge} key={badge.name} />
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  No earned badges are available yet.
                </p>
              )}
            </section>
          </aside>
        </section>
      </main>
    </article>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-md border bg-card p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
}

function ExplainedBadge({
  children,
  description,
  variant,
}: {
  children: ReactNode;
  description: string;
  variant: "outline" | "verified";
}) {
  return (
    <Badge
      aria-label={description}
      className="gap-2"
      title={description}
      variant={variant}
    >
      {children}
      <Info aria-hidden className="size-3" />
    </Badge>
  );
}

function BadgeEvidence({ badge }: { badge: PortfolioBadge }) {
  return (
    <div className="grid gap-2 rounded-md border bg-background p-4">
      <Badge className="w-fit" variant={badge.tone === "verified" ? "verified" : "outline"}>
        {badge.name}
      </Badge>
      <p className="text-sm leading-6 text-muted-foreground">{badge.description}</p>
      <p className="text-xs font-semibold leading-5 text-foreground">{badge.evidence}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function clipText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
