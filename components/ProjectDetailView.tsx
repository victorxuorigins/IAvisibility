"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Globe, ArrowLeft, Clock, Eye, Globe2, Trash2, Award } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import QuestionsEditor from "./QuestionsEditor";
import { translations } from "@/lib/translations";

interface Question {
  text: string;
  source: "generated" | "manual";
}

interface Run {
  id: string;
  project_id: string;
  provider: string;
  status: string;
  created_at: string;
  shareOfVoice: number;
}

interface ProjectDetailViewProps {
  project: {
    id: string;
    company_name: string;
    domain: string;
    description: string;
    competitors: string[];
    created_at: string;
  };
  initialQuestions: Question[];
  runs: Run[];
}

export default function ProjectDetailView({ project, initialQuestions, runs }: ProjectDetailViewProps) {
  const [lang, setLang] = useState<"es" | "en">("en");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setLang((localStorage.getItem("preferred_lang") as "es" | "en") || "en");
    }
  }, []);

  const t = translations[lang];

  const chartData = [...runs]
    .filter((r) => r.status === "completed")
    .reverse()
    .map((r) => ({
      date: !mounted
        ? ""
        : new Date(r.created_at).toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
            month: "short",
            day: "numeric",
          }),
      SOV: r.shareOfVoice,
    }));

  const handleToggleLang = () => {
    const nextLang = lang === "es" ? "en" : "es";
    setLang(nextLang);
    localStorage.setItem("preferred_lang", nextLang);
  };

  const handleDelete = async () => {
    const confirmDelete = confirm(
      lang === "es"
        ? "¿Estás seguro de que deseas eliminar este proyecto permanentemente? Todos los reportes e historial de auditoría se borrarán de forma irreversible."
        : "Are you sure you want to delete this project permanently? All reports and audit history will be irreversibly deleted."
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/projects?projectId=${project.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }
      router.push("/");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getStatusColorClass = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: "text-amber-400 bg-amber-400/15 border-amber-400/20",
      running: "text-violet-400 bg-violet-400/15 border-violet-400/20 animate-pulse",
      completed: "text-emerald-400 bg-emerald-400/15 border-emerald-400/20",
      failed: "text-red-400 bg-red-400/15 border-red-400/20",
    };
    return colors[status] || "text-gray-400 bg-gray-400/15 border-white/5";
  };

  const getStatusLabel = (status: string) => {
    if (!t.statusLabels) return status;
    return t.statusLabels[status as keyof typeof t.statusLabels] || status;
  };

  return (
    <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* Top Navigation & Language switcher */}
      <div className="flex justify-between items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.backToHomeLabel}</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Delete Project Button */}
          <button
            onClick={handleDelete}
            className="text-[10px] font-mono font-bold tracking-widest text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/25 px-2.5 py-1.5 rounded-lg border border-red-500/25 transition-all cursor-pointer shrink-0 flex items-center gap-1"
            title={lang === "es" ? "Eliminar Proyecto" : "Delete Project"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === "es" ? "ELIMINAR PROYECTO" : "DELETE PROJECT"}</span>
          </button>

          {/* Language Selector Toggle */}
          <button
            onClick={handleToggleLang}
            className="text-[10px] font-mono font-bold tracking-widest text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-500/25 px-2.5 py-1.5 rounded-lg border border-violet-500/25 transition-all cursor-pointer shrink-0"
            title="Switch Language / Cambiar Idioma"
          >
            {lang === "es" ? "EN" : "ES"}
          </button>
        </div>
      </div>

      {/* Project Metadata Card */}
      <div className="bg-card-bg backdrop-blur-md border border-card-border rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white leading-tight">
                  {project.company_name}
                </h1>
                <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                  <Globe className="w-3 h-3 text-gray-500" />
                  <span>{project.domain}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Competitors List Box */}
          {project.competitors && project.competitors.length > 0 && (
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 md:w-80 shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                {t.competitorsMonitoredLabel}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {project.competitors.map((comp: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-[10px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Questions Editor + Audits List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor (Span 2) */}
        <div className="lg:col-span-2">
          <QuestionsEditor
            projectId={project.id}
            initialQuestions={initialQuestions}
            lang={lang}
          />
        </div>

        {/* Sidebar: Audits List */}
        <div className="space-y-5">
          {/* Evolution Chart */}
          <div className="bg-card-bg backdrop-blur-md border border-card-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-violet-400" />
              <span>{lang === "es" ? "Evolución de Visibilidad" : "Visibility Evolution"}</span>
            </h2>
            <div className="h-48 w-full text-xs font-mono">
              {mounted ? (
                chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#090d16", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                        labelStyle={{ color: "#a78bfa", fontWeight: "bold", fontSize: "10px" }}
                        itemStyle={{ color: "#fff", fontSize: "11px" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="SOV"
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }}
                        dot={{ stroke: "#8b5cf6", strokeWidth: 2, r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500 text-center italic leading-relaxed py-8">
                    {lang === "es"
                      ? "Sin datos suficientes para graficar el historial."
                      : "Not enough data to plot history."}
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-500" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-card-bg backdrop-blur-md border border-card-border rounded-2xl p-6">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <span>{t.historyTitle}</span>
            </h2>

            {runs.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 border border-dashed border-white/5 rounded-xl">
                {t.noAuditsStarted}
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="p-3.5 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getStatusColorClass(run.status)}`}>
                        {getStatusLabel(run.status)}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {mounted && new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-white/5 pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400">
                          {t.providerLabel}: <span className="font-semibold text-gray-200 capitalize">{run.provider}</span>
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {mounted && new Date(run.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {run.status === "completed" && (
                        <Link
                          href={`/project/${project.id}/dashboard?runId=${run.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-bold hover:underline transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{t.viewReportLabel}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
