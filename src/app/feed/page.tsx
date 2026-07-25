import { FeedClient } from "@/components/reader/feed-client";
import { ReaderChrome } from "@/components/reader/reader-chrome";

export default function FeedPage() {
  return (
    <ReaderChrome>
      <FeedClient />
    </ReaderChrome>
  );
}
