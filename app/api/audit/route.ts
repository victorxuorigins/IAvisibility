import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject, getProjectQuestions, createAuditRun, updateAuditRunStatus, saveAuditResponse } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { classifyDomain } from "@/lib/citations";

const auditSchema = z.object({
  projectId: z.string().min(1),
  provider: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = auditSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "projectId es requerido" },
        { status: 400 }
      );
    }

    const { projectId, provider } = result.data;
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const questions = await getProjectQuestions(projectId);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No hay preguntas configuradas para este proyecto" },
        { status: 400 }
      );
    }

    const providerName = provider || process.env.CITATION_PROVIDER || "mock";

    // 1. Create a pending audit run
    const runId = await createAuditRun(projectId, providerName);

    // Update status to running
    await updateAuditRunStatus(runId, "running");

    return NextResponse.json({ runId, success: true });
  } catch (error: any) {
    console.error("General error in audit initialization route:", error);
    return NextResponse.json(
      { error: "Error en el servidor al inicializar la auditoría", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { runId, status } = body;
    if (!runId || !status) {
      return NextResponse.json({ error: "runId y status son requeridos" }, { status: 400 });
    }
    await updateAuditRunStatus(runId, status);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating audit run status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
