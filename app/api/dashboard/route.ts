import { NextResponse } from "next/server";
import { getAuditRunDetails, getProject } from "@/lib/db";
import { calculateDashboardMetrics } from "@/lib/analytics";
import { generateRecommendations } from "@/lib/recommendations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return NextResponse.json({ error: "runId es requerido" }, { status: 400 });
    }

    const runIds = runId.split(",").map(id => id.trim()).filter(id => id.length > 0);
    if (runIds.length === 0) {
      return NextResponse.json({ error: "runId es requerido" }, { status: 400 });
    }

    // 1. Fetch audit run, responses, and citations from data layer for all runs
    const allRunDetails = [];
    for (const rid of runIds) {
      const details = await getAuditRunDetails(rid);
      if (details) {
        // Tag responses with their provider name for frontend rendering
        details.responses.forEach(resp => {
          resp.provider = details.run.provider;
        });
        allRunDetails.push(details);
      }
    }

    if (allRunDetails.length === 0) {
      return NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 });
    }

    const primaryRun = allRunDetails[0].run;
    const mergedProviderName = allRunDetails.map(d => d.run.provider).join(", ");
    
    const combinedRun = {
      ...primaryRun,
      id: runId, // Pass back the comma-separated string
      provider: mergedProviderName,
    };

    // Merge all responses into a single flat array
    const mergedResponses = allRunDetails.flatMap(d => d.responses);

    const consolidatedRunDetails = {
      run: combinedRun,
      responses: mergedResponses,
    };

    // 2. Fetch associated project configuration
    const project = await getProject(primaryRun.project_id);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // 3. Compile metrics and recommendations
    const metrics = calculateDashboardMetrics(consolidatedRunDetails, project.domain, project.competitors);
    const recommendations = generateRecommendations(metrics, project.company_name);

    return NextResponse.json({
      project,
      run: combinedRun,
      metrics,
      recommendations,
      success: true,
    });
  } catch (error: any) {
    console.error("Error in dashboard API route:", error);
    return NextResponse.json(
      { error: "Error interno al recuperar los datos del dashboard", details: error.message },
      { status: 500 }
    );
  }
}
