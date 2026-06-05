import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject, saveQuestions, getProjectQuestions } from "@/lib/db";
import { generateQuestions } from "@/lib/questions";

/**
 * GET: Retrieves the list of questions for a project.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
    }
    const questions = await getProjectQuestions(projectId);
    return NextResponse.json({ questions, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const saveQuestionsSchema = z.object({
  projectId: z.string().min(1),
  questions: z.array(
    z.object({
      text: z.string().min(1, "La pregunta no puede estar vacía"),
      source: z.enum(["generated", "manual"]),
    })
  ),
});

const regenerateSchema = z.object({
  projectId: z.string().min(1),
  lang: z.enum(["es", "en"]).optional(),
  provider: z.string().optional(),
});

/**
 * PUT: Updates the project's questions list with manual edits.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const result = saveQuestionsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos de guardado inválidos", details: result.error.format() },
        { status: 400 }
      );
    }

    const { projectId, questions } = result.data;
    await saveQuestions(projectId, questions);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Regenerates the list of intent questions from the project description.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = regenerateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
    }

    const { projectId, lang = "en", provider = "gemini" } = result.data;
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: lang === "es" ? "Proyecto no encontrado" : "Project not found" }, { status: 404 });
    }

    const userGeminiKey = req.headers.get("x-gemini-key") || undefined;
    const userOpenaiKey = req.headers.get("x-openai-key") || undefined;
    const userPerplexityKey = req.headers.get("x-perplexity-key") || undefined;

    const questions = await generateQuestions(
      project.company_name,
      project.description,
      userGeminiKey,
      lang,
      provider,
      {
        gemini: userGeminiKey,
        openai: userOpenaiKey,
        perplexity: userPerplexityKey,
      }
    );
    await saveQuestions(projectId, questions);

    return NextResponse.json({ questions, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
