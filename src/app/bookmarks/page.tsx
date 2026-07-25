import { BookmarksClient } from "@/components/reader/bookmarks-client";
import { ReaderChrome } from "@/components/reader/reader-chrome";

export default function BookmarksPage() {
  return (
    <ReaderChrome>
      <BookmarksClient />
    </ReaderChrome>
  );
}
