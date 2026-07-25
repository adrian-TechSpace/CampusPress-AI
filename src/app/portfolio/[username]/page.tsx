import { notFound } from "next/navigation";

import { PortfolioPage } from "@/components/portfolio/portfolio-page";
import { ReaderChrome } from "@/components/reader/reader-chrome";
import { loadJournalistPortfolio } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

type PortfolioRouteProps = {
  params: Promise<{
    username: string;
  }>;
};

export async function generateMetadata({ params }: PortfolioRouteProps) {
  const { username } = await params;
  const portfolio = await loadJournalistPortfolio(username);

  if (!portfolio) {
    return {
      title: "Portfolio not found | CampusPress AI",
    };
  }

  return {
    title: `${portfolio.profile.fullName} | CampusPress AI Portfolio`,
    description: portfolio.profile.bio ?? `Published CampusPress work by ${portfolio.profile.fullName}.`,
  };
}

export default async function PortfolioRoute({ params }: PortfolioRouteProps) {
  const { username } = await params;
  const portfolio = await loadJournalistPortfolio(username);

  if (!portfolio) {
    notFound();
  }

  return (
    <ReaderChrome>
      <PortfolioPage portfolio={portfolio} />
    </ReaderChrome>
  );
}
