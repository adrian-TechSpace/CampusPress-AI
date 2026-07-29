import { FeedClient } from "@/components/reader/feed-client";
import { ReaderChrome } from "@/components/reader/reader-chrome";
import { loadPublishedFeedArticles } from "@/lib/reader-live-data";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const articles = await loadPublishedFeedArticles();

  return (
    <ReaderChrome>
      <FeedClient initialArticles={articles} />
    </ReaderChrome>
  );
}
