import { AnalysisReportClient } from "@/components/editor/analysis-report-client";

type AnalysisPageProps = {
  params: Promise<{
    articleId: string;
  }>;
};

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { articleId } = await params;
  return <AnalysisReportClient articleId={articleId} />;
}
