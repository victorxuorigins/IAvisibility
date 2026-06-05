import { notFound } from "next/navigation";
import { getProject, getProjectQuestions, getAuditRunsWithSOV } from "@/lib/db";
import ProjectDetailView from "@/components/ProjectDetailView";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const questions = await getProjectQuestions(id);
  const runs = await getAuditRunsWithSOV(id);

  return (
    <ProjectDetailView
      project={{
        ...project,
        competitors: project.competitors || [],
      }}
      initialQuestions={questions.map((q) => ({ text: q.text, source: q.source }))}
      runs={runs.map((r) => ({
        id: r.id,
        project_id: r.project_id,
        provider: r.provider,
        status: r.status,
        created_at: r.created_at,
        shareOfVoice: r.shareOfVoice || 0,
      }))}
    />
  );
}
