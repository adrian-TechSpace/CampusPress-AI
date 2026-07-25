import { FollowingClient } from "@/components/reader/following-client";
import { ReaderChrome } from "@/components/reader/reader-chrome";

export default function FollowingPage() {
  return (
    <ReaderChrome>
      <FollowingClient />
    </ReaderChrome>
  );
}
