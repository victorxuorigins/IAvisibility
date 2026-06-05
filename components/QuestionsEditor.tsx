"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Sparkles, Play, Save, AlertCircle, RefreshCw, Loader } from "lucide-react";
import { translations } from "@/lib/translations";

interface Question {
  text: string;
  source: "generated" | "manual";
}

interface QuestionsEditorProps {
  projectId: string;
  initialQuestions: Question[];
  lang?: "es" | "en";
}

export default function QuestionsEditor({ projectId, initialQuestions, lang: propLang }: QuestionsEditorProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.length > 0
      ? initialQuestions
      : [{ text: "", source: "manual" }]
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auditing States
  const [auditing, setAuditing] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const [lang, setLang] = useState<"es" | "en">("en");

  useEffect(() => {
    if (propLang) {
      setLang(propLang);
    } else if (typeof window !== "undefined") {
      setLang((localStorage.getItem("preferred_lang") as "es" | "en") || "en");
    }
  }, [propLang]);

  const t = translations[lang];

  const handleTextChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index].text = val;
    setQuestions(updated);
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { text: "", source: "manual" }]);
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated.length > 0 ? updated : [{ text: "", source: "manual" }]);
  };

  // 1. Save questions manually
  const handleSave = async (silent = false) => {
    if (!silent) setSaving(true);
    setError(null);

    const validQuestions = questions.filter((q) => q.text.trim().length > 0);
    if (validQuestions.length === 0) {
      setError(lang === "es" ? "Debes ingresar al menos una pregunta válida." : "You must enter at least one valid question.");
      setSaving(false);
      return false;
    }

    try {
      const res = await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          questions: validQuestions.map((q) => ({
            text: q.text.trim(),
            source: q.source,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (lang === "es" ? "Error al guardar preguntas" : "Error saving questions"));
      
      if (!silent) {
        setQuestions(validQuestions);
      }
      return true;
    } catch (err: any) {
      setError(err.message || (lang === "es" ? "Error al guardar" : "Error saving"));
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // 2. Regenerate questions using the LLM/template endpoint
  const handleRegenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (lang === "es" ? "Error al regenerar preguntas" : "Error regenerating questions"));

      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message || (lang === "es" ? "Error al regenerar" : "Error regenerating"));
    } finally {
      setLoading(false);
    }
  };

  // 3. Execute audit and animate simulated logs
  const handleRunAudit = async () => {
    setError(null);
    
    // Save current state first
    const saveSuccess = await handleSave(true);
    if (!saveSuccess) return;

    setAuditing(true);
    setProgress(5);
    setAuditLogs([lang === "es" ? "Iniciando motor de auditoría..." : "Starting audit engine..."]);

    const logMessages = lang === "es" ? [
      "Conectando con el motor de búsqueda conversacional...",
      `Ejecutando consulta 1 de ${questions.length} en el proveedor de IA...`,
      `Ejecutando consulta 2 de ${questions.length} en el proveedor de IA...`,
      `Ejecutando consulta 3 de ${questions.length} en el proveedor de IA...`,
      `Ejecutando consulta 4 de ${questions.length} en el proveedor de IA...`,
      `Ejecutando consulta 5 de ${questions.length} en el proveedor de IA...`,
      `Ejecutando consulta 6 de ${questions.length} en el proveedor de IA...`,
      "Deduplicando fuentes citadas...",
      "Normalizando y clasificando dominios web...",
      "Compilando resultados agregados del dashboard...",
    ] : [
      "Connecting to conversational search engine...",
      `Executing query 1 of ${questions.length} on AI provider...`,
      `Executing query 2 of ${questions.length} on AI provider...`,
      `Executing query 3 of ${questions.length} on AI provider...`,
      `Executing query 4 of ${questions.length} on AI provider...`,
      `Executing query 5 of ${questions.length} on AI provider...`,
      `Executing query 6 of ${questions.length} on AI provider...`,
      "Deduplicating cited sources...",
      "Normalizing and classifying web domains...",
      "Compiling aggregated dashboard results...",
    ];

    // Animate logs over time while the server executes the run
    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logMessages.length) {
        setAuditLogs((prev) => [...prev, logMessages[logIndex]]);
        setProgress((prev) => Math.min(prev + 9, 90));
        logIndex++;
      }
    }, 1000);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();
      clearInterval(logInterval);

      if (!res.ok) {
        throw new Error(data.error || (lang === "es" ? "La auditoría falló." : "The audit failed."));
      }

      setAuditLogs((prev) => [
        ...prev, 
        lang === "es" ? "¡Auditoría completada exitosamente!" : "Audit completed successfully!", 
        lang === "es" ? "Redireccionando al dashboard..." : "Redirecting to dashboard..."
      ]);
      setProgress(100);

      // Brief delay to let the user see the completed state
      setTimeout(() => {
        router.push(`/project/${projectId}/dashboard?runId=${data.runId}`);
      }, 800);
    } catch (err: any) {
      clearInterval(logInterval);
      setAuditLogs((prev) => [...prev, `❌ Error: ${err.message || (lang === "es" ? "Error al ejecutar la auditoría" : "Error running audit")}`]);
      setError(err.message || (lang === "es" ? "La auditoría falló." : "The audit failed."));
      // Stop blocking loading state so they can fix and try again
      setTimeout(() => {
        setAuditing(false);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6 relative">
      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 text-red-200 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Questions list container */}
      <div className="bg-card-bg backdrop-blur-md border border-card-border rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-200">{t.step2Header}</h2>
            <p className="text-xs text-gray-400">{t.step2SubHeader}</p>
          </div>
          
          <button
            onClick={handleRegenerate}
            disabled={loading || auditing}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-semibold px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.btnRegenIA}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
            <span className="text-sm text-gray-400">{t.regenLoading}</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {questions.map((q, idx) => (
              <div key={idx} className="flex items-center gap-3 group">
                <span className="text-xs font-semibold text-gray-500 font-mono w-5">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder={lang === "es" ? "Ej: ¿Cuáles son las alternativas a...?" : "e.g. What are the alternatives to...?"}
                  className="flex-1 py-2 px-3.5 bg-slate-950/60 border border-white/5 focus:border-violet-500/50 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${q.source === 'generated' ? 'bg-violet-500/15 text-violet-300 border border-violet-500/10' : 'bg-gray-500/15 text-gray-400 border border-gray-500/10'}`}>
                  {q.source === 'generated' ? (lang === "es" ? "IA" : "AI") : (lang === "es" ? "Manual" : "Manual")}
                </span>
                <button
                  onClick={() => handleRemoveQuestion(idx)}
                  className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer opacity-40 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-6">
          <button
            onClick={handleAddQuestion}
            disabled={loading || auditing}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white font-medium px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.btnAddQuestion}</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => handleSave()}
              disabled={loading || saving || auditing}
              className="flex items-center gap-1.5 text-xs text-gray-200 hover:text-white font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? t.saving : (lang === "es" ? "Guardar Cambios" : "Save Changes")}</span>
            </button>

            <button
              onClick={handleRunAudit}
              disabled={loading || auditing}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-indigo-950/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{lang === "es" ? "Ejecutar Auditoría" : "Run Audit"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive progress overlay during auditing */}
      {auditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <div className="bg-slate-900/90 border border-violet-500/20 max-w-lg w-full p-8 rounded-2xl shadow-2xl space-y-6 text-center">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
              <Play className="w-6 h-6 text-violet-400 fill-current" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">{lang === "es" ? "Ejecutando Auditoría" : "Running Audit"}</h3>
              <p className="text-xs text-gray-400">{lang === "es" ? "Analizando menciones de marca y extrayendo citas de la IA..." : "Analyzing brand mentions and extracting AI citations..."}</p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{lang === "es" ? "Progreso" : "Progress"}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-violet-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Live rolling logs */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 h-36 overflow-y-auto text-left font-mono text-[11px] text-gray-400 space-y-1.5 scrollbar-thin">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-violet-500">▶</span>
                  <span className={log.startsWith("❌") ? "text-red-400" : log.includes("✅") || log.includes("completada") || log.includes("successfully") ? "text-emerald-400" : "text-gray-300"}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
