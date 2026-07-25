import Image from "next/image";
import campusImage from "../../../../assets/Chrisland University College of Law building.jpg";
import { UpdatePasswordPanel } from "@/components/auth/update-password-panel";

export default function UpdatePasswordPage() {
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
      <div className="relative flex min-h-dvh items-center px-6 py-12 md:px-12 lg:px-24">
        <UpdatePasswordPanel />
      </div>
    </main>
  );
}
