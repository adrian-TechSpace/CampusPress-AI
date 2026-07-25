import { SearchClient } from "@/components/reader/search-client";
import { ReaderChrome } from "@/components/reader/reader-chrome";

export default function SearchPage() {
  return (
    <ReaderChrome>
      <SearchClient />
    </ReaderChrome>
  );
}
