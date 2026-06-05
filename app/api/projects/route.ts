import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, saveQuestions, getProjects, updateProjectStep, autosaveProject, getProject, deleteProject } from "@/lib/db";
import { generateQuestions } from "@/lib/questions";

const projectSchema = z.object({
  company_name: z.string().min(1, "El nombre de la empresa es obligatorio"),
  domain: z.string().min(1, "El dominio es obligatorio"),
  description: z.string().min(1, "La descripción es obligatoria"),
  industry: z.string().optional(),
  target_market: z.string().optional(),
  competitors: z.array(z.string()).default([]),
});

const projectPutSchema = z.object({
  id: z.string().min(1, "El ID del proyecto es requerido"),
  current_step: z.number().optional(),
  company_name: z.string().optional(),
  domain: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  target_market: z.string().optional(),
  competitors: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = projectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos de formulario inválidos", details: result.error.format() },
        { status: 400 }
      );
    }

    const { company_name, domain, description, industry, target_market, competitors } = result.data;

    // 1. Create the project record
    const projectId = await createProject({
      company_name,
      domain,
      description,
      industry,
      target_market,
      competitors,
    });

    const userGeminiKey = req.headers.get("x-gemini-key") || undefined;

    // 2. Pre-generate search query questions (LLM or template fallback)
    const questions = await generateQuestions(company_name, description, userGeminiKey);

    // 3. Persist these questions
    await saveQuestions(projectId, questions);

    return NextResponse.json({ id: projectId, success: true });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Error interno al crear el proyecto", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      const project = await getProject(projectId);
      if (!project) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ project, success: true });
    }

    const projects = await getProjects();
    return NextResponse.json({ projects, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener proyectos", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const result = projectPutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos de actualización inválidos", details: result.error.format() },
        { status: 400 }
      );
    }

    const { id, current_step, ...projectData } = result.data;

    if (current_step !== undefined) {
      await updateProjectStep(id, current_step);
    }

    if (Object.keys(projectData).length > 0) {
      await autosaveProject(id, projectData);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error autosaving project:", error);
    return NextResponse.json(
      { error: "Error al guardar el borrador", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "El ID del proyecto es requerido" }, { status: 400 });
    }

    await deleteProject(projectId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Error al eliminar el proyecto", details: error.message },
      { status: 500 }
    );
  }
}
