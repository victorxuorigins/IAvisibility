import { NextResponse } from "next/server";
import { getAllAuditRuns } from "@/lib/db";

export async function GET() {
  try {
    const runs = await getAllAuditRuns();
    return NextResponse.json({ runs, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al recuperar el historial de auditorías", details: error.message },
      { status: 500 }
    );
  }
}
