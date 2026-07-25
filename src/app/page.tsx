import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bell, Bookmark, Search, UserPlus } from "lucide-react";

import campusHero from "../../assets/Chrisland University College of Law building.jpg";
import lectureRooms from "../../assets/Entrance of lecture rooms.jpg";
import fieldReporter from "../../assets/Jornalism images/Photo-by-Numbercfoto-via-Iwaria.jpg";
import readingExperience from "../../assets/Jornalism images/onur-kurt-reading-newspaper-unsplash.jpg";
import logo from "../../assets/Chrisland university logo.webp";
import { NewsletterForm } from "@/components/reader/newsletter-form";
import { SiteNav } from "@/components/reader/site-nav";
import { Button } from "@/components/ui/button";
import { publishedArticles } from "@/lib/reader-data";

const latestArticle = publishedArticles[0];

export default function Home() {
  return (
    <main className="bg-background text-foreground">
      <SiteNav />

      <section className="relative flex min-h-dvh items-end overflow-hidden">
        <Image
          alt="Chrisland University College of Law building in daylight."
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={campusHero}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24 pt-24 text-white">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal">Chrisland University</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold leading-none md:text-7xl">
              CampusPress AI
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/90">
              A calmer public front door for student journalism, campus explainers,
              and reported stories readers can trust.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/feed">
              <Button size="lg">Open reader feed</Button>
            </Link>
            <Link href={`/articles/${latestArticle.slug}`}>
              <Button className="bg-white/15 text-white hover:bg-white/25" size="lg" variant="outline">
                Read latest
                <ArrowRight />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            Discover
          </p>
          <h2 className="font-serif text-5xl font-semibold leading-tight">
            The campus story appears before the interface does.
          </h2>
          <p className="text-lg leading-8 text-muted-foreground">
            The landing page follows the Tesla-paced rhythm approved for Phase 3:
            one photographic idea per section, restrained copy, and enough space
            for readers to understand what comes next before the page asks for
            another action.
          </p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
          <Image
            alt="Entrance of Chrisland University lecture rooms."
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            src={lectureRooms}
          />
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="relative order-2 aspect-[4/3] overflow-hidden rounded-md bg-muted lg:order-1">
            <Image
              alt="A field reporter holding a camera."
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              src={fieldReporter}
            />
          </div>
          <div className="order-1 flex flex-col gap-6 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-normal text-primary">
              Reporting
            </p>
            <h2 className="font-serif text-5xl font-semibold leading-tight">
              Built for student reporters, edited for public trust.
            </h2>
            <p className="text-lg leading-8 text-muted-foreground">
              Stories move from field notes to published articles with clear
              evidence, editorial review, and reader-facing context. Phase 3 keeps
              the published side quiet so the work can carry the page.
            </p>
            <Link className="w-fit" href="/search">
              <Button variant="outline">
                Search the archive
                <Search />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">
            Reading Experience
          </p>
          <h2 className="font-serif text-5xl font-semibold leading-tight">
            Articles stay readable, personal, and transparent.
          </h2>
          <p className="text-lg leading-8 text-muted-foreground">
            The reader can save a story, follow an author, like a piece, comment
            with context, and still understand why the feed is recommending the
            next article.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              className="rounded-md border bg-card px-4 py-4 text-sm font-semibold"
              href="/bookmarks"
            >
              <Bookmark className="mb-3 size-5 text-primary" />
              Bookmarks
            </Link>
            <Link
              className="rounded-md border bg-card px-4 py-4 text-sm font-semibold"
              href="/following"
            >
              <UserPlus className="mb-3 size-5 text-primary" />
              Following
            </Link>
            <Link
              className="rounded-md border bg-card px-4 py-4 text-sm font-semibold"
              href="/notifications"
            >
              <Bell className="mb-3 size-5 text-primary" />
              Notifications
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
          <Image
            alt="A person reading a newspaper beside a window."
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            src={readingExperience}
          />
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Image
                alt="Chrisland University logo"
                className="size-10 object-contain"
                height={40}
                src={logo}
                width={40}
              />
              <div>
                <p className="text-sm font-semibold">CampusPress AI</p>
                <p className="text-sm text-muted-foreground">Chrisland University</p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Student journalism, campus explainers, and reader updates for the
              Chrisland University community.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="grid gap-3">
              <p className="text-sm font-semibold">Quick links</p>
              <Link className="text-sm text-muted-foreground hover:text-foreground" href="/feed">
                Feed
              </Link>
              <Link className="text-sm text-muted-foreground hover:text-foreground" href="/search">
                Search
              </Link>
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href="/bookmarks"
              >
                Bookmarks
              </Link>
              <Link className="text-sm text-muted-foreground hover:text-foreground" href="/terms">
                Terms of Service
              </Link>
              <Link className="text-sm text-muted-foreground hover:text-foreground" href="/privacy">
                Privacy Policy
              </Link>
              <a
                className="text-sm text-muted-foreground hover:text-foreground"
                href="mailto:campuspress@chrislanduniversity.edu.ng"
              >
                campuspress@chrislanduniversity.edu.ng
              </a>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </footer>
    </main>
  );
}
