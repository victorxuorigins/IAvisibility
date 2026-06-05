"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  Sparkles,
  BarChart3,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  Eye,
  Calendar,
  Layers,
  HelpCircle,
  Loader,
  Plus,
  X,
  Globe,
} from "lucide-react";
import { DashboardMetrics, calculateDashboardMetrics } from "@/lib/analytics";
import { Recommendation, generateRecommendations } from "@/lib/recommendations";
import { translations } from "@/lib/translations";

interface DashboardViewProps {
  project: {
    id: string;
    company_name: string;
    domain: string;
    description: string;
    competitors: string[];
    created_at: string;
  };
  run: {
    id: string;
    provider: string;
    status: string;
    created_at: string;
  };
  metrics: DashboardMetrics;
  recommendations: Recommendation[];
}

export default function DashboardView({ project, run, metrics, recommendations }: DashboardViewProps) {
  const [mounted, setMounted] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [lang, setLang] = useState<"es" | "en">("en");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const [selectedEngine, setSelectedEngine] = useState<string>("all");

  const originalResponses = metrics.questionsDetail.map(q => ({
    question_id: q.questionId,
    question_text: q.questionText,
    answer: q.answer,
    provider: q.provider,
    citations: q.citations,
    id: q.questionId,
    audit_run_id: run.id,
    created_at: run.created_at || "",
  }));

  const uniqueProviders = Array.from(new Set(originalResponses.map(r => r.provider).filter(Boolean))) as string[];

  // Dynamically calculate metrics & recommendations for rendering
  const activeMetrics = selectedEngine === "all"
    ? metrics
    : calculateDashboardMetrics(
        { 
          run: {
            ...run,
            project_id: project.id,
            status: run.status as any,
          },
          responses: originalResponses.filter(r => r.provider === selectedEngine) 
        },
        project.domain,
        project.competitors
      );

  const activeRecommendations = selectedEngine === "all"
    ? recommendations
    : generateRecommendations(activeMetrics, project.company_name, lang);

  // SSR hydration guard
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("preferred_lang");
      setLang("en");
    }
  }, []);

  const t = translations[lang];

  const toggleQuestion = (id: string) => {
    setOpenQuestionId(openQuestionId === id ? null : id);
  };

  // Color mappings for classifications
  const COLORS: { [key: string]: string } = {
    target: "#8b5cf6",      // Violet
    competitor: "#f97316",  // Orange
    review: "#3b82f6",      // Blue
    publication: "#14b8a6", // Teal
    other: "#6b7280",       // Gray
  };

  const getClassificationColor = (cls: string) => COLORS[cls] || COLORS.other;

  const getClassificationLabel = (cls: string) => {
    return t.sourcesTypes[cls as keyof typeof t.sourcesTypes] || cls;
  };

  // Custom tooltips for charts
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg text-xs shadow-xl">
          <p className="font-bold text-gray-200">{data.name}</p>
          <p className="text-gray-400 mt-1">{t.tableColCitations}: <span className="text-white font-semibold">{data.value}</span></p>
          <p className="mt-1 font-semibold" style={{ color: getClassificationColor(data.classification) }}>
            {getClassificationLabel(data.classification)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (() => {
    const metrics = activeMetrics;
    const recommendations = activeRecommendations;
    return (
      <div className="w-full space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href={`/project/${project.id}`}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.backToQuestionsLabel}</span>
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            {t.dashboardTitle}
          </h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              {t.auditedAtLabel.replace("{date}", new Date(run.created_at).toLocaleString())}
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-gray-500" />
              <span>{t.providerLabel}:</span> <span className="text-violet-400 font-semibold uppercase">{run.provider}</span>
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Language Selector Toggle Removed */}

          <Link
            href={`/project/${project.id}`}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10 hover:border-violet-500/20 cursor-pointer"
          >
            <span>{t.runNewAuditLabel}</span>
          </Link>
        </div>
      </div>

      {/* Engine Filter Pills (visible only when multiple providers are audited) */}
      {uniqueProviders.length > 1 && (
        <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-white/5 max-w-fit select-none">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest px-2">{lang === "es" ? "FILTRAR MOTOR:" : "FILTER ENGINE:"}</span>
          <button
            onClick={() => setSelectedEngine("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              selectedEngine === "all"
                ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 font-extrabold animate-fade-in"
                : "text-gray-400 hover:text-gray-200 bg-transparent"
            }`}
          >
            {lang === "es" ? "Todos" : "All"}
          </button>
          {uniqueProviders.map((prov) => (
            <button
              key={prov}
              onClick={() => setSelectedEngine(prov)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedEngine === prov
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 font-extrabold animate-fade-in"
                  : "text-gray-405 hover:text-white bg-transparent"
              }`}
            >
              {prov.toLowerCase() === "perplexity" ? "Perplexity" :
               prov.toLowerCase() === "openai" ? "OpenAI Search" :
               prov.toLowerCase() === "gemini" ? "Google Gemini" :
               "Datos Simulados (Mock)"}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Visibility Score */}
        <div 
          onClick={() => setActiveModal("visibility")}
          className="bg-card-bg backdrop-blur-md border border-card-border p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-gold-custom/50 hover:bg-[#0D121B]/40 transition-all"
          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              {lang === "es" ? "Puntuación de Visibilidad" : "Visibility Score"}
            </span>
            <span className="text-3xl font-black text-white">{metrics.newKpis?.visibilityScore ?? metrics.shareOfVoice}%</span>
            <p className="text-[11px] text-gray-400">{t.kpiShareOfVoiceDesc}</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center rounded-full bg-violet-500/10 text-violet-400">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Authority Score */}
        <div 
          onClick={() => setActiveModal("authority")}
          className="bg-card-bg backdrop-blur-md border border-card-border p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-blue-500/50 hover:bg-[#0D121B]/40 transition-all"
          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              {lang === "es" ? "Puntuación de Autoridad" : "Authority Score"}
            </span>
            <span className="text-3xl font-black text-white">{metrics.newKpis?.authorityScore ?? 0}%</span>
            <p className="text-[11px] text-gray-400">{lang === "es" ? "Calidad de citas externas" : "External citations quality"}</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Competitor Dominance Score */}
        <div 
          onClick={() => setActiveModal("competitors")}
          className="bg-card-bg backdrop-blur-md border border-card-border p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-red-500/50 hover:bg-[#0D121B]/40 transition-all"
          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              {lang === "es" ? "Dominio Competidor" : "Competitor Dominance"}
            </span>
            <span className="text-3xl font-black text-white">{metrics.newKpis?.competitorDominanceScore ?? 0}%</span>
            <p className="text-[11px] text-gray-400">{lang === "es" ? "Presencia del competidor líder" : "Leading competitor presence"}</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Content Gap Score */}
        <div 
          onClick={() => setActiveModal("contentGap")}
          className="bg-card-bg backdrop-blur-md border border-card-border p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-orange-500/50 hover:bg-[#0D121B]/40 transition-all"
          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              {lang === "es" ? "Brecha de Contenido" : "Content Gap Score"}
            </span>
            <span className="text-3xl font-black text-white">{metrics.newKpis?.contentGapScore ?? 0}%</span>
            <p className="text-[11px] text-gray-400">{lang === "es" ? "Vacíos frente a competidores" : "Gaps against competitors"}</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
            <HelpCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Opportunity Score */}
        <div 
          onClick={() => setActiveModal("opportunity")}
          className="bg-card-bg backdrop-blur-md border border-card-border p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:bg-[#0D121B]/40 transition-all"
          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              {lang === "es" ? "Puntuación Oportunidad" : "Opportunity Score"}
            </span>
            <span className="text-3xl font-black text-white">{metrics.newKpis?.opportunityScore ?? 0}%</span>
            <p className="text-[11px] text-gray-400">{lang === "es" ? "Margen potencial de mejora" : "Potential uplift margin"}</p>
          </div>
          <div className="relative h-14 w-14 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* KEY INSIGHTS QUICK DIAGNOSIS DASHBOARD */}
      <div className="bg-slate-950/40 border border-gold-custom/20 rounded-2xl p-6 space-y-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
          <div className="h-6 w-6 rounded bg-gold-custom/10 flex items-center justify-center border border-gold-custom/30">
            <Sparkles className="w-4 h-4 text-gold-custom" />
          </div>
          <span className="text-sm font-bold text-gold-custom uppercase tracking-wider font-mono">
            {lang === "es" ? "Diagnóstico Rápido de Auditoría (Resumen de Objetivos)" : "Quick Audit Diagnosis (Objectives Summary)"}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Objective 1: Dominios Más Citados */}
          <div 
            onClick={() => setActiveModal("topDomains")}
            className="p-5 rounded-2xl border border-white/5 bg-[#0D121B]/40 space-y-4 hover:border-gold-custom/50 hover:bg-[#0D121B]/60 transition-all flex flex-col justify-between cursor-pointer group"
            title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
          >
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2 group-hover:text-gold-custom transition-colors">
                <span className="w-2 h-2 rounded-full bg-gold-custom"></span>
                <span>{lang === "es" ? "1. Dominios Más Citados" : "1. Most Cited Domains"}</span>
              </h4>
              <p className="text-[11px] text-gray-400">
                {lang === "es" ? "Sitios con mayor volumen de menciones en las fuentes analizadas." : "Sources with the highest volume of mentions across the audit."}
              </p>
              <div className="space-y-2 text-xs">
                {metrics.topDomains && metrics.topDomains.length > 0 ? (
                  metrics.topDomains.slice(0, 3).map((dom: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-black/35 px-2.5 py-2 rounded-xl border border-white/5 font-mono">
                      <span className="text-gray-300 font-bold truncate max-w-[150px]">{dom.name}</span>
                      <span className="text-gold-custom font-extrabold">{dom.value} {lang === "es" ? "citas" : "cits"}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic text-xs py-2">{lang === "es" ? "No se detectaron dominios." : "No domains detected."}</div>
                )}
              </div>
            </div>
          </div>

          {/* Objective 2: Presencia de la Empresa Objetivo */}
          <div 
            onClick={() => setActiveModal("targetPresence")}
            className="p-5 rounded-2xl border border-white/5 bg-[#0D121B]/40 space-y-4 hover:border-gold-custom/50 hover:bg-[#0D121B]/60 transition-all flex flex-col justify-between cursor-pointer group"
            title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
          >
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2 group-hover:text-gold-custom transition-colors">
                <span className="w-2 h-2 rounded-full bg-gold-custom"></span>
                <span>{lang === "es" ? "2. Presencia de la Empresa Objetivo" : "2. Target Brand Presence"}</span>
              </h4>
              <p className="text-[11px] text-gray-400">
                {lang === "es" ? "Visibilidad e inclusión de tu marca en las respuestas generadas." : "Your brand visibility and inclusion inside the AI answers."}
              </p>
              
              <div className="flex flex-col gap-2.5 bg-black/35 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400 font-semibold">
                    {lang === "es" ? "Presencia en Consultas" : "Query Presence"}
                  </span>
                  <span className="text-lg font-black text-white font-mono">{metrics.targetPresenceCount} / {metrics.totalQuestions}</span>
                </div>
                
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gold-custom h-full rounded-full transition-all duration-1000"
                    style={{ width: `${metrics.shareOfVoice}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-1">
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                    metrics.shareOfVoice >= 70 ? "bg-success-custom/10 text-success-custom border-success-custom/25" :
                    metrics.shareOfVoice >= 35 ? "bg-warning-custom/10 text-warning-custom border-warning-custom/25" :
                    "bg-error-custom/10 text-error-custom border-error-custom/25"
                  }`}>
                    {metrics.shareOfVoice >= 70 ? (lang === "es" ? "FUERTE" : "STRONG") :
                     metrics.shareOfVoice >= 35 ? (lang === "es" ? "PARCIAL" : "PARTIAL") :
                     (lang === "es" ? "CRÍTICA" : "CRITICAL")}
                  </span>
                  <span className="text-sm font-black text-gold-custom font-mono">{metrics.shareOfVoice}% SOV</span>
                </div>
              </div>
            </div>
          </div>

          {/* Objective 3: Competidores y Terceros en Respuestas */}
          <div 
            onClick={() => setActiveModal("competitorCitations")}
            className="p-5 rounded-2xl border border-white/5 bg-[#0D121B]/40 space-y-4 hover:border-gold-custom/50 hover:bg-[#0D121B]/60 transition-all flex flex-col justify-between cursor-pointer group"
            title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
          >
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2 group-hover:text-gold-custom transition-colors">
                <span className="w-2 h-2 rounded-full bg-gold-custom"></span>
                <span>{lang === "es" ? "3. Competidores y Terceros Citados" : "3. Competitors & Third-Parties Cited"}</span>
              </h4>
              <p className="text-[11px] text-gray-400">
                {lang === "es" ? "Principales rivales y fuentes externas de autoridad detectados." : "Leading rivals and authoritative reference websites detected."}
              </p>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold block">{lang === "es" ? "Competidores:" : "Competitors:"}</span>
                  <div className="flex flex-wrap gap-1">
                    {metrics.topDomains && metrics.topDomains.filter((d: any) => d.classification === 'competitor').length > 0 ? (
                      metrics.topDomains.filter((d: any) => d.classification === 'competitor').slice(0, 3).map((d: any, idx: number) => (
                        <span key={idx} className="bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                          {d.name} ({d.value})
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 italic text-[9px]">{lang === "es" ? "Ninguno detectado" : "None detected"}</span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold block">{lang === "es" ? "Sitios de Autoridad / Terceros:" : "Authority / Third-Parties:"}</span>
                  <div className="flex flex-wrap gap-1">
                    {metrics.authorityAnalysis?.mostInfluentialDomains?.length > 0 ? (
                      metrics.authorityAnalysis.mostInfluentialDomains.slice(0, 3).map((d: any, idx: number) => (
                        <span key={idx} className="bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                          {d.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 italic text-[9px]">{lang === "es" ? "Ninguna fuente externa" : "No external sources"}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Objective 4: Oportunidades de Contenido */}
          <div 
            onClick={() => setActiveModal("contentOpportunities")}
            className="p-5 rounded-2xl border border-white/5 bg-[#0D121B]/40 space-y-4 hover:border-gold-custom/50 hover:bg-[#0D121B]/60 transition-all flex flex-col justify-between cursor-pointer group"
            title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
          >
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2 group-hover:text-gold-custom transition-colors">
                <span className="w-2 h-2 rounded-full bg-gold-custom"></span>
                <span>{lang === "es" ? "4. Oportunidades de Contenido" : "4. Content Gaps / Opportunities"}</span>
              </h4>
              <p className="text-[11px] text-gray-400">
                {lang === "es" ? "Preguntas críticas donde tu marca no aparece o requiere refuerzo." : "Intent questions where your brand has no presence or poor coverage."}
              </p>
              
              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                {metrics.questionsDetail && metrics.questionsDetail.filter((q: any) => !q.appeared || q.isOpportunity).length > 0 ? (
                  metrics.questionsDetail
                    .filter((q: any) => !q.appeared || q.isOpportunity)
                    .slice(0, 3)
                    .map((q: any, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 bg-black/35 p-2 rounded-xl border border-red-500/10 text-gray-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-[10px] block text-gray-200 truncate" title={q.questionText}>{q.questionText}</span>
                          <span className="text-[8px] text-red-400 uppercase font-mono font-bold tracking-widest block">
                            {lang === "es" ? "VACÍO DE CONTENIDO" : "CONTENT GAP"}
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-success-custom text-xs italic py-2">
                    {lang === "es" ? "¡Felicidades! No hay brechas críticas." : "Congratulations! No critical gaps found."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart: Top Cited Domains (Span 7) */}
        <div className="lg:col-span-7 bg-card-bg backdrop-blur-md border border-card-border p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-200">{t.topCitedDomainsTitle}</h2>
            <p className="text-xs text-gray-400">{t.topCitedDomainsDesc}</p>
          </div>
          
          <div className="h-72 w-full pr-4 text-xs font-mono">
            {mounted ? (
              metrics.topDomains.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.topDomains}
                    layout="vertical"
                    margin={{ top: 5, right: 5, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" stroke="rgba(255,255,255,0.3)" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="rgba(255,255,255,0.4)"
                      width={130}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                      {metrics.topDomains.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getClassificationColor(entry.classification)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  {t.noCitedDomainsFound}
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader className="w-6 h-6 text-gray-500 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart: Distribution Breakdown (Span 5) */}
        <div className="lg:col-span-5 bg-card-bg backdrop-blur-md border border-card-border p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-200">{t.distributionSourcesHeader}</h2>
            <p className="text-xs text-gray-400">{t.distributionSourcesDesc}</p>
          </div>

          <div className="h-72 w-full flex flex-col justify-center items-center">
            {mounted ? (
              metrics.classificationBreakdown.length > 0 ? (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.classificationBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {metrics.classificationBreakdown.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={getClassificationColor(entry.key)}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend list */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] pb-2">
                    {metrics.classificationBreakdown.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: getClassificationColor(entry.key) }}
                        />
                        <span className="text-gray-400">{getClassificationLabel(entry.key)}</span>
                        <span className="font-semibold text-gray-200">({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-xs">{t.noDistributionFound}</div>
              )
            ) : (
              <Loader className="w-6 h-6 text-gray-500 animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* Automatic Competitor Detection Widget */}
      {metrics.detectedPotentialCompetitors && metrics.detectedPotentialCompetitors.length > 0 && (
        <div className="bg-card-bg backdrop-blur-md border border-card-border p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-200">
              {lang === "es" ? "Detección Automática de Competidores (IA)" : "Automatic Competitor Detection (AI)"}
            </h2>
            <p className="text-xs text-gray-400">
              {lang === "es"
                ? "Estos dominios no están en tu lista de competidores pero son citados con frecuencia en las respuestas de la IA."
                : "These domains are not in your competitor list but are frequently cited in AI responses."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {metrics.detectedPotentialCompetitors.map((item) => (
              <div
                key={item.domain}
                className="bg-black/35 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-mono font-bold text-gray-300 block truncate">{item.domain}</span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {lang === "es" ? `${item.count} menciones` : `${item.count} mentions`}
                  </span>
                </div>

                <button
                  onClick={async () => {
                    try {
                      const updatedCompetitors = [...(project.competitors || []), item.domain];
                      const res = await fetch("/api/projects", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: project.id,
                          competitors: updatedCompetitors,
                        }),
                      });
                      if (!res.ok) throw new Error();
                      
                      window.location.reload();
                    } catch (err) {
                      alert(lang === "es" ? "Error al agregar competidor" : "Error adding competitor");
                    }
                  }}
                  className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white font-extrabold rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{lang === "es" ? "Agregar" : "Add"}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations engine section */}
      <div className="bg-card-bg backdrop-blur-md border border-card-border p-6 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-200">{t.geoRecommendationsTitle}</h2>
          <p className="text-xs text-gray-400">{t.geoRecommendationsDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {generateRecommendations(metrics, project.company_name, lang).map((rec) => {
            const iconMap = {
              warning: <AlertTriangle className="w-5 h-5 text-red-400" />,
              opportunity: <Sparkles className="w-5 h-5 text-purple-400" />,
              competitor: <BarChart3 className="w-5 h-5 text-orange-400" />,
              success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
            };
            const borderColors = {
              warning: "border-l-red-500 bg-red-950/10 border-white/5",
              opportunity: "border-l-purple-500 bg-purple-950/10 border-white/5",
              competitor: "border-l-orange-500 bg-orange-950/10 border-white/5",
              success: "border-l-emerald-500 bg-emerald-950/10 border-white/5",
            };

            return (
              <div
                key={rec.id}
                className={`p-4 border-y border-r border-l-4 rounded-xl flex gap-3.5 transition-all ${borderColors[rec.type]}`}
              >
                <div className="shrink-0 pt-0.5">{iconMap[rec.type]}</div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-gray-200">{rec.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{rec.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question Drill-Down Table */}
      <div className="bg-card-bg backdrop-blur-md border border-card-border rounded-2xl overflow-hidden p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-200">{t.resultsPerQueryTitle}</h2>
          <p className="text-xs text-gray-400">{t.resultsPerQueryDesc}</p>
        </div>

        <div className="space-y-3">
          {metrics.questionsDetail.map((item, index) => (
            <div
              key={item.questionId + "_" + (item.provider || "mock")}
              className="bg-slate-950/40 hover:bg-slate-950/60 border border-white/5 rounded-xl transition-all overflow-hidden"
            >
              {/* Collapsible Header Row */}
              <div
                onClick={() => toggleQuestion(item.questionId + "_" + (item.provider || "mock"))}
                className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-xs font-semibold text-gray-500 font-mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-200 block truncate sm:max-w-xl md:max-w-2xl">
                      {item.questionText}
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                      {item.provider && (
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                          item.provider.toLowerCase() === "perplexity"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/10"
                        }`}>
                          {item.provider.toLowerCase() === "perplexity" ? "Perplexity" : "Mock"}
                        </span>
                      )}
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${item.appeared ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10' : 'bg-red-500/15 text-red-400 border border-red-500/10'}`}>
                        {item.appeared ? t.drillDownLabels.appears : t.drillDownLabels.doesNotAppear}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {t.drillDownLabels.totalCitations} <span className="text-gray-300 font-semibold">{item.citationsCount}</span>
                      </span>
                      {item.topDomains.length > 0 && (
                        <>
                          <span className="text-gray-600 text-[10px]">•</span>
                          <span className="text-[10px] text-gray-500">
                            {lang === "es" ? "Citados" : "Cited"}: <span className="text-gray-300 font-medium">{item.topDomains.join(", ")}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-gray-400 hover:text-gray-200 transition-colors">
                  {openQuestionId === (item.questionId + "_" + (item.provider || "mock")) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* Collapsible Details Content */}
              {openQuestionId === (item.questionId + "_" + (item.provider || "mock")) && (
                <div className="border-t border-white/5 bg-slate-950/60 p-4 space-y-4 text-sm transition-all">
                  {/* AI Response Text Box */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      {t.aiResponseLabel}
                    </span>
                    {item.answer ? (
                      <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-normal text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {item.answer}
                      </div>
                    ) : (
                      <div className="border border-dashed border-red-500/20 text-red-300 text-xs py-3 px-4 rounded-lg bg-red-950/10">
                        {t.drillDownLabels.queryFailedOrEmpty}
                      </div>
                    )}
                  </div>

                  {/* List of cited URLs */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      {t.drillDownLabels.citedSources} ({item.citationsCount})
                    </span>
                    {item.citationsCount === 0 ? (
                      <p className="text-xs text-gray-500 italic">{t.drillDownLabels.noCitations}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {item.citations && item.citations.map((cit: any, cidx: number) => (
                          <a
                            key={cidx}
                            href={cit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-slate-900 border border-white/5 hover:border-violet-500/30 rounded-lg flex items-center justify-between gap-3 text-xs hover:bg-slate-950 transition-all group"
                          >
                            <div className="min-w-0">
                               <span className="font-bold text-gray-200 group-hover:text-violet-300 transition-colors block truncate">
                                {cit.title || cit.domain}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono block truncate">
                                {cit.url}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border"
                                style={{
                                  color: getClassificationColor(cit.classification),
                                  backgroundColor: getClassificationColor(cit.classification) + "15",
                                  borderColor: getClassificationColor(cit.classification) + "25",
                                }}
                              >
                                {getClassificationLabel(cit.classification)}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-violet-300 transition-colors" />
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal for KPI / Objective Cards */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in text-left">
          <div className="bg-[#0D121B] border border-gold-custom/30 w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xl relative max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-slate-950/60 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded bg-gold-custom/10 flex items-center justify-center border border-gold-custom/30">
                  <Sparkles className="w-3.5 h-3.5 text-gold-custom" />
                </div>
                <span className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono">
                  {lang === "es" ? "Detalle de Métrica de Auditoría" : "Audit Metric Breakdown"}
                </span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6 text-sm text-gray-300">
              {(() => {
                if (!metrics) return null;

                switch (activeModal) {
                  case "visibility":
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4 bg-gold-custom/5 border border-gold-custom/25 p-4 rounded-xl">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-gold-custom" />
                              <span>{lang === "es" ? "Puntuación de Visibilidad" : "Visibility Score"}</span>
                            </h3>
                            <p className="text-xs text-gray-400">
                              {lang === "es" ? "Porcentaje de preguntas en las que tu marca fue explícitamente citada o recomendada por el motor de IA." : "Percentage of buyer intent queries where your brand was cited or recommended by the AI."}
                            </p>
                          </div>
                          <span className="text-3xl font-black text-gold-custom font-mono">{metrics.newKpis?.visibilityScore ?? metrics.shareOfVoice}%</span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Detalle de Menciones por Pregunta" : "Mentions breakdown per query"}</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {metrics.questionsDetail.map((q: any, i: number) => (
                              <div key={i} className="flex justify-between items-center bg-black/35 p-2.5 rounded-xl border border-white/5 font-mono text-xs">
                                <span className="text-gray-300 truncate max-w-[380px]">{q.questionText}</span>
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                  q.appeared ? "bg-success-custom/10 text-success-custom border-success-custom/20" : "bg-error-custom/10 text-error-custom border-error-custom/20"
                                }`}>
                                  {q.appeared ? (lang === "es" ? "PRESENTE" : "PRESENT") : (lang === "es" ? "AUSENTE" : "ABSENT")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-gold-custom uppercase tracking-wider block font-mono">💡 {lang === "es" ? "RECOMENDACIÓN" : "RECOMMENDATION"}</span>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {lang === "es" 
                              ? "Para elevar la visibilidad, identifica las preguntas con estado 'AUSENTE' y publica artículos de blog o guías comparativas optimizadas. La IA prefiere fuentes con datos estructurados y respuestas directas a las preguntas frecuentes del comprador."
                              : "To boost visibility, target queries flagged as 'ABSENT' and publish optimized articles or comparison sheets. Generative AI prioritizes sites that provide straightforward answers directly targeting these specific intent queries."}
                          </p>
                        </div>
                      </div>
                    );

                  case "authority":
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4 bg-blue-500/5 border border-blue-500/25 p-4 rounded-xl">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-blue-400" />
                              <span>{lang === "es" ? "Puntuación de Autoridad" : "Authority Score"}</span>
                            </h3>
                            <p className="text-xs text-gray-400">
                              {lang === "es" ? "Mide la calidad y reputación de los dominios externos que te citan. Mayor peso en sitios de reseñas y prensa." : "Measures the quality and reputation of external domains citing your brand. Highly weighted towards reviews and industry publications."}
                            </p>
                          </div>
                          <span className="text-3xl font-black text-blue-400 font-mono">{metrics.newKpis?.authorityScore}%</span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Fuentes Externas de Autoridad Citadas" : "Cited Authoritative Sources"}</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {metrics.authorityAnalysis?.mostInfluentialDomains?.length > 0 ? (
                              metrics.authorityAnalysis.mostInfluentialDomains.slice(0, 5).map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-black/35 p-2.5 rounded-xl border border-white/5 font-mono text-xs">
                                  <span className="text-gray-300 font-bold">{d.name}</span>
                                  <span className="text-blue-400 font-extrabold uppercase text-[10px] bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                                    {d.classification || "Authority"} ({d.value} cits)
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500 italic text-xs py-2">{lang === "es" ? "No se registraron citas externas de autoridad." : "No authoritative sources cited."}</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block font-mono">💡 {lang === "es" ? "RECOMENDACIÓN" : "RECOMMENDATION"}</span>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {lang === "es"
                              ? "La IA depende en gran medida de agregadores de reseñas de terceros (ej: G2, Clutch, Capterra) y publicaciones sectoriales. Asegurar perfiles activos y con valoraciones altas en estas plataformas impulsará tu puntuación de autoridad."
                              : "Generative AI engines rely heavily on established third-party platforms (like G2, Capterra, Clutch) and industry-specific news outlets. Expanding customer reviews on these platforms directly boosts your citation trust and authority."}
                          </p>
                        </div>
                      </div>
                    );

                  case "competitors":
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4 bg-red-500/5 border border-red-500/25 p-4 rounded-xl">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                              <span>{lang === "es" ? "Dominio de Competidores" : "Competitor Dominance"}</span>
                            </h3>
                            <p className="text-xs text-gray-400">
                              {lang === "es" ? "Representa el Share of Voice (SOV) del competidor con mayor cantidad de menciones detectadas." : "Represents the Share of Voice (SOV) of your strongest competitor detected in the generated answers."}
                            </p>
                          </div>
                          <span className="text-3xl font-black text-red-400 font-mono">{metrics.newKpis?.competitorDominanceScore}%</span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Menciones de Competidores Registrados" : "Monitored Competitors Performance"}</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {metrics.competitorComparisons.filter((c: any) => !c.isTarget).length > 0 ? (
                              metrics.competitorComparisons
                                .filter((c: any) => !c.isTarget)
                                .map((c: any, i: number) => (
                                  <div key={i} className="flex justify-between items-center bg-black/35 p-2.5 rounded-xl border border-white/5 font-mono text-xs">
                                    <span className="text-gray-300 font-bold">{c.company} ({c.domain})</span>
                                    <span className="text-red-400 font-extrabold">{c.visibilityScore}% SOV</span>
                                  </div>
                                ))
                            ) : (
                              <div className="text-gray-500 italic text-xs py-2">{lang === "es" ? "No se registraron competidores citados." : "No competitor citations detected."}</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block font-mono">💡 {lang === "es" ? "RECOMENDACIÓN" : "RECOMMENDATION"}</span>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {lang === "es"
                              ? "Si un competidor tiene un SOV alto, crea páginas comparativas directas 'TuMarca vs Competidor'. Los motores de IA buscan activamente tablas de comparación y listados objetivos al responder a consultas de tipo 'Comparativa'."
                              : "If a competitor has a high dominance score, construct direct comparison tables 'YourBrand vs Competitor'. AI engines actively fetch clear comparative structures when answering comparison-based searches."}
                          </p>
                        </div>
                      </div>
                    );

                  case "contentGap":
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4 bg-orange-500/5 border border-orange-500/25 p-4 rounded-xl">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                              <HelpCircle className="w-4 h-4 text-orange-400" />
                              <span>{lang === "es" ? "Brecha de Contenido" : "Content Gap Score"}</span>
                            </h3>
                            <p className="text-xs text-gray-400">
                              {lang === "es" ? "Porcentaje de preguntas de intención de compra donde tu marca está ausente pero se cita a algún competidor." : "Percentage of buyer queries where your brand is missing but a competitor is explicitly cited."}
                            </p>
                          </div>
                          <span className="text-3xl font-black text-orange-400 font-mono">{metrics.newKpis?.contentGapScore}%</span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Preguntas Clave con Brecha" : "Key questions with content gaps"}</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {metrics.opportunityAnalysis && metrics.opportunityAnalysis.length > 0 ? (
                              metrics.opportunityAnalysis.map((op: any, i: number) => (
                                <div key={i} className="flex flex-col gap-1.5 bg-black/35 p-3 rounded-xl border border-white/5 text-xs">
                                  <div className="flex justify-between items-start gap-3">
                                    <span className="text-gray-200 font-bold font-mono">{op.questionText}</span>
                                    <span className="text-orange-400 bg-orange-500/10 border border-orange-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono shrink-0">
                                      {op.priority}
                                    </span>
                                  </div>
                                  <p className="text-gray-400 text-[11px] leading-relaxed italic">
                                    {lang === "es" ? op.recommendedAction : op.recommendedActionEn}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="text-success-custom text-xs italic py-2">{lang === "es" ? "No se detectaron brechas competitivas activas." : "No active competitor gaps detected."}</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block font-mono">💡 {lang === "es" ? "RECOMENDACIÓN" : "RECOMMENDATION"}</span>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {lang === "es"
                              ? "Las brechas de contenido indican que los motores de IA conocen la categoría de producto pero prefieren recomendar a tus rivales. Debes reescribir tus páginas y añadir palabras clave asociadas a estos casos de uso."
                              : "A content gap indicates that AI models recognize your solution category but prioritize your rivals' web pages. Address this by integrating specific use-case copy on your website."}
                          </p>
                        </div>
                      </div>
                    );

                  case "opportunity":
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4 bg-green-500/5 border border-green-500/25 p-4 rounded-xl">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-green-400" />
                              <span>{lang === "es" ? "Puntuación de Oportunidad" : "Opportunity Score"}</span>
                            </h3>
                            <p className="text-xs text-gray-400">
                              {lang === "es" ? "Espacio potencial de crecimiento de marca en motores de IA (100% - Visibilidad propia)." : "Potential search growth window inside conversational AI (100% - Your visibility score)."}
                            </p>
                          </div>
                          <span className="text-3xl font-black text-green-400 font-mono">{metrics.newKpis?.opportunityScore}%</span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Plan de Acción Inmediato" : "Recommended action plan"}</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {metrics.actionPlan && metrics.actionPlan.length > 0 ? (
                              metrics.actionPlan.slice(0, 4).map((act: any, idx: number) => (
                                <div key={idx} className="flex gap-2.5 items-start bg-black/35 p-2.5 rounded-xl border border-white/5 text-xs">
                                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border mt-0.5 shrink-0 font-mono ${
                                    act.priority === "High" ? "bg-red-500/10 text-red-300 border-red-500/20" :
                                    act.priority === "Medium" ? "bg-orange-500/10 text-orange-300 border-orange-500/20" :
                                    "bg-blue-500/10 text-blue-300 border-blue-500/20"
                                  }`}>
                                    {act.priority}
                                  </span>
                                  <div className="space-y-0.5">
                                    <p className="text-gray-200 font-semibold leading-relaxed">{lang === "es" ? act.action : act.actionEn}</p>
                                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono font-bold">{act.category}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-success-custom text-xs italic py-2">{lang === "es" ? "No se requieren acciones de optimización urgentes." : "No urgent optimization actions required."}</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider block font-mono">💡 {lang === "es" ? "RECOMENDACIÓN" : "RECOMMENDATION"}</span>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {lang === "es"
                              ? "Aprovecha esta puntuación implementando datos estructurados (Schema.org) y optimizando las respuestas en tu sitio web para que sean concisas (párrafos de menos de 60 palabras) y fácilmente indexables."
                              : "Optimize for this by structuring your website code using Schema.org tags, and summarizing product definitions in short paragraphs (less than 60 words) that are easily digestible for LLM web crawlers."}
                          </p>
                        </div>
                      </div>
                    );

                  case "topDomains":
                    return (
                      <div className="space-y-4">
                        <div className="bg-[#0D121B]/60 p-4 rounded-xl border border-white/5 space-y-1">
                          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-gold-custom" />
                            <span>{lang === "es" ? "Análisis de Dominios Más Citados" : "Most Cited Domains Analysis"}</span>
                          </h3>
                          <p className="text-xs text-gray-400">
                            {lang === "es" ? "Frecuencia de dominios recomendados a lo largo de todo el cuestionario de auditoría." : "Frequency of domains cited in the references for all tested queries."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Top 10 Dominios con Mayor Frecuencia" : "Top 10 Most Cited Web Domains"}</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {metrics.topDomains.map((dom: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center bg-black/35 p-2.5 rounded-xl border border-white/5 text-xs font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 font-bold">#{idx + 1}</span>
                                  <span className="text-gray-200 font-bold">{dom.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                                    dom.classification === "target" ? "bg-gold-custom/10 text-gold-custom border-gold-custom/25" :
                                    dom.classification === "competitor" ? "bg-red-500/10 text-red-300 border-red-500/20" :
                                    "bg-white/5 text-gray-400 border-white/5"
                                  }`}>
                                    {dom.classification}
                                  </span>
                                  <span className="text-gold-custom font-extrabold">{dom.value} {lang === "es" ? "citas" : "cits"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );

                  case "targetPresence":
                    return (
                      <div className="space-y-4">
                        <div className="bg-[#0D121B]/60 p-4 rounded-xl border border-white/5 space-y-1">
                          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-gold-custom" />
                            <span>{lang === "es" ? "Presencia de tu Marca" : "Brand Presence Summary"}</span>
                          </h3>
                          <p className="text-xs text-gray-400">
                            {lang === "es" ? "Detalle de los resultados de aparición de tu empresa en las respuestas directas de la IA." : "Breakdown of queries where your company was featured in generated responses."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Preguntas donde apareces" : "Queries where brand was present"}</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs font-mono">
                            {metrics.questionsDetail.filter((q: any) => q.appeared).length > 0 ? (
                              metrics.questionsDetail
                                .filter((q: any) => q.appeared)
                                .map((q: any, i: number) => (
                                  <div key={i} className="flex justify-between items-center bg-black/35 p-2.5 rounded-xl border border-green-500/10">
                                    <span className="text-gray-300 truncate max-w-[420px]">{q.questionText}</span>
                                    <span className="text-green-400 font-bold shrink-0">{q.citationsCount} cits</span>
                                  </div>
                                ))
                            ) : (
                              <div className="text-gray-500 italic py-2">{lang === "es" ? "Ausencia total de tu marca en las respuestas de la IA." : "Your brand had no mentions in this audit run."}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );

                  case "competitorCitations":
                    return (
                      <div className="space-y-4">
                        <div className="bg-[#0D121B]/60 p-4 rounded-xl border border-white/5 space-y-1">
                          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-gold-custom" />
                            <span>{lang === "es" ? "Competidores y Sitios de Autoridad" : "Competidores & Authority Breakdown"}</span>
                          </h3>
                          <p className="text-xs text-gray-400">
                            {lang === "es" ? "Listado de las fuentes de la competencia y de terceros citadas en la auditoría." : "Citations mapped to declared competitor websites and off-site industry authorities."}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Competidores Citados" : "Competitors Cited"}</h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {metrics.topDomains.filter((d: any) => d.classification === 'competitor').length > 0 ? (
                                metrics.topDomains.filter((d: any) => d.classification === 'competitor').map((d: any, idx: number) => (
                                  <div key={idx} className="bg-red-500/5 border border-red-500/10 p-2 rounded-lg text-xs font-mono flex justify-between">
                                    <span className="text-red-300">{d.name}</span>
                                    <span className="text-gray-500">{d.value} cits</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-600 italic text-[11px] py-1">{lang === "es" ? "Ningún competidor citado." : "No competitor cited."}</div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Autoridades / Terceros" : "Third Party Authorities"}</h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {metrics.authorityAnalysis?.mostInfluentialDomains?.length > 0 ? (
                                metrics.authorityAnalysis.mostInfluentialDomains.slice(0, 5).map((d: any, idx: number) => (
                                  <div key={idx} className="bg-blue-500/5 border border-blue-500/10 p-2 rounded-lg text-xs font-mono flex justify-between">
                                    <span className="text-blue-300">{d.name}</span>
                                    <span className="text-gray-500">{d.value} cits</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-gray-600 italic text-[11px] py-1">{lang === "es" ? "Ninguna fuente externa." : "No external sources."}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );

                  case "contentOpportunities":
                    return (
                      <div className="space-y-4">
                        <div className="bg-[#0D121B]/60 p-4 rounded-xl border border-white/5 space-y-1">
                          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-gold-custom" />
                            <span>{lang === "es" ? "Oportunidades de Contenido" : "Content Opportunities Analysis"}</span>
                          </h3>
                          <p className="text-xs text-gray-400">
                            {lang === "es" ? "Preguntas específicas del comprador donde tu marca no figura y se recomienda generar contenido enfocado." : "Queries where your competitors are mentioned, providing direct content creation hooks."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">{lang === "es" ? "Preguntas con Oportunidad de Creación" : "Opportunities & Action Items"}</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {metrics.questionsDetail.filter((q: any) => !q.appeared || q.isOpportunity).length > 0 ? (
                              metrics.questionsDetail
                                .filter((q: any) => !q.appeared || q.isOpportunity)
                                .map((q: any, i: number) => {
                                  // Simple dynamic recommendation for the modal list
                                  const rec = lang === "es" 
                                    ? `Publicar una respuesta concisa de menos de 60 palabras respondiendo directamente a "${q.questionText}" en tus páginas de producto.` 
                                    : `Publish a concise answer of less than 60 words addressing "${q.questionText}" directly inside your product pages.`;
                                  return (
                                    <div key={i} className="bg-black/35 p-3 rounded-xl border border-red-500/10 space-y-1.5 text-xs font-mono">
                                      <span className="text-gray-200 font-bold block">{q.questionText}</span>
                                      <p className="text-red-400 text-[11px] leading-relaxed">
                                        💡 <span className="font-sans text-gray-300 font-medium">{rec}</span>
                                      </p>
                                    </div>
                                  );
                                })
                            ) : (
                              <div className="text-success-custom text-xs italic py-2">{lang === "es" ? "¡Felicidades! No hay brechas críticas." : "Congratulations! No critical gaps found."}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );

                  default:
                    return null;
                }
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950/40 p-4 border-t border-white/5 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-gold-custom hover:bg-gold-hover text-black text-xs font-bold rounded-xl cursor-pointer transition-all uppercase tracking-wider"
              >
                {lang === "es" ? "Cerrar" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ); })();
}
