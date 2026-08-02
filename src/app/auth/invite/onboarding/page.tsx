import Image from "next/image";

import campusImage from "../../../../../assets/Chrisland University College of Law building.jpg";
import { InviteOnboardingPanel } from "@/components/auth/invite-onboarding-panel";

export default function InviteOnboardingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <Image
        alt="Chrisland University College of Law building"
        className="object-cover"
        fill
        priority
        src={campusImage}
      />
      <div className="absolute inset-0 bg-background/70" />
      <div className="relative flex min-h-dvh items-center justify-center px-6 py-12 md:px-12 lg:px-24">
        <InviteOnboardingPanel />
      </div>
    </main>
  );
}
