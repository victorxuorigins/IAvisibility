import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject, getProjectQuestions, saveAuditResponse } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { classifyDomain } from "@/lib/citations";

const singleAuditSchema = z.object({
  projectId: z.string().min(1),
  runId: z.string().optional(),
  questionId: z.string().min(1),
  provider: z.string().optional(),
  preview: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = singleAuditSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "projectId y questionId son requeridos" },
        { status: 400 }
      );
    }

    const { projectId, runId, questionId, provider, preview } = result.data;

    if (!preview && !runId) {
      return NextResponse.json({ error: "runId es requerido para ejecuciones normales" }, { status: 400 });
    }

    // Load project details
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Load question text
    const questions = await getProjectQuestions(projectId);
    const q = questions.find((item) => item.id === questionId);
    if (!q) {
      return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
    }

    const providerName = provider || process.env.CITATION_PROVIDER || "mock";
    
    let userApiKey: string | undefined = undefined;
    if (providerName === "perplexity") {
      userApiKey = req.headers.get("x-perplexity-key") || undefined;
    } else if (providerName === "openai") {
      userApiKey = req.headers.get("x-openai-key") || undefined;
    } else if (providerName === "gemini") {
      userApiKey = req.headers.get("x-gemini-key") || undefined;
    }

    // Fetch configured provider
    const providerInstance = getProvider(providerName, {
      targetCompany: project.company_name,
      targetDomain: project.domain,
      competitors: project.competitors,
    }, userApiKey);

    try {
      const response = await providerInstance.query(q.text);

      // Classify citations dynamically based on target company & competitor list
      const classifiedCitations = response.citations.map((c) => ({
        url: c.url,
        domain: c.domain,
        title: c.title,
        classification: classifyDomain(c.domain, project.domain, project.competitors),
      }));

      // Persist the query results if not a preview
      let responseId = "";
      if (!preview && runId) {
        responseId = await saveAuditResponse(runId, q.id, response.answer, classifiedCitations);
      }

      return NextResponse.json({
        success: true,
        responseId: responseId || undefined,
        answer: response.answer,
        citations: classifiedCitations,
      });
    } catch (err: any) {
      console.error(`Failed to audit question ID ${q.id} ("${q.text}"):`, err);
      // Fallback: save an empty response so the run record is saved in the database (only if not preview)
      let responseId = "";
      if (!preview && runId) {
        responseId = await saveAuditResponse(runId, q.id, "", []);
      }
      return NextResponse.json({
        success: false,
        responseId: responseId || undefined,
        error: err.message || "Error al realizar la consulta a la IA",
        citations: [],
        answer: "",
      });
    }
  } catch (error: any) {
    console.error("General error in single question audit execution:", error);
    return NextResponse.json(
      { error: "Error en el servidor al ejecutar la consulta", details: error.message },
      { status: 500 }
    );
  }
}
