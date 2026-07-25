import Image from "next/image";
import { Suspense } from "react";
import campusImage from "../../../assets/Chrisland University College of Law building.jpg";
import { AuthPanel } from "@/components/auth/auth-panel";

export default function AuthPage() {
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
        <Suspense
          fallback={
            <section className="w-full max-w-3xl rounded-md border bg-background/90 p-8 shadow-sm">
              Loading auth...
            </section>
          }
        >
          <AuthPanel />
        </Suspense>
      </div>
    </main>
  );
}
