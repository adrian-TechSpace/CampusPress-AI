import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const readerData = read("src/lib/reader-data.ts");
const feedClient = read("src/components/reader/feed-client.tsx");
const feedPage = read("src/app/feed/page.tsx");
const landingPage = read("src/app/page.tsx");
const editorReview = read("src/lib/editor-review.ts");
const newsletterSubscribe = read("src/app/api/newsletter/subscribe/route.ts");
const appSource = [
  ...["src", "scripts", "supabase"].map((root) => root),
];

assert.match(
  readerData,
  /export function orderArticlesForInterests/,
  "Reader data must expose a deterministic interest-first ordering helper.",
);
assert.match(
  readerData,
  /hasSelectedInterestMatch/,
  "Reader ordering must explicitly group selected-interest matches before filler content.",
);
assert.doesNotMatch(
  feedClient,
  /useState<Interest\[\]>\(\["Campus Life"\]\)/,
  "FeedClient must not hard-code a reader's selected interests.",
);
assert.match(
  feedClient,
  /preferences.*interests|user_interests/s,
  "FeedClient must read the signed-in reader's selected interests.",
);

assert.ok(
  existsSync("src/lib/reader-live-data.ts"),
  "A server helper must load published articles from Supabase for live reader lists.",
);
const liveData = read("src/lib/reader-live-data.ts");
assert.match(liveData, /\.from\("articles"\)/, "Live reader helper must query articles.");
assert.match(liveData, /\.eq\("status", "published"\)/, "Live reader helper must only expose published articles.");
assert.match(liveData, /published_at.*ascending: false/s, "Live reader helper must order by latest publish time.");
assert.match(liveData, /profiles!articles_author_id_fkey/, "Live reader helper must include author metadata.");
assert.match(liveData, /categories/, "Live reader helper must include category metadata.");

assert.match(feedPage, /export const dynamic = "force-dynamic"/, "Feed page must be dynamic.");
assert.match(feedPage, /loadPublishedFeedArticles/, "Feed page must pass live articles into the feed client.");
assert.match(landingPage, /export const dynamic = "force-dynamic"/, "Landing page must be dynamic.");
assert.match(landingPage, /loadPublishedFeedArticles/, "Landing page must choose its latest story from live articles.");

assert.match(
  editorReview,
  /buildRevisionGuidance/,
  "Revision requests must build specific journalist guidance from AI report evidence.",
);
assert.match(
  editorReview,
  /AI report evidence to check/,
  "Revision request messages must label the AI evidence section plainly.",
);
assert.match(
  editorReview,
  /\.from\("ai_analyses"\)/,
  "Revision guidance must read the actual AI analysis rows for that article.",
);

assert.match(
  newsletterSubscribe,
  /newsletter_subscriptions/,
  "Current newsletter flow must at least store newsletter subscriptions.",
);
assert.match(
  newsletterSubscribe,
  /CampusPress AI newsletter confirmation/,
  "Current newsletter flow sends only subscription confirmation email from this route.",
);
assert.deepEqual(
  findPublishNewsletterSenders(appSource),
  [],
  "There must be no hidden per-article publish email sender before claiming batching is needed.",
);

console.log(
  JSON.stringify(
    {
      interestOrdering: true,
      liveReaderLists: true,
      revisionGuidanceUsesAiEvidence: true,
      newsletterCurrentBehavior: "subscription confirmation only, no per-article publish sender found",
    },
    null,
    2,
  ),
);

function findPublishNewsletterSenders(roots) {
  const matches = [];
  for (const root of roots) {
    walk(root, (path) => {
      if (!/\.(ts|tsx|mjs|sql)$/.test(path)) {
        return;
      }
      const source = read(path);
      const sendsEmail = /api\.resend\.com\/emails|resend\.emails\.send|sendEmail/i.test(source);
      const publishRelated = /published_at|status\s*=\s*'published'|status.*published|article_published|newsletter/i.test(source);
      if (
        sendsEmail &&
        publishRelated &&
        !path.endsWith("src/app/api/newsletter/subscribe/route.ts") &&
        !path.endsWith("scripts/correction-email-template-check.mjs") &&
        !path.endsWith("scripts/phase3-authenticated-backend-check.mjs") &&
        !path.endsWith("scripts/verify-track1-item5-static.mjs")
      ) {
        matches.push(path);
      }
    });
  }
  return matches.sort();

  function walk(dir, visit) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
        continue;
      }
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path, visit);
      } else if (statSync(path).isFile()) {
        visit(path);
      }
    }
  }
}
