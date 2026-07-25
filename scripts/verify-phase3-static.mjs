import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "src/app/page.tsx",
  "src/app/feed/page.tsx",
  "src/app/articles/[slug]/page.tsx",
  "src/app/search/page.tsx",
  "src/app/bookmarks/page.tsx",
  "src/app/following/page.tsx",
  "src/app/notifications/page.tsx",
  "src/app/api/auth/availability/route.ts",
  "src/app/api/newsletter/subscribe/route.ts",
  "src/components/auth/auth-panel.tsx",
  "src/components/reader/article-actions.tsx",
  "src/components/reader/feed-client.tsx",
  "src/components/reader/search-client.tsx",
  "src/components/reader/bookmarks-client.tsx",
  "src/components/reader/following-client.tsx",
  "src/components/reader/newsletter-form.tsx",
  "src/lib/reader-data.ts",
  "supabase/migrations/202607210001_phase_3_reader_auth_and_onboarding.sql",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Missing ${file}`);
}

const landingPage = readFileSync("src/app/page.tsx", "utf8");
const articlePage = readFileSync("src/app/articles/[slug]/page.tsx", "utf8");
const feedClient = readFileSync("src/components/reader/feed-client.tsx", "utf8");
const articleActions = readFileSync("src/components/reader/article-actions.tsx", "utf8");
const searchClient = readFileSync("src/components/reader/search-client.tsx", "utf8");
const notificationsPage = readFileSync("src/app/notifications/page.tsx", "utf8");
const readerData = readFileSync("src/lib/reader-data.ts", "utf8");
const bookmarksClient = readFileSync("src/components/reader/bookmarks-client.tsx", "utf8");
const followingClient = readFileSync("src/components/reader/following-client.tsx", "utf8");
const authPanel = readFileSync("src/components/auth/auth-panel.tsx", "utf8");
const newsletterRoute = readFileSync("src/app/api/newsletter/subscribe/route.ts", "utf8");
const phase3Migration = readFileSync(
  "supabase/migrations/202607210001_phase_3_reader_auth_and_onboarding.sql",
  "utf8",
);

assert.doesNotMatch(
  `${landingPage}\n${articlePage}\n${readerData}`,
  /art-emma-taylor-01\.jpg/,
  "Do not use the unverified Emma Taylor artwork on public pages",
);
assert.match(
  readerData,
  /onur-kurt-reading-newspaper-unsplash\.jpg/,
  "Reading Experience section must use the licensed newspaper photo replacement",
);

assert.match(landingPage, /CampusPress AI/, "Landing page must identify CampusPress AI");
assert.match(landingPage, /Chrisland University College of Law building/, "Landing must use real campus photography");
assert.match(landingPage, /Reading Experience/, "Landing must include the approved reading section");
assert.match(landingPage, /<footer/, "Landing must include a real footer");
assert.match(landingPage, /NewsletterForm/, "Landing must include working newsletter subscription");
assert.match(newsletterRoute, /newsletter_subscriptions/, "Newsletter API must store the email");
assert.match(newsletterRoute, /https:\/\/api\.resend\.com\/emails/, "Newsletter API must send through Resend");

assert.match(articlePage, /generateStaticParams/, "Published article URLs must be public static routes");
assert.doesNotMatch(
  articlePage,
  /getUser|getSession|redirect\(["']\/auth|login required|sign in required/i,
  "Published article reader must not be login-gated",
);
assert.match(articlePage, /max-w-3xl/, "Article reader must enforce a comfortable line length");
assert.match(articlePage, /font-serif text-5xl/, "Article reader must use a serif headline hierarchy");
assert.match(articlePage, /Why this was recommended/, "Article reader must include transparent recommendation context");

assert.match(
  `${feedClient}\n${readerData}`,
  /Why you are seeing this/,
  "Feed must show why each story appears",
);
assert.match(feedClient, /toggleInterest/, "Feed must change based on selected interests");

assert.match(searchClient, /searchArticles/, "Search page must query published article content");
assert.match(articleActions, /Bookmark/, "Article reader must support bookmarks");
assert.match(articleActions, /Heart/, "Article reader must support likes");
assert.match(articleActions, /UserPlus/, "Article reader must support following authors");
assert.match(articleActions, /Post comment/, "Article reader must support comments");
assert.doesNotMatch(
  `${articleActions}\n${bookmarksClient}\n${followingClient}\n${feedClient}`,
  /localStorage|reader-storage|use-reader-storage/,
  "Reader actions must not use browser localStorage",
);
assert.match(
  articleActions,
  /Sign in or create an account/,
  "Logged-out reader actions must show a sign-in prompt",
);
assert.match(articleActions, /\.from\("bookmarks"\)/, "Bookmarks must use the real table");
assert.match(articleActions, /\.from\("follows"\)/, "Follows must use the real table");
assert.match(articleActions, /\.from\("article_likes"\)/, "Likes must use the real table");
assert.match(articleActions, /\.from\("comments"\)/, "Comments must use the real table");

assert.match(authPanel, /Step \{step \+ 1\} of \{steps\.length\}/, "Signup must show progress");
assert.match(authPanel, /api\/auth\/availability/, "Signup must live-check username and phone");
assert.doesNotMatch(authPanel, /Administrator|Editor or lecturer/, "Signup must not offer admin or editor roles");
assert.match(authPanel, /XXX\/YYYY\/NNN/, "Matric placeholder must stay generic");

for (const code of [
  "ACC",
  "CSC",
  "LAW",
  "SWE",
  "CYB",
  "MLS",
  "POL",
  "BUS",
  "NSC",
  "PBH",
  "CRM",
  "MCB",
  "MTH",
  "PST",
  "MAS",
  "BCH",
  "ECO",
]) {
  assert.match(phase3Migration, new RegExp(`'${code}'`), `Migration must allow ${code}`);
}

assert.match(notificationsPage, /Plain-English updates/, "Notifications page must promise reader language");
assert.doesNotMatch(
  notificationsPage,
  /rls|jwt|uuid|foreign key|postgres|supabase/i,
  "Notifications must not expose raw system language",
);

console.log("phase 3 static verification passed");
