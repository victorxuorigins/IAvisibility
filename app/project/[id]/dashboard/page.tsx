import { notFound, redirect } from "next/navigation";
import { getAuditRunDetails, getProject } from "@/lib/db";
import { calculateDashboardMetrics } from "@/lib/analytics";
import { generateRecommendations } from "@/lib/recommendations";
import DashboardView from "@/components/DashboardView";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ runId?: string }>;
}

export default async function ProjectDashboardPage({ params, searchParams }: DashboardPageProps) {
  const { id } = await params;
  const { runId } = await searchParams;

  if (!runId) {
    // Redirect back to project options if no audit run is specified
    redirect(`/project/${id}`);
  }

  const runIds = runId.split(",").map(id => id.trim()).filter(id => id.length > 0);
  
  // 1. Fetch audit run records (includes responses & citations) for all specified runIds
  const allRunDetails = [];
  for (const rid of runIds) {
    const details = await getAuditRunDetails(rid);
    if (details && details.run.project_id === id) {
      details.responses.forEach(resp => {
        resp.provider = details.run.provider;
      });
      allRunDetails.push(details);
    }
  }

  if (allRunDetails.length === 0) {
    notFound();
  }

  const primaryRun = allRunDetails[0].run;
  const mergedProviderName = allRunDetails.map(d => d.run.provider).join(", ");
  
  const combinedRun = {
    ...primaryRun,
    id: runId, // Keep comma-separated IDs
    provider: mergedProviderName,
  };

  const mergedResponses = allRunDetails.flatMap(d => d.responses);

  const consolidatedRunDetails = {
    run: combinedRun,
    responses: mergedResponses,
  };

  // 2. Fetch associated project profile
  const project = await getProject(id);
  if (!project) {
    notFound();
  }

  // 3. Aggregate analytics and trigger recommendations
  const metrics = calculateDashboardMetrics(consolidatedRunDetails, project.domain, project.competitors);
  const recommendations = generateRecommendations(metrics, project.company_name);

  return (
    <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 md:py-12 space-y-6">
      <DashboardView
        project={project}
        run={consolidatedRunDetails.run}
        metrics={metrics}
        recommendations={recommendations}
      />
    </main>
  );
}
