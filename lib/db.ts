import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseKey!) : null;

// SQLite initialization (lazy load to prevent environment errors in build phase)
let sqliteDb: any = null;
function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  const dbPath = path.join(process.cwd(), "local.db");
  sqliteDb = new Database(dbPath);
  
  // Enable foreign key support
  sqliteDb.pragma("foreign_keys = ON");
  
  // Scaffolding local tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      domain TEXT NOT NULL,
      description TEXT,
      industry TEXT,
      target_market TEXT,
      competitors TEXT, -- Comma-separated list of domains
      created_at TEXT NOT NULL,
      current_step INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL, -- 'generated' | 'manual'
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL, -- 'pending' | 'running' | 'completed' | 'failed'
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES audit_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS citations (
      id TEXT PRIMARY KEY,
      response_id TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      title TEXT,
      classification TEXT NOT NULL, -- 'target' | 'competitor' | 'review' | 'publication' | 'other'
      FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE
    );
  `);

  // Migration for existing SQLite local databases
  try {
    sqliteDb.exec("ALTER TABLE projects ADD COLUMN current_step INTEGER DEFAULT 1");
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    sqliteDb.exec("ALTER TABLE projects ADD COLUMN industry TEXT");
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    sqliteDb.exec("ALTER TABLE projects ADD COLUMN target_market TEXT");
  } catch (e) {
    // Column already exists, ignore
  }
  
  return sqliteDb;
}

export interface ProjectInput {
  company_name: string;
  domain: string;
  description: string;
  industry?: string;
  target_market?: string;
  competitors: string[];
}

export interface QuestionInput {
  text: string;
  source: "generated" | "manual";
}

export interface CitationInput {
  url: string;
  domain: string;
  title?: string;
  classification: "target" | "competitor" | "review" | "publication" | "other";
}

/**
 * Creates a new company project.
 */
export async function createProject(project: ProjectInput): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const competitorsStr = project.competitors.join(",");

  if (isSupabaseConfigured) {
    const { error } = await supabase!
      .from("projects")
      .insert({
        id,
        company_name: project.company_name,
        domain: project.domain,
        description: project.description,
        industry: project.industry || null,
        target_market: project.target_market || null,
        competitors: competitorsStr,
        created_at: createdAt,
      });
    if (error) throw error;
  } else {
    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO projects (id, company_name, domain, description, industry, target_market, competitors, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      project.company_name,
      project.domain,
      project.description,
      project.industry || null,
      project.target_market || null,
      competitorsStr,
      createdAt
    );
  }

  return id;
}

/**
 * Updates the current progress step of the project.
 */
export async function updateProjectStep(projectId: string, step: number): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase!
      .from("projects")
      .update({ current_step: step })
      .eq("id", projectId);
    if (error) throw error;
  } else {
    const db = getSqliteDb();
    db.prepare("UPDATE projects SET current_step = ? WHERE id = ?").run(step, projectId);
  }
}

/**
 * Updates company profile details dynamically (autosave).
 */
export async function autosaveProject(projectId: string, data: Partial<ProjectInput>): Promise<void> {
  const updates: any = {};
  if (data.company_name !== undefined) updates.company_name = data.company_name;
  if (data.domain !== undefined) updates.domain = data.domain;
  if (data.description !== undefined) updates.description = data.description;
  if (data.industry !== undefined) updates.industry = data.industry;
  if (data.target_market !== undefined) updates.target_market = data.target_market;
  if (data.competitors !== undefined) updates.competitors = data.competitors.join(",");

  if (Object.keys(updates).length === 0) return;

  if (isSupabaseConfigured) {
    const { error } = await supabase!
      .from("projects")
      .update(updates)
      .eq("id", projectId);
    if (error) throw error;
  } else {
    const db = getSqliteDb();
    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const vals = Object.values(updates);
    vals.push(projectId);
    db.prepare(`UPDATE projects SET ${setClause} WHERE id = ?`).run(...vals);
  }
}

/**
 * Retrieves a single project.
 */
export async function getProject(id: string): Promise<any> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return {
      ...data,
      competitors: data.competitors ? data.competitors.split(",") : [],
      current_step: data.current_step || 1,
    };
  } else {
    const db = getSqliteDb();
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    if (!row) return null;
    return {
      ...row,
      competitors: row.competitors ? row.competitors.split(",") : [],
      current_step: row.current_step || 1,
    };
  }
}

/**
 * Lists all projects.
 */
export async function getProjects(): Promise<any[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      competitors: row.competitors ? row.competitors.split(",") : [],
      current_step: row.current_step || 1,
    }));
  } else {
    const db = getSqliteDb();
    const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    return rows.map((row: any) => ({
      ...row,
      competitors: row.competitors ? row.competitors.split(",") : [],
      current_step: row.current_step || 1,
    }));
  }
}

/**
 * Retrieves all questions for a specific project.
 */
export async function getProjectQuestions(projectId: string): Promise<any[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from("questions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  } else {
    const db = getSqliteDb();
    return db.prepare("SELECT * FROM questions WHERE project_id = ? ORDER BY created_at ASC").all(projectId);
  }
}

/**
 * Replaces/saves all questions for a project (deletes old questions first).
 */
export async function saveQuestions(projectId: string, questions: QuestionInput[]): Promise<void> {
  const createdAt = new Date().toISOString();

  if (isSupabaseConfigured) {
    const { error: delError } = await supabase!
      .from("questions")
      .delete()
      .eq("project_id", projectId);
    if (delError) throw delError;

    if (questions.length > 0) {
      const insertRows = questions.map((q) => ({
        id: crypto.randomUUID(),
        project_id: projectId,
        text: q.text,
        source: q.source,
        created_at: createdAt,
      }));
      const { error: insError } = await supabase!
        .from("questions")
        .insert(insertRows);
      if (insError) throw insError;
    }
  } else {
    const db = getSqliteDb();
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM questions WHERE project_id = ?").run(projectId);
      const insertStmt = db.prepare(`
        INSERT INTO questions (id, project_id, text, source, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const q of questions) {
        insertStmt.run(crypto.randomUUID(), projectId, q.text, q.source, createdAt);
      }
    });
    tx();
  }
}

/**
 * Creates a new audit run.
 */
export async function createAuditRun(projectId: string, provider: string): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (isSupabaseConfigured) {
    const { error } = await supabase!
      .from("audit_runs")
      .insert({
        id,
        project_id: projectId,
        provider,
        status: "pending",
        created_at: createdAt,
      });
    if (error) throw error;
  } else {
    const db = getSqliteDb();
    db.prepare(`
      INSERT INTO audit_runs (id, project_id, provider, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, projectId, provider, "pending", createdAt);
  }

  return id;
}

/**
 * Updates the execution status of an audit run.
 */
export async function updateAuditRunStatus(
  runId: string,
  status: "pending" | "running" | "completed" | "failed"
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase!
      .from("audit_runs")
      .update({ status })
      .eq("id", runId);
    if (error) throw error;
  } else {
    const db = getSqliteDb();
    db.prepare("UPDATE audit_runs SET status = ? WHERE id = ?").run(status, runId);
  }
}

/**
 * Saves a single response and its classified citations.
 */
export async function saveAuditResponse(
  runId: string,
  questionId: string,
  answer: string,
  citations: CitationInput[]
): Promise<string> {
  const responseId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (isSupabaseConfigured) {
    const { error: respError } = await supabase!
      .from("responses")
      .insert({
        id: responseId,
        run_id: runId,
        question_id: questionId,
        answer,
        created_at: createdAt,
      });
    if (respError) throw respError;

    if (citations.length > 0) {
      const citationRows = citations.map((c) => ({
        id: crypto.randomUUID(),
        response_id: responseId,
        url: c.url,
        domain: c.domain,
        title: c.title || null,
        classification: c.classification,
      }));
      const { error: citError } = await supabase!
        .from("citations")
        .insert(citationRows);
      if (citError) throw citError;
    }
  } else {
    const db = getSqliteDb();
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO responses (id, run_id, question_id, answer, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(responseId, runId, questionId, answer, createdAt);

      const insertCitation = db.prepare(`
        INSERT INTO citations (id, response_id, url, domain, title, classification)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const cit of citations) {
        insertCitation.run(
          crypto.randomUUID(),
          responseId,
          cit.url,
          cit.domain,
          cit.title || null,
          cit.classification
        );
      }
    });
    tx();
  }

  return responseId;
}

/**
 * Lists all audit runs for a specific project.
 */
export async function getAuditRuns(projectId: string): Promise<any[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from("audit_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } else {
    const db = getSqliteDb();
    return db.prepare("SELECT * FROM audit_runs WHERE project_id = ? ORDER BY created_at DESC").all(projectId);
  }
}

export interface ResponseDetails {
  id: string;
  question_id: string;
  question_text: string;
  answer: string;
  provider?: string;
  citations: {
    url: string;
    domain: string;
    title?: string;
    classification: "target" | "competitor" | "review" | "publication" | "other";
  }[];
}

export interface AuditRunDetails {
  run: {
    id: string;
    project_id: string;
    provider: string;
    status: "pending" | "running" | "completed" | "failed";
    created_at: string;
  };
  responses: ResponseDetails[];
}

/**
 * Returns structured metadata, responses, and citations for an audit run.
 */
export async function getAuditRunDetails(runId: string): Promise<AuditRunDetails | null> {
  if (isSupabaseConfigured) {
    const { data: run, error: runError } = await supabase!
      .from("audit_runs")
      .select("*")
      .eq("id", runId)
      .single();
    if (runError || !run) return null;

    // Fetch responses and include question texts
    const { data: responsesData, error: respError } = await supabase!
      .from("responses")
      .select(`
        id,
        question_id,
        answer,
        questions:question_id (
          text
        )
      `)
      .eq("run_id", runId);
    if (respError) throw respError;

    const responses: ResponseDetails[] = (responsesData || []).map((r: any) => ({
      id: r.id,
      question_id: r.question_id,
      question_text: r.questions?.text || "Pregunta eliminada",
      answer: r.answer,
      citations: [],
    }));

    if (responses.length > 0) {
      const responseIds = responses.map((r) => r.id);
      const { data: citationsData, error: citError } = await supabase!
        .from("citations")
        .select("*")
        .in("response_id", responseIds);
      if (citError) throw citError;

      for (const resp of responses) {
        resp.citations = (citationsData || [])
          .filter((c: any) => c.response_id === resp.id)
          .map((c: any) => ({
            url: c.url,
            domain: c.domain,
            title: c.title || undefined,
            classification: c.classification,
          }));
      }
    }

    return { run, responses };
  } else {
    const db = getSqliteDb();
    const run = db.prepare("SELECT * FROM audit_runs WHERE id = ?").get(runId);
    if (!run) return null;

    const responses = db.prepare(`
      SELECT r.id, r.question_id, q.text as question_text, r.answer
      FROM responses r
      JOIN questions q ON r.question_id = q.id
      WHERE r.run_id = ?
    `).all(runId) as any[];

    for (const resp of responses) {
      const cits = db.prepare(`
        SELECT url, domain, title, classification
        FROM citations
        WHERE response_id = ?
      `).all(resp.id) as any[];
      
      resp.citations = cits.map((c) => ({
        url: c.url,
        domain: c.domain,
        title: c.title || undefined,
        classification: c.classification,
      }));
    }

    return { run, responses };
  }
}

/**
 * Group runs executed close in time (within 2 minutes) for the same project.
 */
function groupRuns(runs: any[]): any[] {
  const grouped: any[] = [];
  
  for (const run of runs) {
    const runTime = new Date(run.created_at).getTime();
    
    // Find if there is an existing group in 'grouped' that this run can belong to
    // (same project_id and created_at within 2 minutes)
    const matchGroupIdx = grouped.findIndex(g => {
      if (g.project_id !== run.project_id) return false;
      const gTime = new Date(g.created_at).getTime();
      return Math.abs(gTime - runTime) <= 2 * 60 * 1000; // 2 minutes
    });
    
    if (matchGroupIdx !== -1) {
      const group = grouped[matchGroupIdx];
      group.ids.push(run.id);
      group.providers.push(run.provider);
      // Status consolidation logic
      if (run.status === "failed" || group.status === "failed") {
        group.status = "failed";
      } else if (run.status === "running" || group.status === "running") {
        group.status = "running";
      } else if (run.status === "pending" || group.status === "pending") {
        group.status = "pending";
      } else {
        group.status = "completed";
      }
      
      if (run.shareOfVoice !== undefined && group.shareOfVoices !== undefined) {
        group.shareOfVoices.push(run.shareOfVoice);
      }
    } else {
      grouped.push({
        ...run,
        ids: [run.id],
        providers: [run.provider],
        shareOfVoices: run.shareOfVoice !== undefined ? [run.shareOfVoice] : [],
      });
    }
  }
  
  return grouped.map(g => {
    // Deduplicate and join providers
    const uniqueProviders = Array.from(new Set(g.providers));
    const providerLabel = uniqueProviders.join(", ");
    
    let finalSOV = undefined;
    if (g.shareOfVoices.length > 0) {
      finalSOV = Math.round(g.shareOfVoices.reduce((a: number, b: number) => a + b, 0) / g.shareOfVoices.length);
    }
    
    return {
      ...g,
      id: g.ids.join(","), // Comma-separated runs list
      provider: providerLabel,
      shareOfVoice: finalSOV,
    };
  });
}

/**
 * Retrieves all audit runs across all projects, joining company name and domain.
 */
export async function getAllAuditRuns(): Promise<any[]> {
  let runs: any[] = [];
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from("audit_runs")
      .select(`
        *,
        projects:project_id (
          company_name,
          domain
        )
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    runs = (data || []).map((row: any) => ({
      ...row,
      company_name: row.projects?.company_name || "Empresa eliminada",
      domain: row.projects?.domain || "",
    }));
  } else {
    const db = getSqliteDb();
    runs = db.prepare(`
      SELECT r.*, p.company_name, p.domain
      FROM audit_runs r
      JOIN projects p ON r.project_id = p.id
      ORDER BY r.created_at DESC
    `).all();
  }
  return groupRuns(runs);
}

/**
 * Deletes a project and all its cascade dependencies.
 */
export async function deleteProject(projectId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase!
      .from("projects")
      .delete()
      .eq("id", projectId);
    if (error) throw error;
  } else {
    const db = getSqliteDb();
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  }
}

/**
 * Retrieves all audit runs with their calculated Share of Voice (SOV) percentage.
 */
export async function getAuditRunsWithSOV(projectId: string): Promise<any[]> {
  let runs: any[] = [];
  if (isSupabaseConfigured) {
    const { data: rawRuns, error: runError } = await supabase!
      .from("audit_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (runError) throw runError;
    if (!rawRuns || rawRuns.length === 0) return [];

    const runIds = rawRuns.map(r => r.id);
    const { data: responses, error: respError } = await supabase!
      .from("responses")
      .select("id, run_id")
      .in("run_id", runIds);
    if (respError) throw respError;

    const responseIds = (responses || []).map(r => r.id);
    let targetCitations: any[] = [];
    if (responseIds.length > 0) {
      const { data: cits, error: citError } = await supabase!
        .from("citations")
        .select("response_id")
        .eq("classification", "target")
        .in("response_id", responseIds);
      if (citError) throw citError;
      targetCitations = cits || [];
    }

    const targetCitedResponseIds = new Set(targetCitations.map(c => c.response_id));

    runs = rawRuns.map(run => {
      const runResponses = (responses || []).filter(r => r.run_id === run.id);
      const totalQuestions = runResponses.length;
      const targetPresenceCount = runResponses.filter(r => targetCitedResponseIds.has(r.id)).length;
      const shareOfVoice = totalQuestions > 0 ? Math.round((targetPresenceCount / totalQuestions) * 100) : 0;
      return {
        ...run,
        shareOfVoice,
      };
    });
  } else {
    const db = getSqliteDb();
    const rows = db.prepare(`
      SELECT 
        ar.*,
        (
          SELECT COUNT(DISTINCT r.id) 
          FROM responses r 
          WHERE r.run_id = ar.id
        ) as total_questions,
        (
          SELECT COUNT(DISTINCT r.id) 
          FROM responses r 
          WHERE r.run_id = ar.id 
          AND EXISTS (
            SELECT 1 FROM citations c 
            WHERE c.response_id = r.id 
            AND c.classification = 'target'
          )
        ) as target_presence
      FROM audit_runs ar
      WHERE ar.project_id = ?
      ORDER BY ar.created_at DESC
    `).all(projectId);

    runs = rows.map((row: any) => {
      const shareOfVoice = row.total_questions > 0 ? Math.round((row.target_presence / row.total_questions) * 100) : 0;
      return {
        id: row.id,
        project_id: row.project_id,
        provider: row.provider,
        status: row.status,
        created_at: row.created_at,
        shareOfVoice,
      };
    });
  }
  return groupRuns(runs);
}

