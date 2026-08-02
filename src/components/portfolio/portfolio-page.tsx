import Image from "next/image";
import Link from "next/link";
import { Award, BadgeCheck, FileText, Info, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import logo from "../../../assets/Chrisland university logo.webp";
import campusHero from "../../../assets/Chrisland University College of Law building.jpg";
import { Badge } from "@/components/ui/badge";
import type { PortfolioArticle, PortfolioBadge, RolePortfolio } from "@/lib/portfolio";

export function PortfolioPage({ portfolio }: { portfolio: RolePortfolio }) {
  const { profile, badges } = portfolio;

  return (
    <article className="bg-background text-foreground" data-testid="role-portfolio">
      <header className="relative min-h-[32rem] overflow-hidden">
        <Image
          alt="Chrisland University campus building"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={campusHero}
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="relative mx-auto flex min-h-[32rem] max-w-6xl flex-col justify-end gap-8 px-6 py-16">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center overflow-hidden rounded-md border bg-background/90">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="size-full object-cover" src={profile.avatarUrl} />
              ) : (
                <Image
                  alt="Chrisland University logo"
                  className="size-12 object-contain"
                  height={48}
                  priority
                  src={logo}
                  width={48}
                />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-primary">CampusPress portfolio</p>
              <p className="text-sm text-muted-foreground">{portfolioLabel(portfolio)}</p>
            </div>
          </div>

          <div className="grid max-w-4xl gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <VerificationBadge verified={profile.verified} />
              {portfolio.kind !== "admin" ? (
                <Badge variant="outline">{formatCount(profile.followerCount)} followers</Badge>
              ) : null}
              {portfolio.kind === "journalist" ? <Badge variant="outline">{profile.departmentCode}</Badge> : null}
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-tight md:text-7xl">
              {profile.fullName}
            </h1>
            {portfolio.kind === "admin" ? (
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                {profile.role === "subadmin" ? "Subadministrator profile" : "Administrator profile"} for CampusPress AI.
              </p>
            ) : (
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                {profile.bio ?? fallbackBio(portfolio.kind)}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-16 px-6 py-16">
        {portfolio.kind === "journalist" ? <JournalistPortfolioSections portfolio={portfolio} /> : null}
        {portfolio.kind === "reader" ? <ReaderPortfolioSections portfolio={portfolio} /> : null}
        {portfolio.kind === "editor" ? <EditorPortfolioSections portfolio={portfolio} /> : null}
        {portfolio.kind === "admin" ? <AdminPortfolioSections portfolio={portfolio} /> : null}

        {portfolio.kind !== "admin" || badges.some((badge) => badge.name !== "Unverified") ? (
          <BadgeSection badges={badges} />
        ) : null}
      </main>
    </article>
  );
}

function JournalistPortfolioSections({
  portfolio,
}: {
  portfolio: Extract<RolePortfolio, { kind: "journalist" }>;
}) {
  const { articles, credibility } = portfolio;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <StatBlock label="Followers" value={formatCount(portfolio.profile.followerCount)} />
        <StatBlock label="Published articles" value={articles.length.toString()} />
        <StatBlock
          label="Credibility average"
          value={credibility.workingSignalAverage === null ? "No evidence yet" : `${credibility.workingSignalAverage}%`}
        />
        <StatBlock label="Completed checks" value={credibility.completedWorkingSignals.toString()} />
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-6">
          <SectionHeading
            eyebrow="Published work"
            title="Articles on record"
            body="This portfolio only lists articles that have been published. Drafts, submitted stories, and revision work stay private."
          />

          {articles.length > 0 ? (
            <ArticleList articles={articles} />
          ) : (
            <EmptyPanel>No published articles are available on this portfolio yet.</EmptyPanel>
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
                Completed working checks: <span className="font-semibold text-foreground">{credibility.completedWorkingSignals}</span>
              </p>
              <p>
                OpenAI checks excluded: <span className="font-semibold text-foreground">{credibility.openAiExcludedSignals}</span>
              </p>
              <p>
                OpenAI-dependent checks are excluded from this average while they are unavailable, so failed provider rows never count as zero.
              </p>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}

function ReaderPortfolioSections({
  portfolio,
}: {
  portfolio: Extract<RolePortfolio, { kind: "reader" }>;
}) {
  const { readerActivity } = portfolio;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatBlock label="Followers" value={formatCount(portfolio.profile.followerCount)} />
        <StatBlock label="Public likes" value={readerActivity.sharesLikedArticles ? readerActivity.likedArticles.length.toString() : "Private"} />
        <StatBlock label="Public comments" value={readerActivity.sharesComments ? readerActivity.comments.length.toString() : "Private"} />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="grid gap-6">
          <SectionHeading
            eyebrow="Reader profile"
            title="Public reader activity"
            body="Reader activity is private unless this reader chooses to share it. Saved articles stay private."
          />
          {readerActivity.sharesLikedArticles && readerActivity.likedArticles.length > 0 ? (
            <ActivityList
              items={readerActivity.likedArticles.map((article) => ({
                href: `/articles/${article.slug}`,
                title: article.title,
                meta: `Liked ${formatDate(article.likedAt)}`,
              }))}
            />
          ) : (
            <EmptyPanel>Liked articles are not public on this reader portfolio.</EmptyPanel>
          )}
        </div>

        <div className="grid h-fit gap-6">
          <SectionHeading
            eyebrow="Comments"
            title="Shared comments"
            body="Only visible comments on published articles can appear here, and only when the reader opts in."
          />
          {readerActivity.sharesComments && readerActivity.comments.length > 0 ? (
            <ActivityList
              items={readerActivity.comments.map((comment) => ({
                href: `/articles/${comment.articleSlug}`,
                title: comment.articleTitle,
                meta: `${clipText(comment.body, 120)} / ${formatDate(comment.createdAt)}`,
              }))}
            />
          ) : (
            <EmptyPanel>Comments are not public on this reader portfolio.</EmptyPanel>
          )}
        </div>
      </section>
    </>
  );
}

function EditorPortfolioSections({
  portfolio,
}: {
  portfolio: Extract<RolePortfolio, { kind: "editor" }>;
}) {
  const { editorStats, profile } = portfolio;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <StatBlock label="Followers" value={formatCount(profile.followerCount)} />
        <StatBlock label="Articles reviewed" value={editorStats.reviewedCount.toString()} />
        <StatBlock label="Approved articles" value={editorStats.approvedCount.toString()} />
        <StatBlock label="Tenure" value={profile.tenureLabel} />
      </section>

      <section className="grid gap-6 rounded-md border bg-card p-6">
        <SectionHeading
          eyebrow="Editorial role"
          title="Review track record"
          body="This public editor profile shows review volume and tenure only. AI analysis report contents, moderation actions, and private decision notes are not exposed."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <StatBlock label="Completed decisions" value={editorStats.reviewedCount.toString()} />
          <StatBlock label="Approved outcomes" value={editorStats.approvedCount.toString()} />
          <StatBlock label="Revision requests" value={editorStats.revisionRequestedCount.toString()} />
        </div>
      </section>
    </>
  );
}

function AdminPortfolioSections({
  portfolio,
}: {
  portfolio: Extract<RolePortfolio, { kind: "admin" }>;
}) {
  const { profile } = portfolio;

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <StatBlock label="Role" value={profile.role === "subadmin" ? "Subadministrator" : "Administrator"} />
      <StatBlock label="Tenure" value={profile.tenureLabel} />
    </section>
  );
}

function BadgeSection({ badges }: { badges: PortfolioBadge[] }) {
  return (
    <section className="grid gap-4 rounded-md border bg-card p-5">
      <div className="flex items-center gap-2">
        <Award aria-hidden className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Earned badges</h2>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Achievement badges are earned from CampusPress records, not official university awards or grades.
      </p>
      {badges.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {badges.map((badge) => (
            <BadgeEvidence badge={badge} key={badge.name} />
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">No earned badges are available yet.</p>
      )}
    </section>
  );
}

function ArticleList({ articles }: { articles: PortfolioArticle[] }) {
  return (
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
            <h3 className="font-serif text-3xl font-semibold leading-tight">{article.title}</h3>
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
  );
}

function ActivityList({
  items,
}: {
  items: Array<{
    href: string;
    title: string;
    meta: string;
  }>;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Link className="grid gap-1 rounded-md border bg-card p-4" href={item.href} key={`${item.href}-${item.meta}`}>
          <span className="text-sm font-semibold">{item.title}</span>
          <span className="text-sm leading-6 text-muted-foreground">{item.meta}</span>
        </Link>
      ))}
    </div>
  );
}

function SectionHeading({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="grid gap-3 border-b pb-5">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="font-serif text-4xl font-semibold">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-md border bg-card p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold leading-tight">{value}</p>
    </div>
  );
}

function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge
        aria-label="Roster verification means CampusPress matched this account to a Chrisland student record. It confirms identity, not article quality or university endorsement."
        className="gap-2"
        title="Roster verification means CampusPress matched this account to a Chrisland student record. It confirms identity, not article quality or university endorsement."
        variant="verified"
      >
        <BadgeCheck aria-hidden className="size-4" />
        Verified Chrisland Student
        <Info aria-hidden className="size-3" />
      </Badge>
    );
  }

  return (
    <Badge
      aria-label="Unverified means no roster match has been recorded for this account yet."
      className="gap-2"
      title="Unverified means no roster match has been recorded for this account yet."
      variant="outline"
    >
      <UserRound aria-hidden className="size-4" />
      Unverified
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

function EmptyPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-md border bg-card p-6 text-sm leading-6 text-muted-foreground">{children}</div>;
}

function portfolioLabel(portfolio: RolePortfolio) {
  if (portfolio.kind === "reader") {
    return "Reader profile";
  }
  if (portfolio.kind === "editor") {
    return "Editorial profile";
  }
  if (portfolio.kind === "admin") {
    return portfolio.profile.role === "subadmin" ? "Subadministrator profile" : "Administrator profile";
  }
  return "Chrisland University student journalism";
}

function fallbackBio(kind: RolePortfolio["kind"]) {
  if (kind === "reader") {
    return "CampusPress reader profile.";
  }
  if (kind === "editor") {
    return "CampusPress editor supporting public student journalism.";
  }
  return "CampusPress journalist building a public record of published reporting.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function clipText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
