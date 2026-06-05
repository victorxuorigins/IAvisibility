"use client";

import { useState, useEffect } from "react";
import { translations } from "@/lib/translations";
import { generateRecommendations } from "@/lib/recommendations";
import { calculateDashboardMetrics } from "@/lib/analytics";
import {
  Sparkles,
  Database as DbIcon,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Plus,
  Trash2,
  Play,
  RotateCw,
  FolderOpen,
  History as HistoryIcon,
  Settings as SettingsIcon,
  HelpCircle,
  Building2,
  Globe,
  BookOpen,
  Award,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Zap,
  Info,
  Calendar,
  X,
  ChevronLeft,
  Save,
  FileDown,
  Eye,
} from "lucide-react";

interface Question {
  id?: string;
  text: string;
  source: "generated" | "manual";
  category: "Informational" | "Comparison" | "Commercial" | "High Intent";
}

interface ProjectData {
  id?: string;
  company_name: string;
  domain: string;
  description: string;
  industry: string;
  target_market: string;
  competitors: string;
}

export default function AuditWizard() {
  const [mounted, setMounted] = useState(false);

  // Language State: "es" | "en"
  const [lang, setLang] = useState<"es" | "en">("en");

  // Navigation Sidebar State: "new-audit" | "projects" | "history" | "settings" | "help"
  const [activeTab, setActiveTab] = useState<"new-audit" | "projects" | "history" | "settings" | "help">("new-audit");

  // Wizard Step State: 1 to 5 (active when activeTab is "new-audit")
  const [step, setStep] = useState(1);

  // Global Project & Audit Data
  const [projectId, setProjectId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  
  // Step 1 Company Details Form
  const [projectForm, setProjectForm] = useState<ProjectData>({
    company_name: "",
    domain: "",
    description: "",
    industry: "",
    target_market: "",
    competitors: "",
  });

  // Step 1 competitor chip input state
  const [competitorInput, setCompetitorInput] = useState("");  // Step 1 progressive sub-steps (1: Identidad, 2: Posicionamiento)
  const [step1SubStep, setStep1SubStep] = useState<1 | 2>(1);
  // Step 2 Question category filter
  const [categoryFilter, setCategoryFilter] = useState<"Todos" | "Informational" | "Comparison" | "Commercial" | "High Intent">("Todos");
  // Step 5 Report Tab state
  const [reportTab, setReportTab] = useState<"overview" | "analysis" | "opportunities" | "comparison" | "diagnosis">("overview");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  // Engine comparison active question state
  const [comparisonQuestionIdx, setComparisonQuestionIdx] = useState(0);
  const [openPriorities, setOpenPriorities] = useState<{ High: boolean; Medium: boolean; Low: boolean }>({
    High: true,
    Medium: true,
    Low: false
  });
  // Discreet autosave feedback status: "saving" | "saved" | null
  const [autosaveStatus, setAutosaveStatus] = useState<"saving" | "saved" | null>(null);
  // Real-time questions status loop states
  const [questionStates, setQuestionStates] = useState<any[]>([]);
  // Step 3 launch confirmation
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Step 2 Questions List
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Step 3 Provider Selection: list of selected providers
  const [selectedProviders, setSelectedProviders] = useState<("perplexity" | "mock" | "openai" | "gemini")[]>(["mock"]);

  // Step 4 Citation Extraction Details
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [rawResponseModal, setRawResponseModal] = useState<any | null>(null);

  // Step 5 Consolidated Analytics Data
  const [reportData, setReportData] = useState<any>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>("all");

  // Sidebar loaded metadata lists
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  
  // Client key settings (persisted in localStorage)
  const [perplexityKey, setPerplexityKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [generationEngine, setGenerationEngine] = useState<string>("gemini");

  // Step 2 AI Preview Modal states
  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);
  const [previewEngine, setPreviewEngine] = useState<string>("perplexity");
  const [previewResponse, setPreviewResponse] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Notification UI banner
  const [notification, setNotification] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const t = translations[lang];

  // Load API keys and restore active project on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPerplexityKey(localStorage.getItem("pplx_key_override") || "");
      setOpenaiKey(localStorage.getItem("openai_key_override") || "");
      setGeminiKey(localStorage.getItem("gemini_key_override") || "");
      setLang((localStorage.getItem("preferred_lang") as "es" | "en") || "en");
      loadProjects();
      loadHistory();
      
      const storedProjId = localStorage.getItem("current_project_id") || new URLSearchParams(window.location.search).get("projectId");
      if (storedProjId) {
        restoreActiveProject(storedProjId);
      } else {
        const draft = localStorage.getItem("project_form_draft");
        if (draft) {
          try {
            setProjectForm(JSON.parse(draft));
          } catch (e) {}
        }
      }
      setMounted(true);
    }
  }, []);

  // Save local draft of form fields
  useEffect(() => {
    if (typeof window !== "undefined" && !projectId) {
      localStorage.setItem("project_form_draft", JSON.stringify(projectForm));
    }
  }, [projectForm, projectId]);

  // Step 2 auto-generation trigger
  useEffect(() => {
    if (step === 2 && questions.length === 0 && projectId) {
      handleRegenerateQuestions();
    }
  }, [step, questions.length, projectId]);

  const triggerNotification = (text: string, type: "success" | "info" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) setProjectsList(data.projects);
    } catch (e) {
      console.error("Projects load error:", e);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const confirmDelete = confirm(
      lang === "es"
        ? "¿Estás seguro de que deseas eliminar este proyecto? Todos los cuestionarios y reportes de auditoría asociados se borrarán permanentemente."
        : "Are you sure you want to delete this project? All associated questionnaires and audit reports will be permanently deleted."
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/projects?projectId=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }
      triggerNotification(
        lang === "es" ? "Proyecto eliminado con éxito." : "Project deleted successfully.",
        "success"
      );
      loadProjects();
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/audit-runs");
      const data = await res.json();
      if (data.runs) setHistoryList(data.runs);
    } catch (e) {
      console.error("History load error:", e);
    }
  };

  const saveSettings = () => {
    localStorage.setItem("pplx_key_override", perplexityKey.trim());
    localStorage.setItem("openai_key_override", openaiKey.trim());
    localStorage.setItem("gemini_key_override", geminiKey.trim());
    triggerNotification(lang === "es" ? "Configuración de claves guardada en localstorage" : "Key settings saved to localstorage");
  };

  // Helper to categorize questions automatically
  const getCategoryBadge = (text: string): "Informational" | "Comparison" | "Commercial" | "High Intent" => {
    const q = text.toLowerCase();
    if (q.includes("vs") || q.includes("alternativas") || q.includes("comparar") || q.includes("comparativa")) {
      return "Comparison";
    }
    if (q.includes("comprar") || q.includes("precio") || q.includes("costo") || q.includes("adquirir")) {
      return "High Intent";
    }
    if (q.includes("mejor") || q.includes("lidera") || q.includes("proveedor") || q.includes("empresa")) {
      return "Commercial";
    }
    return "Informational";
  };

  const getFallbackQuestions = (companyName: string) => lang === "es" ? [
    { text: `¿Qué es ${companyName} y qué soluciones industriales ofrece?`, source: "generated" as const, category: "Informational" as const },
    { text: `¿Cómo se compara ${companyName} con sus principales competidores en el mercado?`, source: "generated" as const, category: "Comparison" as const },
    { text: `¿Cuál es el precio, costo y soporte técnico de ${companyName}?`, source: "generated" as const, category: "High Intent" as const },
    { text: `Opiniones, reviews y casos de éxito de clientes de ${companyName}`, source: "generated" as const, category: "Commercial" as const },
    { text: `Alternativas y marcas competidoras líderes en lugar de ${companyName}`, source: "generated" as const, category: "Comparison" as const },
    { text: `¿Cuáles son las ventajas energéticas y operativas de utilizar ${companyName}?`, source: "generated" as const, category: "Informational" as const }
  ] : [
    { text: `What is ${companyName} and what industrial solutions does it offer?`, source: "generated" as const, category: "Informational" as const },
    { text: `How does ${companyName} compare to its main competitors in the market?`, source: "generated" as const, category: "Comparison" as const },
    { text: `What is the pricing, cost, and technical support of ${companyName}?`, source: "generated" as const, category: "High Intent" as const },
    { text: `Reviews, feedback, and customer success cases of ${companyName}`, source: "generated" as const, category: "Commercial" as const },
    { text: `Alternatives and leading competitor brands instead of ${companyName}`, source: "generated" as const, category: "Comparison" as const },
    { text: `What are the energy and operational benefits of using ${companyName}?`, source: "generated" as const, category: "Informational" as const }
  ];

  const restoreActiveProject = async (projId: string) => {
    try {
      const res = await fetch(`/api/projects?projectId=${projId}`);
      const data = await res.json();
      if (data.project) {
        const proj = data.project;
        setProjectId(proj.id);
        setProjectForm({
          company_name: proj.company_name,
          domain: proj.domain,
          description: proj.description || "",
          industry: proj.industry || "",
          target_market: proj.target_market || "",
          competitors: proj.competitors ? proj.competitors.join(", ") : "",
        });
        
        localStorage.setItem("current_project_id", proj.id);
        
        const qRes = await fetch(`/api/questions?projectId=${proj.id}`);
        const qData = await qRes.json();
        if (qData.questions) {
          setQuestions(qData.questions.map((q: any) => ({
            id: q.id,
            text: q.text,
            source: q.source,
            category: getCategoryBadge(q.text)
          })));
        }
        
        const nextStep = proj.current_step || 1;
        setStep(nextStep);
        
        if (nextStep === 5) {
          const runsRes = await fetch("/api/audit-runs");
          const runsData = await runsRes.json();
          const projectRuns = runsData.runs?.filter((r: any) => r.project_id === proj.id) || [];
          if (projectRuns.length > 0) {
            handleLoadPastRun(projectRuns[0].id);
          } else {
            setStep(3);
          }
        }
      } else {
        setProjectId(null);
        localStorage.removeItem("current_project_id");
        setStep(1);
        triggerNotification(
          lang === "es" 
            ? "El proyecto activo no se encontró en la base de datos local y ha sido restablecido." 
            : "The active project was not found in the local database and has been reset.",
          "error"
        );
      }
    } catch (e) {
      console.error("Error restoring project session:", e);
    }
  };

  // Clickable Stepper Circle Handler
  const handleGoToStep = async (targetStep: number) => {
    let allowed = false;
    if (targetStep < step) {
      allowed = true;
    } else if (targetStep === 1) {
      allowed = true;
    } else if (targetStep === 2 && projectId) {
      allowed = true;
    } else if (targetStep === 3 && projectId && questions.length > 0) {
      allowed = true;
    } else if (targetStep === 4 && projectId && runId) {
      allowed = true;
    } else if (targetStep === 5 && projectId && reportData) {
      allowed = true;
    }
    
    if (allowed) {
      setStep(targetStep);
      if (projectId) {
        try {
          await fetch("/api/projects", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: projectId, current_step: targetStep }),
          });
        } catch (e) {
          console.error("Failed to save step navigation:", e);
        }
      }
    } else {
      let reason = "";
      if (targetStep === 2) reason = lang === "es" ? "Completa el Setup de la empresa primero" : "Complete the Company Setup first";
      else if (targetStep === 3) reason = lang === "es" ? "Genera y guarda las preguntas primero" : "Generate and save the questions first";
      else if (targetStep === 4) reason = lang === "es" ? "Configura e inicia la auditoría primero" : "Configure and start the audit first";
      else if (targetStep === 5) reason = lang === "es" ? "Ejecuta la auditoría para ver el reporte" : "Run the audit to view the report";
      
      if (reason) triggerNotification(reason, "info");
    }
  };

  // Domain normalizer function triggered on Website blur
  const handleDomainBlur = () => {
    if (!projectForm.domain) return;
    const normalized = projectForm.domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0];
    
    setProjectForm(prev => {
      const updated = { ...prev, domain: normalized };
      if (projectId) {
        autosaveProjectDetails(updated);
      }
      return updated;
    });
  };

  // Competitor chips list add/remove handlers
  const handleAddCompetitorChip = () => {
    const val = competitorInput.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    if (!val) return;
    
    const targetDomain = projectForm.domain.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    if (val === targetDomain) {
      triggerNotification(
        lang === "es" 
          ? "El dominio del competidor no puede ser igual al de tu empresa" 
          : "The competitor domain cannot be the same as your company's", 
        "error"
      );
      setCompetitorInput("");
      return;
    }
    
    const currentChips = projectForm.competitors
      ? projectForm.competitors.split(",").map(c => c.trim()).filter(c => c.length > 0)
      : [];

    if (currentChips.includes(val)) {
      setCompetitorInput("");
      return;
    }
    
    const updatedChips = [...currentChips, val];
    const updatedCompetitorsStr = updatedChips.join(", ");
    const updatedForm = { ...projectForm, competitors: updatedCompetitorsStr };
    setProjectForm(updatedForm);
    setCompetitorInput("");
    
    if (projectId) {
      autosaveProjectDetails(updatedForm);
    }
  };
  
  const handleRemoveCompetitorChip = (chipToRemove: string) => {
    const currentChips = projectForm.competitors
      ? projectForm.competitors.split(",").map(c => c.trim()).filter(c => c.length > 0)
      : [];

    const updatedChips = currentChips.filter(c => c !== chipToRemove);
    const updatedCompetitorsStr = updatedChips.join(", ");
    const updatedForm = { ...projectForm, competitors: updatedCompetitorsStr };
    setProjectForm(updatedForm);
    
    if (projectId) {
      autosaveProjectDetails(updatedForm);
    }
  };

  // Autosave company details (Step 1)
  const autosaveProjectDetails = async (formToSave: ProjectData) => {
    if (!projectId) return;
    setAutosaveStatus("saving");
    try {
      const competitorsArray = formToSave.competitors
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0);
      
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId,
          company_name: formToSave.company_name.trim(),
          domain: formToSave.domain.trim().toLowerCase(),
          description: formToSave.description.trim(),
          industry: formToSave.industry.trim() || undefined,
          target_market: formToSave.target_market.trim() || undefined,
          competitors: competitorsArray,
        }),
      });
      if (res.ok) {
        setAutosaveStatus("saved");
        setTimeout(() => setAutosaveStatus(null), 2000);
      } else {
        setAutosaveStatus(null);
      }
    } catch (e) {
      console.error("Autosave details error:", e);
      setAutosaveStatus(null);
    }
  };

  // Autosave questions (Step 2)
  const autosaveQuestions = async () => {
    if (!projectId) return;
    setAutosaveStatus("saving");
    try {
      const res = await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          questions: questions.map((q) => ({ text: q.text.trim(), source: q.source })),
        }),
      });
      if (res.ok) {
        setAutosaveStatus("saved");
        setTimeout(() => setAutosaveStatus(null), 2000);
      } else {
        setAutosaveStatus(null);
      }
    } catch (e) {
      console.error("Autosave questions error:", e);
      setAutosaveStatus(null);
    }
  };

  // --- Step Actions ---

  // Save Draft (Step 1)
  const handleSaveDraftStep1 = async () => {
    if (projectId) {
      await autosaveProjectDetails(projectForm);
    } else {
      triggerNotification(
        lang === "es" 
          ? "Borrador guardado localmente en el navegador" 
          : "Draft saved locally in browser", 
        "success"
      );
    }
  };

  // Submit Company Setup
  const handleContinueStep1 = async () => {
    if (!projectForm.company_name.trim() || !projectForm.domain.trim() || !projectForm.description.trim()) {
      triggerNotification(
        lang === "es" 
          ? "Completa todos los campos obligatorios" 
          : "Complete all required fields", 
        "error"
      );
      return;
    }

    setAuditLoading(true);
    triggerNotification(
      projectId 
        ? (lang === "es" ? "Guardando cambios..." : "Saving changes...") 
        : (lang === "es" ? "Creando empresa y generando intenciones..." : "Creating company and generating buyer intent questions..."), 
      "info"
    );

    try {
      const competitorsArray = projectForm.competitors
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0);

      const domainNormalized = projectForm.domain.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "");

      let activeId = projectId;

      if (activeId) {
        const res = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activeId,
            company_name: projectForm.company_name.trim(),
            domain: domainNormalized,
            description: projectForm.description.trim(),
            industry: projectForm.industry.trim() || undefined,
            target_market: projectForm.target_market.trim() || undefined,
            competitors: competitorsArray,
            current_step: 2,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fallo al actualizar proyecto");
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-gemini-key": geminiKey.trim(),
          },
          body: JSON.stringify({
            company_name: projectForm.company_name.trim(),
            domain: domainNormalized,
            description: projectForm.description.trim(),
            industry: projectForm.industry.trim() || undefined,
            target_market: projectForm.target_market.trim() || undefined,
            competitors: competitorsArray,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fallo en creación de proyecto");
        activeId = data.id;
        setProjectId(activeId);
        localStorage.setItem("current_project_id", activeId as string);
      }

      const qRes = await fetch(`/api/questions?projectId=${activeId}`);
      const qData = await qRes.json();
      
      let questionsList = [];
      if (qData.questions && qData.questions.length > 0) {
        questionsList = qData.questions.map((q: any) => ({
          id: q.id,
          text: q.text,
          source: q.source,
          category: getCategoryBadge(q.text),
        }));
      } else {
        const fallbacks = getFallbackQuestions(projectForm.company_name);
        questionsList = fallbacks;
        await fetch("/api/questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: activeId,
            questions: fallbacks.map(q => ({ text: q.text, source: q.source }))
          })
        });
      }
      
      setQuestions(questionsList);
      loadProjects();
      setStep(2);
      triggerNotification(
        lang === "es" 
          ? "Empresa guardada. Paso 2: Preguntas de intención del comprador." 
          : "Company saved. Step 2: Buyer Intent Questions."
      );
    } catch (e: any) {
      triggerNotification(
        e.message || (lang === "es" ? "Error al guardar la empresa" : "Error saving company details"), 
        "error"
      );
    } finally {
      setAuditLoading(false);
    }
  };

  // --- Step 2: Actions ---

  const handleUpdateQuestionText = (idx: number, val: string) => {
    const updated = [...questions];
    updated[idx].text = val;
    updated[idx].category = getCategoryBadge(val);
    setQuestions(updated);
  };

  const handleUpdateQuestionCategory = async (idx: number, cat: any) => {
    const updated = [...questions];
    updated[idx].category = cat;
    setQuestions(updated);
    if (projectId) {
      await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          questions: updated.map((q) => ({ text: q.text.trim(), source: q.source })),
        }),
      });
      showAutosaveStatusFeedback();
    }
  };

  const showAutosaveStatusFeedback = () => {
    setAutosaveStatus("saving");
    setTimeout(() => {
      setAutosaveStatus("saved");
      setTimeout(() => setAutosaveStatus(null), 2000);
    }, 500);
  };

  const handleAddQuestion = async () => {
    if (questions.length >= 12) {
      triggerNotification(
        lang === "es" 
          ? "Límite máximo de 12 preguntas por auditoría" 
          : "Maximum limit of 12 questions per audit", 
        "error"
      );
      return;
    }
    const newQ: Question = {
      text: lang === "es" 
        ? `¿Cuál es el soporte y mantenimiento ofrecido por ${projectForm.company_name}?` 
        : `What is the support and maintenance offered by ${projectForm.company_name}?`,
      source: "manual",
      category: "Informational",
    };
    const updated = [...questions, newQ];
    setQuestions(updated);
    if (projectId) {
      await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          questions: updated.map((q) => ({ text: q.text.trim(), source: q.source })),
        }),
      });
      showAutosaveStatusFeedback();
    }
  };

  const handleRemoveQuestion = async (idx: number) => {
    if (questions.length <= 1) {
      triggerNotification(
        lang === "es" 
          ? "Debes mantener al menos una pregunta para auditar" 
          : "You must keep at least one question to audit", 
        "error"
      );
      return;
    }
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    if (projectId) {
      await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          questions: updated.map((q) => ({ text: q.text.trim(), source: q.source })),
        }),
      });
      showAutosaveStatusFeedback();
    }
  };

  const handleRegenerateQuestions = async () => {
    if (!projectId) return;
    setAuditLoading(true);
    triggerNotification("Generando preguntas de intención por IA...", "info");
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": geminiKey.trim(),
          "x-openai-key": openaiKey.trim(),
          "x-perplexity-key": perplexityKey.trim(),
        },
        body: JSON.stringify({ projectId, lang, provider: generationEngine }),
      });
      const data = await res.json();
      if (!res.ok || !data.questions || data.questions.length === 0) {
        throw new Error(data?.error || "La generación de preguntas no devolvió resultados.");
      }
      
      const mappedQuestions = data.questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        source: q.source,
        category: getCategoryBadge(q.text),
      }));

      setQuestions(mappedQuestions);
      triggerNotification(
        lang === "es" 
          ? "Preguntas de compra generadas exitosamente." 
          : "Buyer intent questions generated successfully."
      );
    } catch (e: any) {
      console.error("AI Question generation failed, using fallbacks:", e);
      const fallbacks = getFallbackQuestions(projectForm.company_name || (lang === "es" ? "la empresa" : "the company"));
      setQuestions(fallbacks);
      triggerNotification(
        lang === "es" 
          ? `Error al generar preguntas con IA (${e.message || e}). Se cargaron preguntas locales.` 
          : `Error generating questions with AI (${e.message || e}). Local template questions loaded.`, 
        "error"
      );
      
      try {
        await fetch("/api/questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            questions: fallbacks.map(q => ({ text: q.text, source: q.source }))
          })
        });
        
        const qRes = await fetch(`/api/questions?projectId=${projectId}`);
        const qData = await qRes.json();
        if (qData.questions) {
          setQuestions(qData.questions.map((q: any) => ({
            id: q.id,
            text: q.text,
            source: q.source,
            category: getCategoryBadge(q.text),
          })));
        }
      } catch (innerError: any) {
        console.error("Fallback questions save/load failed:", innerError);
      }
    } finally {
      setAuditLoading(false);
    }
  };

  const handleContinueStep2 = async () => {
    if (!projectId) return;
    setAuditLoading(true);
    try {
      const res = await fetch("/api/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          questions: questions.map((q) => ({ text: q.text.trim(), source: q.source })),
        }),
      });
      if (!res.ok) throw new Error(lang === "es" ? "Error al guardar preguntas" : "Error saving questions");
      
      const qRes = await fetch(`/api/questions?projectId=${projectId}`);
      const qData = await qRes.json();
      if (qData.questions) {
        setQuestions(qData.questions.map((q: any) => ({
          id: q.id,
          text: q.text,
          source: q.source,
          category: getCategoryBadge(q.text),
        })));
      }
      
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, current_step: 3 }),
      });
      setStep(3);
    } catch (e: any) {
      triggerNotification(e.message, "error");
    } finally {
      setAuditLoading(false);
    }
  };

  // --- Step 2 Preview Actions ---
  const handleRunPreview = async () => {
    if (!projectId || !previewQuestion) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResponse(null);

    try {
      const response = await fetch("/api/audit/single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-perplexity-key": perplexityKey.trim(),
          "x-openai-key": openaiKey.trim(),
          "x-gemini-key": geminiKey.trim(),
        },
        body: JSON.stringify({
          projectId,
          questionId: previewQuestion.id,
          provider: previewEngine,
          preview: true,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPreviewResponse(data);
      } else {
        throw new Error(data.error || (lang === "es" ? "Fallo al obtener respuesta de la IA" : "Failed to retrieve AI response"));
      }
    } catch (e: any) {
      setPreviewError(e.message || String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  // --- Step 3: Actions ---

  const handleStartAudit = async () => {
    if (!projectId) return;
    
    setStep(4);
    setAuditLoading(true);
    setProgress(0);
    setAuditLogs([lang === "es" ? "Inicializando auditoría..." : "Initializing audit..."]);
    
    // Construct flat initialStates for all selected providers
    const initialStates = selectedProviders.flatMap((prov) =>
      questions.map((q) => ({
        id: `${prov}_${q.id}`,
        questionId: q.id || "",
        text: `${
          prov === "perplexity" ? "Perplexity" :
          prov === "openai" ? "OpenAI Search" :
          prov === "gemini" ? "Google Gemini" :
          (lang === "es" ? "Simulado" : "Mock")
        } | ${q.text}`,
        originalText: q.text,
        provider: prov,
        status: "pending" as const,
        citations: [],
        answer: "",
        appeared: false,
      }))
    );
    setQuestionStates(initialStates);
    
    const runIds: string[] = [];
    let totalTasksCompleted = 0;
    
    // Run audits sequentially for each chosen provider
    for (const prov of selectedProviders) {
      const provLabel =
        prov === "perplexity" ? "Perplexity" :
        prov === "openai" ? "OpenAI Search" :
        prov === "gemini" ? "Google Gemini" :
        (lang === "es" ? "Datos Simulados" : "Mock Data");
      setAuditLogs(prev => [...prev, lang === "es" ? `[${provLabel}] Inicializando motor...` : `[${provLabel}] Initializing engine...`]);
      
      let initializedRunId = "";
      try {
        const initRes = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, provider: prov }),
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData.error || (lang === "es" ? "No se pudo iniciar el proceso" : "Could not start the process"));
        
        initializedRunId = initData.runId;
        runIds.push(initializedRunId);
        setAuditLogs(prev => [...prev, lang === "es" ? `[${provLabel}] Auditoría iniciada (Run ID: ${initializedRunId})` : `[${provLabel}] Audit started (Run ID: ${initializedRunId})`]);
      } catch (e: any) {
        setAuditLogs(prev => [...prev, `❌ [${provLabel}] ${lang === "es" ? "Error de inicio" : "Start error"}: ${e.message}`]);
        triggerNotification(e.message, "error");
        setAuditLoading(false);
        setStep(3);
        return;
      }
      
      let successCount = 0;
      // Loop over the questions for the current provider
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        // Find index of this question state in the flat initialStates list
        const stateIdx = initialStates.findIndex(state => state.provider === prov && state.questionId === q.id);
        
        if (stateIdx !== -1) {
          setQuestionStates(prev => {
            const copy = [...prev];
            copy[stateIdx].status = "auditing";
            return copy;
          });
        }
        
        setAuditLogs(prev => [
          ...prev, 
          lang === "es" 
            ? `[${provLabel}] Analizando pregunta ${i + 1}/${questions.length}: "${q.text}"...` 
            : `[${provLabel}] Analyzing query ${i + 1}/${questions.length}: "${q.text}"...`
        ]);
        
        try {
          const response = await fetch("/api/audit/single", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-perplexity-key": perplexityKey.trim(),
              "x-openai-key": openaiKey.trim(),
              "x-gemini-key": geminiKey.trim(),
            },
            body: JSON.stringify({
              projectId,
              runId: initializedRunId,
              questionId: q.id,
              provider: prov,
            }),
          });
          
          const resData = await response.json();
          
          if (response.ok && resData.success) {
            successCount++;
            if (stateIdx !== -1) {
              setQuestionStates(prev => {
                const copy = [...prev];
                copy[stateIdx].status = "completed";
                copy[stateIdx].answer = resData.answer;
                copy[stateIdx].citations = resData.citations;
                copy[stateIdx].appeared = resData.citations.some((c: any) => c.classification === "target");
                return copy;
              });
            }
            const hasTarget = resData.citations.some((c: any) => c.classification === "target");
            setAuditLogs(prev => [
              ...prev, 
              lang === "es" 
                ? `✓ [${provLabel}] Pregunta ${i + 1} completada. Encontrado: ${hasTarget ? "SÍ" : "NO"}` 
                : `✓ [${provLabel}] Question ${i + 1} completed. Found: ${hasTarget ? "YES" : "NO"}`
            ]);
          } else {
            throw new Error(resData.error || (lang === "es" ? "Respuesta fallida" : "Failed response"));
          }
        } catch (err: any) {
          console.error(`Error on provider ${prov} question ${i + 1}:`, err);
          if (stateIdx !== -1) {
            setQuestionStates(prev => {
              const copy = [...prev];
              copy[stateIdx].status = "failed";
              return copy;
            });
          }
          setAuditLogs(prev => [...prev, `❌ [${provLabel}] ${lang === "es" ? "Error en pregunta" : "Error in question"} ${i + 1}: ${err.message || err}`]);
        }
        
        totalTasksCompleted++;
        setProgress(Math.round((totalTasksCompleted / initialStates.length) * 100));
      }
      
      const finalStatus = successCount > 0 ? "completed" : "failed";
      try {
        await fetch("/api/audit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: initializedRunId, status: finalStatus }),
        });
        setAuditLogs(prev => [...prev, `[${provLabel}] ${lang === "es" ? "Auditoría finalizada con estado" : "Audit finalized with status"}: ${finalStatus.toUpperCase()}`]);
      } catch (e) {
        console.error("Failed to finalize run status:", e);
      }
    }
    
    const joinedRunIds = runIds.join(",");
    setRunId(joinedRunIds);
    
    try {
      setAuditLogs(prev => [...prev, lang === "es" ? "Compilando reporte general..." : "Compiling general report..."]);
      const reportRes = await fetch(`/api/dashboard?runId=${joinedRunIds}`);
      const reportJson = await reportRes.json();
      if (!reportRes.ok) throw new Error(reportJson.error || (lang === "es" ? "Fallo en reporte" : "Report failed"));
      
      setReportData(reportJson);
      loadHistory();
      
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, current_step: 5 }),
      });
      
      setTimeout(() => {
        setAuditLoading(false);
        setStep(5);
      }, 800);
    } catch (e: any) {
      triggerNotification((lang === "es" ? "Error al cargar el reporte final: " : "Error loading final report: ") + e.message, "error");
      setAuditLoading(false);
    }
  };

  // --- Step 5: Actions ---

  const handleExportReport = () => {
    if (!reportData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AI_Visibility_Audit_Report_${projectForm.company_name.replace(/\s+/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerNotification(lang === "es" ? "Reporte exportado como JSON exitosamente" : "Report exported to JSON successfully");
  };

  const handleSaveAudit = () => {
    triggerNotification(lang === "es" ? "Auditoría guardada permanentemente en el historial" : "Audit saved permanently to history");
  };

  const handleStartNewAudit = () => {
    localStorage.removeItem("current_project_id");
    localStorage.removeItem("project_form_draft");
    setProjectId(null);
    setRunId(null);
    setReportData(null);
    setQuestions([]);
    setQuestionStates([]);
    setIsConfirmed(false);
    setProjectForm({
      company_name: "",
      domain: "",
      description: "",
      industry: "",
      target_market: "",
      competitors: "",
    });
    setCompetitorInput("");
    setStep1SubStep(1);
    setCategoryFilter("Todos");
    setReportTab("overview");
    setComparisonQuestionIdx(0);
    setAutosaveStatus(null);
    setSelectedProviders(["mock"]);
    setSelectedEngine("all");
    setSelectedQuestionIdx(0);
    setAuditLoading(false);
    setAuditLogs([]);
    setProgress(0);
    setRawResponseModal(null);
    setStep(1);
    setActiveTab("new-audit");

    // Clear URL search params to prevent auto-loading of draft
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("projectId");
      window.history.pushState({}, "", url.toString());
    }

    triggerNotification(
      lang === "es"
        ? "Campos limpiados. Iniciando nueva auditoría en el punto cero."
        : "Fields cleared. Starting new audit at point zero.",
      "info"
    );
  };

  // Sidebar past run loader
  const handleLoadPastRun = async (pastRunId: string) => {
    setAuditLoading(true);
    setActiveTab("new-audit");
    triggerNotification(lang === "es" ? "Cargando reporte histórico..." : "Loading historical report...", "info");
    try {
      const res = await fetch(`/api/dashboard?runId=${pastRunId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (lang === "es" ? "Error al cargar" : "Error loading"));
      
      setProjectId(data.project.id);
      setRunId(data.run.id);
      setProjectForm({
        company_name: data.project.company_name,
        domain: data.project.domain,
        description: data.project.description || "",
        industry: data.project.industry || "",
        target_market: data.project.target_market || "",
        competitors: data.project.competitors ? data.project.competitors.join(", ") : "",
      });
      setReportData(data);
      setSelectedEngine("all");
      setStep(5);
    } catch (e: any) {
      triggerNotification(e.message, "error");
    } finally {
      setAuditLoading(false);
    }
  };

  // Sidebar project loader
  const handleLoadPastProject = async (proj: any) => {
    setProjectId(proj.id);
    setProjectForm({
      company_name: proj.company_name,
      domain: proj.domain,
      description: proj.description || "",
      industry: proj.industry || "",
      target_market: proj.target_market || "",
      competitors: proj.competitors ? proj.competitors.join(", ") : "",
    });
    
    localStorage.setItem("current_project_id", proj.id);
    
    setAuditLoading(true);
    setActiveTab("new-audit");
    try {
      const res = await fetch(`/api/questions?projectId=${proj.id}`);
      const qData = await res.json();
      if (qData.questions) {
        setQuestions(qData.questions.map((q: any) => ({
          id: q.id,
          text: q.text,
          source: q.source,
          category: getCategoryBadge(q.text)
        })));
      }
      
      const targetStep = proj.current_step || 2;
      setStep(targetStep);
      triggerNotification(lang === "es" ? `Proyecto ${proj.company_name} cargado en Paso ${targetStep}` : `Project ${proj.company_name} loaded at Step ${targetStep}`);
    } catch (e: any) {
      triggerNotification(e.message || (lang === "es" ? "Error al cargar" : "Error loading"), "error");
    } finally {
      setAuditLoading(false);
    }
  };

  // Stepper badge styling helpers
  const getStepClass = (s: number) => {
    if (step === s) return "bg-[#D4A017] text-black font-extrabold shadow-[0_0_10px_rgba(212,160,23,0.5)] border-[#D4A017]";
    if (step > s) return "bg-success-custom/20 border-success-custom text-success-custom font-semibold";
    return "bg-slate-900 border-white/5 text-gray-500";
  };

  const getEngineSimulatedData = (engine: "perplexity" | "openai" | "gemini", questionText: string, defaultAnswer: string) => {
    const company = projectForm.company_name || "Tu Marca";
    const domain = projectForm.domain || "tudominio.com";
    const industry = projectForm.industry || "B2B";
    
    // If this engine was the one used in the run, return the real result!
    if (reportData?.metrics?.questionsDetail) {
      const matchingQ = reportData.metrics.questionsDetail.find((q: any) => q.questionText === questionText && q.provider === engine);
      if (matchingQ && matchingQ.answer) {
        return {
          answer: matchingQ.answer,
          sov: reportData.metrics.shareOfVoice,
          citations: matchingQ.citations?.map((c: any) => c.domain) || [],
          advice: lang === "es" 
            ? "Métricas y citas reales extraídas de la ejecución en vivo." 
            : "Real metrics and citations extracted from live execution."
        };
      }
    }

    // Otherwise, return simulated response for comparison!
    if (engine === "perplexity") {
      return {
        answer: lang === "es"
          ? `Al evaluar "${questionText}", las búsquedas de Perplexity citan que **${company}** (${domain}) ofrece soluciones en ${industry}, pero portales técnicos como G2 y Capterra señalan que competidores alternativos tienen mayor volumen de reseñas y menciones en comparativas directas de productos.`
          : `When evaluating "${questionText}", Perplexity searches cite that **${company}** (${domain}) offers solutions in ${industry}, but technical portals like G2 and Capterra note that alternative competitors have a higher volume of reviews and mentions in direct product comparisons.`,
        sov: Math.round((reportData?.metrics?.shareOfVoice || 40) * 0.9),
        citations: [domain, "kaeser.com", "ingersollrand.com", "g2.com"],
        advice: lang === "es"
          ? "Perplexity prioriza sitios de reseñas estructuradas (G2, Capterra) y comparativas técnicas directas. Incrementa tu presencia en directorios y crea páginas comparativas tipo 'Marca vs Competidor' en tu sitio."
          : "Perplexity prioritizes structured review sites (G2, Capterra) and direct technical comparisons. Increase your directory presence and create 'Brand vs Competitor' comparison pages on your website."
      };
    } else if (engine === "openai") {
      return {
        answer: lang === "es"
          ? `Las consultas en ChatGPT Search para "${questionText}" asocian a **${company}** con herramientas especializadas en la industria. Las respuestas redactadas sintetizan información de su web oficial, aunque competidores líderes del sector son citados con más frecuencia debido a su cobertura en artículos de prensa y documentación técnica.`
          : `Queries in ChatGPT Search for "${questionText}" associate **${company}** with specialized industry tools. Synthesized responses draw info from its official website, though leading sector competitors are cited more frequently due to their coverage in press releases and technical docs.`,
        sov: Math.round((reportData?.metrics?.shareOfVoice || 40) * 0.8),
        citations: [domain, "sullair.com", "atlascopco.com", "wikipedia.org"],
        advice: lang === "es"
          ? "OpenAI Search valora el contenido editorial y los artículos periodísticos/noticiosos de alta autoridad. Genera notas de prensa en portales del sector y publica documentación técnica completa y accesible."
          : "OpenAI Search values editorial content and high-authority news/press articles. Publish press releases in industry portals and make comprehensive technical documentation publicly accessible."
      };
    } else {
      return {
        answer: lang === "es"
          ? `Google Gemini para "${questionText}" destaca la presencia comercial de **${company}**, apoyándose en su Knowledge Graph y fichas locales. El modelo de IA destaca que es una opción robusta para compradores en ${industry}, pero recomienda contrastar especificaciones con competidores citados en directorios especializados.`
          : `Google Gemini for "${questionText}" highlights **${company}**'s commercial presence, leveraging its Knowledge Graph and local listings. The AI model notes it is a robust option for buyers in ${industry}, but recommends comparing specs with competitors cited in specialized directories.`,
        sov: Math.round((reportData?.metrics?.shareOfVoice || 40) * 1.1) > 100 ? 100 : Math.round((reportData?.metrics?.shareOfVoice || 40) * 1.1),
        citations: [domain, "google.com/maps", "thomasnet.com", "industry-update.com"],
        advice: lang === "es"
          ? "Gemini está profundamente conectado al Google Knowledge Graph y listados locales. Asegúrate de tener el perfil de Google Business optimizado, marcado de datos estructurados (Schema.org) en tu web y citas en directorios empresariales de alta autoridad."
          : "Gemini is deeply connected to the Google Knowledge Graph and local listings. Ensure you have an optimized Google Business profile, structured data markup (Schema.org) on your site, and citations in high-authority business directories."
      };
    }
  };

  const isSubStep1Valid = projectForm.company_name.trim().length > 0 &&
                          projectForm.domain.trim().length > 0;
  const isSubStep2Valid = projectForm.description.trim().length > 0;
  const isSubStep3Valid = projectForm.competitors.trim().length > 0;

  const isStep1Valid = isSubStep1Valid && isSubStep2Valid;
  
  let step1ValidationWarning = "";
  if (step1SubStep === 1 && !isSubStep1Valid) {
    const missingFields = [];
    if (!projectForm.company_name.trim()) missingFields.push(t.fieldNameCompany);
    if (!projectForm.domain.trim()) missingFields.push(t.fieldNameDomain);
    step1ValidationWarning = `${t.validationMissingFields}${missingFields.join(", ")}`;
  } else if (step1SubStep === 2 && !isSubStep2Valid) {
    step1ValidationWarning = t.validationMissingDesc;
  }

  const isStep2Valid = questions.length > 0 && questions.every(q => q.text.trim().length > 0);
  let step2ValidationWarning = "";
  if (!isStep2Valid) {
    if (questions.length === 0) {
      step2ValidationWarning = t.validationMinQuestions;
    } else {
      step2ValidationWarning = t.validationEmptyQuestions;
    }
  }

  // Reconstruct responses and unique providers from reportData
  const originalResponses = reportData?.metrics?.questionsDetail?.map((q: any) => ({
    question_id: q.questionId,
    question_text: q.questionText,
    answer: q.answer,
    provider: q.provider,
    citations: q.citations,
  })) || [];

  const uniqueProviders = Array.from(new Set(originalResponses.map((r: any) => r.provider).filter(Boolean))) as string[];

  // Dynamically calculate metrics for rendering Step 5 panels
  const activeReportData = !reportData
    ? null
    : {
        ...reportData,
        metrics: selectedEngine === "all"
          ? reportData.metrics
          : calculateDashboardMetrics(
              { run: reportData.run, responses: originalResponses.filter((r: any) => r.provider === selectedEngine) },
              projectForm.domain,
              projectForm.competitors ? projectForm.competitors.split(",").map((c: any) => c.trim()).filter((c: any) => c.length > 0) : []
            )
      };

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-[#05080F] text-gray-100 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="w-6 h-6 animate-spin text-gold-custom" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">{lang === "es" ? "Iniciando Consola de Inteligencia..." : "Initializing Intelligence Console..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-gray-100 overflow-hidden font-sans">
      {/* Sidebar navigation on the left - Hidden in Focus Mode for new audits */}
      {activeTab !== "new-audit" && (
        <aside className="w-64 shrink-0 bg-bg-secondary border-r border-border-custom flex flex-col justify-between p-5 select-none animate-fade-in">
        <div className="space-y-8">
          {/* Logo container */}
          <div className="flex items-center gap-2.5 px-1 py-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-gold-custom to-amber-600 flex items-center justify-center shadow-lg shadow-amber-955/40">
              <Sparkles className="w-4.5 h-4.5 text-black" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block text-white leading-none">
                AI VISIBILITY
              </span>
              <span className="text-[9px] uppercase tracking-widest text-gold-custom font-bold">
                Audit Console
              </span>
            </div>
          </div>

          {/* Nav buttons */}
          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab("new-audit"); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                (activeTab as string) === "new-audit"
                  ? "bg-gold-custom/10 text-gold-custom border-l-2 border-gold-custom font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>{t.tabNewAudit}</span>
            </button>

            <button
              onClick={() => { setActiveTab("projects"); loadProjects(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "projects"
                  ? "bg-gold-custom/10 text-gold-custom border-l-2 border-gold-custom font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>{t.tabProjects}</span>
            </button>

            <button
              onClick={() => { setActiveTab("history"); loadHistory(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-gold-custom/10 text-gold-custom border-l-2 border-gold-custom font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <HistoryIcon className="w-4 h-4 shrink-0" />
              <span>{t.tabHistory}</span>
            </button>

            <button
              onClick={() => { setActiveTab("settings"); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "bg-gold-custom/10 text-gold-custom border-l-2 border-gold-custom font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>{t.tabSettings}</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Help and system indicators */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setActiveTab("help")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === "help"
                ? "bg-gold-custom/10 text-gold-custom font-bold"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{t.tabHelp}</span>
          </button>
          
          {/* Language Selector Toggle */}
          <button
            onClick={() => {
              const nextLang = lang === "es" ? "en" : "es";
              setLang(nextLang);
              localStorage.setItem("preferred_lang", nextLang);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase text-gold-custom hover:text-white bg-gold-custom/10 hover:bg-gold-custom/20 border border-gold-custom/20 transition-all cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            <span>{lang === "es" ? "English (EN)" : "Español (ES)"}</span>
          </button>

          <div className="bg-black/30 border border-white/5 p-3 rounded-lg text-[10px] font-mono space-y-1 text-gray-500">
            <span className="block text-gray-400 font-bold uppercase tracking-wider mb-1">{t.connectionLocal}</span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success-custom shrink-0" />
              <span>{t.sqliteDbActive}</span>
            </div>
            <span className="block text-[9px]">v1.0.0-Bloomberg-Ed</span>
          </div>
        </div>
      </aside>
      )}

      {/* Main workspace area */}
      <section className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Focus Mode Header */}
        {activeTab === "new-audit" && (
          <header className="flex justify-between items-center px-8 py-4 border-b border-border-custom bg-bg-secondary/60 backdrop-blur-md sticky top-0 z-30 select-none">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-gold-custom to-amber-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-black" />
              </div>
              <div>
                <span className="font-extrabold text-xs tracking-tight block text-white leading-none">
                  AI VISIBILITY
                </span>
                <span className="text-[8px] uppercase tracking-widest text-gold-custom font-bold">
                  Audit Console
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Language Selector Toggle */}
              <button
                onClick={() => {
                  const nextLang = lang === "es" ? "en" : "es";
                  setLang(nextLang);
                  localStorage.setItem("preferred_lang", nextLang);
                }}
                className="text-[10px] font-mono font-bold tracking-widest text-gold-custom hover:text-white bg-gold-custom/10 hover:bg-gold-custom/25 px-2.5 py-1.5 rounded-lg border border-gold-custom/25 transition-all cursor-pointer"
                title="Switch Language / Cambiar Idioma"
              >
                {lang === "es" ? "EN" : "ES"}
              </button>

              <button
                onClick={() => {
                  setActiveTab("projects");
                  loadProjects();
                }}
                className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>{t.exitToDashboard}</span>
              </button>
            </div>
          </header>
        )}

        {/* Notification UI banner */}
        {notification && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border ${
              notification.type === "success"
                ? "bg-emerald-955 border-success-custom text-emerald-200"
                : notification.type === "info"
                ? "bg-cyan-955 border-info-custom text-cyan-200"
                : "bg-red-955 border-error-custom text-red-200"
            }`}>
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-success-custom" />
              ) : notification.type === "info" ? (
                <Info className="w-4 h-4 text-info-custom" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-error-custom" />
              )}
              <span>{notification.text}</span>
            </div>
          </div>
        )}

        {/* Active tab routing views */}
        {activeTab !== "new-audit" ? (
          <div className="max-w-[1600px] w-full mx-auto px-6 py-12 space-y-6">
            {/* View: Settings */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{t.settingsTitle}</h1>
                  <p className="text-xs text-gray-400">{t.settingsDesc}</p>
                </div>
                
                <div className="bg-card-bg border border-border-custom rounded-xl p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Perplexity API Key
                    </label>
                    <input
                      type="password"
                      value={perplexityKey}
                      onChange={(e) => setPerplexityKey(e.target.value)}
                      placeholder="pplx-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="block w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gold-custom text-xs font-mono"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      {t.perplexityKeySub}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="block w-full px-3.5 py-2.5 bg-slate-955 border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gold-custom text-xs font-mono"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      {lang === "es" ? "Clave de API de OpenAI (requerida para usar OpenAI Search)." : "OpenAI API Key (required to use OpenAI Search)."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="block w-full px-3.5 py-2.5 bg-slate-955 border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gold-custom text-xs font-mono"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      {t.geminiKeySub}
                    </p>
                  </div>

                  <button
                    onClick={saveSettings}
                    className="flex items-center gap-2 bg-gold-custom hover:bg-gold-hover text-black font-bold px-4 py-2 rounded-lg text-xs tracking-wider uppercase cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t.btnSaveCredentials}</span>
                  </button>
                </div>
              </div>
            )}

            {/* View: Projects list */}
            {activeTab === "projects" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{t.projectsTitle}</h1>
                  <p className="text-xs text-gray-400">{t.projectsDesc}</p>
                </div>

                {projectsList.length === 0 ? (
                  <div className="border border-dashed border-white/5 rounded-xl p-12 text-center text-gray-500 text-xs">
                    {t.noProjectsRegistered}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projectsList.map((proj) => (
                      <div
                        key={proj.id}
                        onClick={() => handleLoadPastProject(proj)}
                        className="bg-card-bg border border-border-custom hover:border-gold-custom/40 p-5 rounded-xl flex flex-col justify-between gap-4 transition-all cursor-pointer group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-start gap-2">
                            <h2 className="text-base font-bold text-gray-200 group-hover:text-gold-custom transition-colors">{proj.company_name}</h2>
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-gray-500" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(proj.id);
                                }}
                                className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                                title={lang === "es" ? "Eliminar Proyecto" : "Delete Project"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 block font-mono">{proj.domain}</span>
                          <p className="text-xs text-gray-400 line-clamp-2">{proj.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[10px] text-gray-500">
                          <span>{t.createdLabel}: {new Date(proj.created_at).toLocaleDateString()}</span>
                          <span className="text-gold-custom font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            {t.loadLabel} <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* View: Audit history list */}
            {activeTab === "history" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{t.historyTitle}</h1>
                  <p className="text-xs text-gray-400">{t.historyDesc}</p>
                </div>

                {historyList.length === 0 ? (
                  <div className="border border-dashed border-white/5 rounded-xl p-12 text-center text-gray-500 text-xs">
                    {t.noAuditsRegistered}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyList.map((run) => (
                      <div
                        key={run.id}
                        className="bg-card-bg border border-border-custom p-4 rounded-xl flex items-center justify-between gap-6 hover:border-white/10 transition-all text-xs"
                      >
                        <div className="space-y-1">
                          <h2 className="text-sm font-bold text-gray-200">{run.company_name}</h2>
                          <span className="text-[10px] text-gray-500 font-mono block">{run.domain}</span>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">{t.providerLabel}</span>
                            <span className="text-[11px] text-gray-200 capitalize font-medium">{run.provider}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">{t.dateLabel}</span>
                            <span className="text-[11px] text-gray-200 font-mono">{new Date(run.created_at).toLocaleDateString()}</span>
                          </div>

                          <button
                            onClick={() => handleLoadPastRun(run.id)}
                            className="flex items-center gap-1 bg-white/5 hover:bg-gold-custom/10 text-gold-custom border border-gold-custom/20 hover:border-gold-custom/50 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t.viewReportLabel}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* View: Help */}
            {activeTab === "help" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{t.helpTitle}</h1>
                  <p className="text-xs text-gray-400">{t.helpDesc}</p>
                </div>
                
                <div className="bg-card-bg border border-border-custom rounded-xl p-6 space-y-4 text-xs leading-relaxed text-gray-300 font-normal">
                  <h2 className="text-sm font-bold text-gray-100 uppercase tracking-wider mb-2">{t.helpConceptHeader}</h2>
                  <p>
                    {t.helpConceptText1}
                  </p>
                  <p>
                    {t.helpConceptText2}
                  </p>
                  <h2 className="text-sm font-bold text-gray-100 uppercase tracking-wider mt-4 mb-2">{t.helpStepsHeader}</h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>{t.helpStep1Title}:</strong> {t.helpStep1Text}</li>
                    <li><strong>{t.helpStep2Title}:</strong> {t.helpStep2Text}</li>
                    <li><strong>{t.helpStep3Title}:</strong> {t.helpStep3Text}</li>
                    <li><strong>{t.helpStep4Title}:</strong> {t.helpStep4Text}</li>
                    <li><strong>{t.helpStep5Title}:</strong> {t.helpStep5Text}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Wizard Main Panel View (activeTab === "new-audit") */
          <div className="max-w-[1600px] w-full mx-auto px-6 py-10 flex-1 flex flex-col justify-start gap-10 self-center">
            {/* Stepper indicator at the top */}
            <div className="flex items-center justify-between pb-8 border-b border-white/5 select-none">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold-custom text-black text-xs font-bold shadow-md shadow-amber-955/10">
                  {step}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight leading-none">
                    {step === 1 && t.step1Title}
                    {step === 2 && t.step2Title}
                    {step === 3 && t.step3Title}
                    {step === 4 && t.step4Title}
                    {step === 5 && t.step5Title}
                  </h2>
                  
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[10px] text-gray-500 font-mono leading-none">
                      {step === 1 && t.step1Desc}
                      {step === 2 && t.step2Desc}
                      {step === 3 && t.step3Desc}
                      {step === 4 && t.step4Desc}
                      {step === 5 && t.step5Desc}
                    </p>

                    {/* Discreet Autosave Status indicator */}
                    {autosaveStatus === "saving" && (
                      <span className="text-[9px] text-gray-400 flex items-center gap-1 font-mono leading-none">
                        <RotateCw className="w-2.5 h-2.5 animate-spin text-gold-custom" /> Guardando...
                      </span>
                    )}
                    {autosaveStatus === "saved" && (
                      <span className="text-[9px] text-success-custom flex items-center gap-1 font-mono leading-none">
                        <span className="h-1 w-1 rounded-full bg-success-custom" /> Guardado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Steps connected by line - Clickable circles */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => {
                  const isClickable = s === 1 || 
                                      (s === 2 && projectId) || 
                                      (s === 3 && projectId && questions.length > 0) ||
                                      (s === 4 && projectId && runId) ||
                                      (s === 5 && projectId && reportData);
                  return (
                    <div key={s} className="flex items-center">
                      <button
                        onClick={() => handleGoToStep(s)}
                        disabled={!isClickable}
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] border transition-all ${getStepClass(s)} ${
                          isClickable ? "cursor-pointer hover:border-[#D4A017]/50" : "cursor-not-allowed opacity-50"
                        }`}
                        title={
                          s === 1 ? (lang === "es" ? "Setup Empresa" : "Company Setup") :
                          s === 2 ? (lang === "es" ? "Preguntas de Intención" : "Intent Questions") :
                          s === 3 ? (lang === "es" ? "Ejecutar Auditoría" : "Run Audit") :
                          s === 4 ? (lang === "es" ? "Extracción de Citas" : "Citation Extraction") :
                          (lang === "es" ? "Reporte Ejecutivo" : "Executive Report")
                        }
                      >
                        {s}
                      </button>
                      {s < 5 && <div className={`w-8 h-px transition-all duration-300 ${step > s ? 'bg-[#D4A017] shadow-[0_0_5px_rgba(212,160,23,0.3)]' : 'bg-white/5'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stepper Body Container */}
               {/* STEP 1: Tell us about the company */}
              {step === 1 && (
                <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
                  
                  {/* Left Column: Input Form (sub-steps) */}
                  <div className="lg:col-span-7 space-y-5">
                    
                    {/* Phase Mini-Stepper */}
                    <div className="flex items-center gap-3 select-none text-[10px] font-mono font-bold uppercase tracking-wider border-b border-white/5 pb-3">
                      <button 
                        type="button"
                        onClick={() => { if (isSubStep1Valid || step1SubStep > 1) setStep1SubStep(1); }}
                        disabled={step1SubStep === 1}
                        className={`flex items-center gap-1 transition-all duration-200 focus:outline-none ${
                          step1SubStep === 1 
                            ? "text-[#D4A017] font-extrabold border-b-2 border-[#D4A017] pb-0.5 shadow-[0_2px_0_0_#D4A017]" 
                            : isSubStep1Valid 
                            ? "text-success-custom font-bold hover:text-[#D4A017] cursor-pointer" 
                            : "text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {isSubStep1Valid && <span className="text-success-custom">✓</span>} {t.substep1}
                      </button>
                      <span className="text-gray-700">/</span>
                      <button 
                        type="button"
                        onClick={() => { if (isSubStep1Valid) setStep1SubStep(2); }}
                        disabled={step1SubStep === 2}
                        className={`flex items-center gap-1 transition-all duration-200 focus:outline-none ${
                          step1SubStep === 2 
                            ? "text-[#D4A017] font-extrabold border-b-2 border-[#D4A017] pb-0.5 shadow-[0_2px_0_0_#D4A017]" 
                            : isSubStep2Valid 
                            ? "text-success-custom font-bold hover:text-[#D4A017] cursor-pointer" 
                            : "text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {isSubStep2Valid && <span className="text-success-custom">✓</span>} {t.substep2}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <h1 className="text-lg font-bold text-white leading-tight">
                        {step1SubStep === 1 && t.step1Header1}
                        {step1SubStep === 2 && t.step1Header2}
                      </h1>
                      <p className="text-xs text-gray-400">
                        {step1SubStep === 1 && t.step1Desc1}
                        {step1SubStep === 2 && t.step1Desc2}
                      </p>
                    </div>

                    <div className="bg-card-bg border border-border-custom rounded-xl p-6 space-y-5 shadow-xl">
                      {/* SUB-STEP 1: Identidad */}
                      {step1SubStep === 1 && (
                        <div className="space-y-4 animate-fade-in">
                          {/* Company Name */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              {t.companyName}
                            </label>
                            <input
                              type="text"
                              value={projectForm.company_name}
                              onChange={(e) => setProjectForm({ ...projectForm, company_name: e.target.value })}
                              onBlur={() => { if (projectId) autosaveProjectDetails(projectForm); }}
                              placeholder={t.companyNamePlaceholder}
                              className="block w-full px-4 py-3 bg-slate-955 border border-white/10 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t.companyNameSub}</p>
                          </div>

                          {/* Website Domain */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              {t.domainLabel}
                            </label>
                            <input
                              type="text"
                              value={projectForm.domain}
                              onChange={(e) => setProjectForm({ ...projectForm, domain: e.target.value })}
                              onBlur={handleDomainBlur}
                              placeholder={t.domainPlaceholder}
                              className="block w-full px-4 py-3 bg-slate-955 border border-white/10 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t.domainSub}</p>
                          </div>
                        </div>
                      )}

                      {/* SUB-STEP 2: Posicionamiento */}
                      {step1SubStep === 2 && (
                        <div className="space-y-4 animate-fade-in">
                          {/* Company Description */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              {t.descriptionLabel}
                            </label>
                            <textarea
                              rows={3}
                              value={projectForm.description}
                              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                              onBlur={() => { if (projectId) autosaveProjectDetails(projectForm); }}
                              placeholder={t.descriptionPlaceholder}
                              className="block w-full px-4 py-3 bg-slate-955 border border-white/10 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-all resize-none font-normal leading-relaxed"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t.descriptionSub}</p>
                          </div>

                          {/* Optional Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                {t.industryLabel}
                              </label>
                              <input
                                type="text"
                                value={projectForm.industry}
                                onChange={(e) => setProjectForm({ ...projectForm, industry: e.target.value })}
                                onBlur={() => { if (projectId) autosaveProjectDetails(projectForm); }}
                                placeholder={t.industryPlaceholder}
                                className="block w-full px-3.5 py-2.5 bg-slate-955 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-755 focus:outline-none focus:ring-1 focus:ring-gold-custom"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                {t.targetMarketLabel}
                              </label>
                              <input
                                type="text"
                                value={projectForm.target_market}
                                onChange={(e) => setProjectForm({ ...projectForm, target_market: e.target.value })}
                                onBlur={() => { if (projectId) autosaveProjectDetails(projectForm); }}
                                placeholder={t.targetMarketPlaceholder}
                                className="block w-full px-3.5 py-2.5 bg-slate-955 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-gold-custom"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 1 Live Validation warning display */}
                    {step1ValidationWarning && (
                      <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/25 px-3 py-2 rounded-lg">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{step1ValidationWarning}</span>
                      </div>
                    )}

                    {/* Actions Sub-Steps */}
                    <div className="flex justify-between items-center pt-2">
                      {step1SubStep > 1 ? (
                        <button
                          type="button"
                          onClick={() => setStep1SubStep((prev) => (prev - 1) as any)}
                          disabled={auditLoading}
                          className="px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {t.btnBack}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveDraftStep1}
                          disabled={auditLoading}
                          className="px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wider uppercase text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {t.btnSaveDraft}
                        </button>
                      )}

                      {step1SubStep < 2 ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (step1SubStep === 1 && !isSubStep1Valid) return;
                            setStep1SubStep(2);
                          }}
                          disabled={step1SubStep === 1 && !isSubStep1Valid}
                          className={
                            (step1SubStep === 1 && isSubStep1Valid)
                              ? "flex items-center gap-1.5 bg-[#D4A017] hover:bg-[#F5B942] text-black font-extrabold px-6 py-2.5 rounded-lg text-sm tracking-wider uppercase transition-all duration-300 transform scale-105 cursor-pointer shadow-lg shadow-gold-custom/40 border border-[#D4A017] gold-glow ring-2 ring-gold-custom/30 gold-pulse"
                              : "flex items-center gap-1.5 bg-white/5 text-gray-500 font-extrabold px-5 py-2.5 rounded-lg text-sm tracking-wider uppercase cursor-not-allowed opacity-40 border border-white/5"
                          }
                        >
                          <span>
                            {t.btnNextPos}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleContinueStep1}
                          disabled={auditLoading || !isStep1Valid}
                          className={
                            (isStep1Valid)
                              ? "flex items-center gap-1.5 bg-[#D4A017] hover:bg-[#F5B942] text-black font-extrabold px-6 py-2.5 rounded-lg text-sm tracking-wider uppercase transition-all duration-300 transform scale-105 cursor-pointer shadow-lg shadow-gold-custom/40 border border-[#D4A017] gold-glow ring-2 ring-gold-custom/30 gold-pulse"
                              : "flex items-center gap-1.5 bg-white/5 text-gray-500 font-extrabold px-5 py-2.5 rounded-lg text-sm tracking-wider uppercase cursor-not-allowed opacity-40 border border-white/5"
                          }
                        >
                          <span>{t.btnFinishSetup}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Live Brand Information Fact Sheet */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-bg-secondary border border-border-custom rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden select-none">
                      {/* Top Accent Line */}
                      <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-gold-custom/20 via-gold-custom to-gold-custom/20" />
                      
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono font-bold tracking-widest text-gold-custom uppercase block">
                            {t.factSheetTitle}
                          </span>
                          <span className="text-[8px] font-mono text-gray-500 uppercase block">
                            {t.factSheetReg}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-gold-custom/10 border border-gold-custom/20 px-2 py-0.5 rounded text-[8px] font-mono text-gold-custom">
                          <span className="h-1 w-1 rounded-full bg-gold-custom animate-pulse" />
                          <span>{t.inConfiguration}</span>
                        </div>
                      </div>

                      <div className="space-y-4 text-[10px] font-mono">
                        {/* Section 1: Identidad */}
                        <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          step1SubStep === 1 
                            ? "border-gold-custom/50 bg-gold-custom/[0.02] shadow-[0_0_15px_rgba(212,160,23,0.15)] scale-[1.01]" 
                            : "border-white/5 bg-transparent"
                        }`}>
                          <div className="bg-white/[0.02] border-b border-white/5 px-3 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px] flex items-center justify-between">
                            <span>{t.factSheetIdentity}</span>
                            {step1SubStep === 1 ? (
                              <span className="text-[7px] font-bold text-gold-custom border border-gold-custom/30 bg-gold-custom/10 px-1.5 py-0.2 rounded animate-pulse">{t.editing}</span>
                            ) : isSubStep1Valid ? (
                              <span className="text-[7px] font-bold text-success-custom border border-success-custom/30 bg-success-custom/10 px-1.5 py-0.2 rounded">{t.completed}</span>
                            ) : (
                              <span className="text-[7px] font-bold text-gray-500 border border-white/5 bg-white/5 px-1.5 py-0.2 rounded">{t.pending}</span>
                            )}
                          </div>
                          <div className="divide-y divide-white/5">
                            <div className="grid grid-cols-3 p-3 items-center">
                              <span className="text-gray-500 uppercase font-semibold">{t.companyName}</span>
                              <span className="col-span-2 text-white font-sans font-bold text-xs truncate">
                                {projectForm.company_name.trim() || <span className="text-gray-655 font-mono text-[10px] font-normal italic">{t.pendingRegister}</span>}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 p-3 items-center">
                              <span className="text-gray-500 uppercase font-semibold">{t.domainLabel}</span>
                              <span className="col-span-2 text-gold-custom font-bold truncate">
                                {projectForm.domain.trim() || <span className="text-gray-655 font-normal italic">{t.pendingRegister}</span>}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Posicionamiento */}
                        <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          step1SubStep === 2 
                            ? "border-gold-custom/50 bg-gold-custom/[0.02] shadow-[0_0_15px_rgba(212,160,23,0.15)] scale-[1.01]" 
                            : "border-white/5 bg-transparent"
                        }`}>
                          <div className="bg-white/[0.02] border-b border-white/5 px-3 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px] flex items-center justify-between">
                            <span>{t.factSheetPos}</span>
                            {step1SubStep === 2 ? (
                              <span className="text-[7px] font-bold text-gold-custom border border-gold-custom/30 bg-gold-custom/10 px-1.5 py-0.2 rounded animate-pulse">{t.editing}</span>
                            ) : isSubStep2Valid ? (
                              <span className="text-[7px] font-bold text-success-custom border border-success-custom/30 bg-success-custom/10 px-1.5 py-0.2 rounded">{t.completed}</span>
                            ) : (
                              <span className="text-[7px] font-bold text-gray-500 border border-white/5 bg-white/5 px-1.5 py-0.2 rounded">{t.pending}</span>
                            )}
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="space-y-1">
                              <span className="text-gray-500 uppercase font-semibold block">{t.factSheetDescTitle}</span>
                              <p className="text-gray-300 font-sans font-normal leading-relaxed text-xs whitespace-pre-wrap bg-black/30 p-2.5 rounded border border-white/5 min-h-[60px]">
                                {projectForm.description.trim() || <span className="text-gray-655 font-mono text-[10px] italic font-normal">{t.factSheetDescPend}</span>}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Mercado */}
                        <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          step1SubStep === 2 
                            ? "border-gold-custom/50 bg-gold-custom/[0.02] shadow-[0_0_15px_rgba(212,160,23,0.15)] scale-[1.01]" 
                            : "border-white/5 bg-transparent"
                        }`}>
                          <div className="bg-white/[0.02] border-b border-white/5 px-3 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px] flex items-center justify-between">
                            <span>{t.factSheetProfile}</span>
                            {step1SubStep === 2 ? (
                              <span className="text-[7px] font-bold text-gold-custom border border-gold-custom/30 bg-gold-custom/10 px-1.5 py-0.2 rounded animate-pulse">{t.editing}</span>
                            ) : (projectForm.industry.trim() || projectForm.target_market.trim()) ? (
                              <span className="text-[7px] font-bold text-success-custom border border-success-custom/30 bg-success-custom/10 px-1.5 py-0.2 rounded">{t.completed}</span>
                            ) : (
                              <span className="text-[7px] font-bold text-gray-500 border border-white/5 bg-white/5 px-1.5 py-0.2 rounded">{t.optional}</span>
                            )}
                          </div>
                          <div className="divide-y divide-white/5">
                            <div className="grid grid-cols-3 p-3 items-center">
                              <span className="text-gray-500 uppercase font-semibold">{t.factSheetIndustry}</span>
                              <span className="col-span-2 text-gray-200 font-sans font-semibold truncate">
                                {projectForm.industry.trim() || <span className="text-gray-655 font-mono text-[10px] font-normal italic">{t.pendingRegister}</span>}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 p-3 items-center">
                              <span className="text-gray-500 uppercase font-semibold">{t.factSheetMarket}</span>
                              <span className="col-span-2 text-gray-200 font-sans font-semibold truncate">
                                {projectForm.target_market.trim() || <span className="text-gray-655 font-mono text-[10px] font-normal italic">{t.pendingRegister}</span>}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Section 4: Competidores */}
                        <div className="border border-white/5 bg-transparent rounded-lg overflow-hidden transition-all duration-300">
                          <div className="bg-white/[0.02] border-b border-white/5 px-3 py-1.5 font-bold text-gray-400 uppercase tracking-wider text-[8px] flex items-center justify-between">
                            <span>{t.factSheetCompetitors}</span>
                            {isSubStep3Valid ? (
                              <span className="text-[7px] font-bold text-success-custom border border-success-custom/30 bg-success-custom/10 px-1.5 py-0.2 rounded">{t.completed}</span>
                            ) : (
                              <span className="text-[7px] font-bold text-gold-custom border border-gold-custom/30 bg-gold-custom/10 px-1.5 py-0.2 rounded animate-pulse">
                                {lang === "es" ? "AUTODETECCIÓN" : "AUTO-DISCOVERY"}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {projectForm.competitors && projectForm.competitors.split(",").map(c => c.trim()).filter(c => c.length > 0).length > 0 ? (
                                projectForm.competitors.split(",").map(c => c.trim()).filter(c => c.length > 0).map((comp, idx) => (
                                  <span key={idx} className="text-[8px] font-mono font-bold bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-warning-custom" />
                                    <span>{comp}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500 font-mono text-[9px] font-normal italic">
                                  {lang === "es" ? "Se identificarán automáticamente durante la auditoría." : "Will be automatically identified during the audit."}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Buyer Intent Questions */}
              {step === 2 && (
                <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in text-sm">
                  {/* Left Column: Questions List */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="space-y-1">
                      <h1 className="text-lg font-bold text-white uppercase tracking-wider">{t.step2Header}</h1>
                      <p className="text-xs text-gray-400">
                        {t.step2SubHeader}
                      </p>
                    </div>

                    {/* Category Filter Tabs & Count Indicator */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 select-none">
                      <div className="flex flex-wrap gap-1.5">
                        {(["Todos", "Informational", "Comparison", "Commercial", "High Intent"] as const).map((cat) => {
                          const active = categoryFilter === cat;
                          let catLabel = cat === "Todos" ? t.filterAll : cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => setCategoryFilter(cat)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                active
                                  ? "bg-gold-custom/10 text-gold-custom border-gold-custom/30 font-extrabold"
                                  : "bg-transparent text-gray-500 border-transparent hover:text-gray-305 hover:bg-white/5"
                              }`}
                            >
                              {catLabel}
                            </button>
                          );
                        })}
                      </div>
                      
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-widest font-bold">
                        {t.questionsShowingCount
                          .replace("{count}", String(questions.filter(q => categoryFilter === 'Todos' || q.category === categoryFilter).length))
                          .replace("{total}", String(questions.length))}
                      </span>
                    </div>

                    {auditLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <RotateCw className="w-8 h-8 text-gold-custom animate-spin" />
                        <span className="text-sm text-gray-400">{t.regenLoading}</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {questions.map((q, idx) => {
                          if (categoryFilter !== "Todos" && q.category !== categoryFilter) return null;

                          const badgeColors = {
                            Informational: "border-blue-500/25 bg-blue-500/10 text-blue-300",
                            Comparison: "border-teal-500/25 bg-teal-500/10 text-teal-300",
                            Commercial: "border-purple-500/25 bg-purple-500/10 text-purple-300",
                            "High Intent": "border-gold-custom/25 bg-gold-custom/10 text-gold-custom",
                          };

                          return (
                            <div
                              key={idx}
                              className="bg-card-bg border border-border-custom p-3.5 rounded-xl flex items-center justify-between gap-3 group animate-fade-in hover:border-white/10 transition-colors"
                            >
                              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                <span className="text-xs text-gray-500 font-mono w-5 select-none shrink-0 font-bold">
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                <input
                                  type="text"
                                  value={q.text}
                                  onChange={(e) => handleUpdateQuestionText(idx, e.target.value)}
                                  onBlur={() => { if (projectId) autosaveQuestions(); }}
                                  className="bg-transparent border-b border-transparent focus:border-gold-custom/30 text-sm font-semibold text-gray-200 placeholder-gray-755 focus:outline-none w-full py-0.5"
                                />
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <button
                                  onClick={() => {
                                    setPreviewQuestion({ ...q, index: idx });
                                    setPreviewResponse(null);
                                    setPreviewError(null);
                                    setPreviewEngine("perplexity");
                                  }}
                                  title={lang === "es" ? "Probar renderización con IA" : "Test IA rendering"}
                                  className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded border border-gold-custom/25 bg-gold-custom/5 text-gold-custom hover:bg-gold-custom hover:text-black transition-all cursor-pointer shadow-sm hover:shadow-gold-custom/10 active:scale-95"
                                >
                                  <Eye className="w-3 h-3 shrink-0" />
                                  <span>{lang === "es" ? "Probar" : "Preview"}</span>
                                </button>

                                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border select-none ${
                                  q.source === "generated" 
                                    ? "border-amber-500/20 bg-amber-500/5 text-amber-500/80" 
                                    : "border-gray-500/20 bg-gray-500/5 text-gray-400"
                                }`}>
                                  {q.source === "generated" ? (lang === "es" ? "IA" : "AI") : (lang === "es" ? "Manual" : "Manual")}
                                </span>

                                <button
                                  onClick={() => {
                                    const cats: ("Informational" | "Comparison" | "Commercial" | "High Intent")[] = [
                                      "Informational",
                                      "Comparison",
                                      "Commercial",
                                      "High Intent",
                                    ];
                                    const nextIdx = (cats.indexOf(q.category) + 1) % cats.length;
                                    handleUpdateQuestionCategory(idx, cats[nextIdx]);
                                  }}
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border select-none transition-all cursor-pointer hover:opacity-85 ${
                                    badgeColors[q.category] || "border-white/5 bg-white/5 text-gray-400"
                                  }`}
                                >
                                  {q.category === "Informational" ? t.categoryInformational :
                                   q.category === "Comparison" ? t.categoryComparison :
                                   q.category === "Commercial" ? t.categoryCommercial :
                                   t.categoryHighIntent}
                                </button>

                                <button
                                  onClick={() => handleRemoveQuestion(idx)}
                                  className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer opacity-30 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions and AI Generators Panel */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* Control Panel Card */}
                    <div className="bg-card-bg border border-border-custom rounded-xl p-5 space-y-4 shadow-xl">
                      <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest border-b border-white/5 pb-2">
                        {lang === "es" ? "Panel de Gestión" : "Management Panel"}
                      </h3>

                      {/* AI Generator Engine Selector */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-mono">
                            {lang === "es" ? "Motor Generador de IA" : "AI Generator Engine"}
                          </span>
                          <div className="relative">
                            <select
                              value={generationEngine}
                              onChange={(e) => setGenerationEngine(e.target.value)}
                              disabled={auditLoading}
                              className="w-full bg-slate-955 border border-white/10 hover:border-gold-custom/30 text-gray-200 text-xs rounded-lg pl-3 pr-8 py-2.5 outline-none focus:outline-none focus:border-gold-custom focus:ring-1 focus:ring-gold-custom transition-all cursor-pointer appearance-none font-mono"
                            >
                              <option value="gemini" className="bg-[#0b0f19] text-gray-200">
                                Google Gemini ({lang === "es" ? "Por defecto" : "Default"})
                              </option>
                              <option value="openai" className="bg-[#0b0f19] text-gray-200">
                                OpenAI (GPT-4o)
                              </option>
                              <option value="perplexity" className="bg-[#0b0f19] text-gray-200">
                                Perplexity (Sonar)
                              </option>
                              <option value="mock" className="bg-[#0b0f19] text-gray-200">
                                {lang === "es" ? "Plantilla Local (Simulado)" : "Local Template (Mock)"}
                              </option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>

                        {generationEngine !== "mock" && (
                          ((generationEngine === "gemini" && !geminiKey.trim()) ||
                           (generationEngine === "openai" && !openaiKey.trim()) ||
                           (generationEngine === "perplexity" && !perplexityKey.trim()))
                        ) && (
                          <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg leading-relaxed font-sans">
                            {lang === "es"
                              ? `Nota: No has configurado una API Key para ${generationEngine.toUpperCase()} en tus ajustes. Se usará la clave del servidor o las plantillas por defecto.`
                              : `Note: You haven't set a custom API Key for ${generationEngine.toUpperCase()} in settings. Server defaults or fallback templates will be used.`}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-mono">
                            {lang === "es" ? "Generar Preguntas" : "AI Question Assistant"}
                          </span>
                          <button
                            onClick={handleRegenerateQuestions}
                            disabled={auditLoading}
                            className="w-full flex items-center justify-center gap-1.5 text-sm text-gold-custom hover:text-gold-hover font-bold px-3 py-2.5 rounded-lg bg-gold-custom/10 border border-gold-custom/20 hover:bg-gold-custom/25 transition-all cursor-pointer disabled:opacity-40"
                          >
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            <span>{t.btnRegenIA}</span>
                          </button>
                        </div>
                      </div>

                      {/* Add Question Inline Form */}
                      <div className="space-y-1.5 pt-2.5 border-t border-white/5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-mono">
                          {lang === "es" ? "Agregar Nueva Pregunta" : "Add New Question"}
                        </span>
                        <button
                          onClick={handleAddQuestion}
                          disabled={auditLoading}
                          className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-300 hover:text-white font-semibold px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.btnAddQuestion}</span>
                        </button>
                      </div>

                      {/* Validation Warning */}
                      {!isStep2Valid && (
                        <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg leading-normal">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{step2ValidationWarning}</span>
                        </div>
                      )}
                    </div>

                    {/* Navigation Buttons Card */}
                    <div className="bg-card-bg border border-border-custom rounded-xl p-5 flex flex-col gap-2">
                      <button
                        onClick={handleContinueStep2}
                        disabled={!isStep2Valid}
                        className={isStep2Valid
                          ? "w-full flex items-center justify-center gap-1.5 bg-[#D4A017] hover:bg-[#F5B942] text-black font-extrabold py-2.5 rounded-lg text-sm tracking-wider uppercase transition-all duration-300 cursor-pointer shadow-lg shadow-gold-custom/30 border border-[#D4A017] gold-glow"
                          : "w-full flex items-center justify-center gap-1.5 bg-white/5 text-gray-500 font-extrabold py-2.5 rounded-lg text-sm tracking-wider uppercase cursor-not-allowed opacity-40 border border-white/5"
                        }
                      >
                        <span>{t.btnContinueStep2}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleGoToStep(1)}
                        className="w-full flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white font-semibold py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{t.btnBack}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Run Citation Audit */}
              {step === 3 && (
                <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-sm">
                  {/* Left Column: Project Profile Summary */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="space-y-1.5">
                      <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-gold-custom animate-pulse" />
                        <span>{t.step3Header}</span>
                      </h1>
                      <p className="text-xs text-gray-400 font-medium">
                        {t.step3SubHeader}
                      </p>
                    </div>

                    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-6 shadow-2xl relative overflow-hidden group">
                      {/* Top accent light */}
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold-custom/50 to-transparent" />
                      
                      <h3 className="text-xs font-black text-gray-400 font-mono uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-gold-custom animate-pulse" />
                        {t.projSummary}
                      </h3>
                      
                      <div className="space-y-4.5">
                        {/* Company Name */}
                        <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
                          <div className="p-2 rounded-lg bg-gold-custom/10 text-gold-custom mt-0.5 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-mono block uppercase tracking-wider">{t.summaryCompany}</span>
                            <span className="font-bold text-gray-100 text-sm block mt-0.5">{projectForm.company_name}</span>
                          </div>
                        </div>

                        {/* Domain */}
                        <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-mono block uppercase tracking-wider">{t.summaryDomain}</span>
                            <span className="font-mono font-bold text-emerald-400 text-xs block mt-0.5">{projectForm.domain}</span>
                          </div>
                        </div>

                        {/* Competitors */}
                        <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
                          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 mt-0.5 shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-gray-500 font-mono block uppercase tracking-wider mb-2">{t.summaryCompetitors}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {projectForm.competitors 
                                ? projectForm.competitors.split(",").map((c, i) => (
                                    <span key={i} className="text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 rounded-md">
                                      {c.trim()}
                                    </span>
                                  ))
                                : <span className="text-gray-550 italic text-xs">{t.summaryNone}</span>
                              }
                            </div>
                          </div>
                        </div>

                        {/* Configured Questions */}
                        <div className="flex items-start gap-3.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
                          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5 shrink-0">
                            <HelpCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-mono block uppercase tracking-wider">{t.summaryQuestionsCount}</span>
                            <span className="font-bold text-gray-100 text-sm block mt-0.5">
                              {questions.length} <span className="text-gold-custom text-xs font-mono">({t.summaryQuestionsVal})</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Provider Selection & Execute button */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Provider Selection */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <span className="text-xs font-extrabold text-gold-custom uppercase tracking-widest block font-mono">
                          {t.engineSelection}
                        </span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Perplexity API Blade */}
                          <div
                            onClick={() => {
                              setSelectedProviders(prev => {
                                if (prev.includes("perplexity")) {
                                  if (prev.length === 1) return prev;
                                  return prev.filter(p => p !== "perplexity");
                                } else {
                                  return [...prev, "perplexity"];
                                }
                              });
                            }}
                            className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 transition-all duration-300 cursor-pointer relative overflow-hidden select-none h-full ${
                              selectedProviders.includes("perplexity")
                                ? "border-gold-custom bg-gradient-to-br from-emerald-500/[0.04] to-transparent shadow-[0_0_20px_rgba(212,160,23,0.12)] scale-[1.01]"
                                : "border-border-custom bg-card-bg/60 hover:border-white/20 hover:bg-card-bg/80 hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="flex flex-col justify-between h-full gap-3">
                              <div className="space-y-3">
                                {/* Top Row: Brand Icon and Selection Circle */}
                                <div className="flex justify-between items-center w-full">
                                  <div className={`p-2 rounded-xl transition-all ${
                                    selectedProviders.includes("perplexity")
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-white/5 text-gray-400 border border-white/5"
                                  }`}>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <circle cx="11" cy="11" r="8" />
                                      <path d="m21 21-4.3-4.3" />
                                      <path d="M8 11h6M11 8v6" />
                                    </svg>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[8px] font-mono uppercase tracking-widest ${selectedProviders.includes("perplexity") ? "text-emerald-400 font-bold" : "text-gray-500"}`}>
                                      {selectedProviders.includes("perplexity") ? "240ms" : "Offline"}
                                    </span>
                                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                      selectedProviders.includes("perplexity")
                                        ? "border-gold-custom bg-gold-custom text-black shadow-[0_0_8px_rgba(212,160,23,0.3)]"
                                        : "border-white/10 bg-slate-955/50 text-transparent"
                                    }`}>
                                      <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>

                                {/* Title & Badge */}
                                <div className="space-y-1">
                                  <span className="text-sm font-extrabold text-gray-200 block font-sans tracking-tight leading-tight">
                                    {t.enginePerplexity}
                                  </span>
                                  <div>
                                    <span className="inline-block text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-widest whitespace-nowrap">
                                      {t.enginePerplexitySub}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                {lang === "es" 
                                  ? "Escanea internet en tiempo real para extraer citas verídicas. Requiere Perplexity API Key." 
                                  : "Scans the real-time web to extract truthful citations. Requires Perplexity API Key."}
                              </p>
                            </div>
                          </div>

                          {/* OpenAI Search Blade */}
                          <div
                            onClick={() => {
                              setSelectedProviders(prev => {
                                if (prev.includes("openai")) {
                                  if (prev.length === 1) return prev;
                                  return prev.filter(p => p !== "openai");
                                } else {
                                  return [...prev, "openai"];
                                }
                              });
                            }}
                            className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 transition-all duration-300 cursor-pointer relative overflow-hidden select-none h-full ${
                              selectedProviders.includes("openai")
                                ? "border-gold-custom bg-gradient-to-br from-sky-500/[0.04] to-transparent shadow-[0_0_20px_rgba(212,160,23,0.12)] scale-[1.01]"
                                : "border-border-custom bg-card-bg/60 hover:border-white/20 hover:bg-card-bg/80 hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="flex flex-col justify-between h-full gap-3">
                              <div className="space-y-3">
                                {/* Top Row: Brand Icon and Selection Circle */}
                                <div className="flex justify-between items-center w-full">
                                  <div className={`p-2 rounded-xl transition-all ${
                                    selectedProviders.includes("openai")
                                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                                      : "bg-white/5 text-gray-400 border border-white/5"
                                  }`}>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" d="M4.5 16.5c-1.5-2.5-1-6 1.5-7.5s6-1 7.5 1.5M19.5 7.5c1.5 2.5 1 6-1.5 7.5s-6 1-7.5-1.5" />
                                      <path strokeLinecap="round" d="M16.5 4.5c-2.5-1.5-6-1-7.5 1.5s-1 6 1.5 7.5M7.5 19.5c2.5 1.5 6 1 7.5-1.5s1-6-1.5-7.5" />
                                    </svg>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[8px] font-mono uppercase tracking-widest ${selectedProviders.includes("openai") ? "text-sky-400 font-bold" : "text-gray-550"}`}>
                                      {selectedProviders.includes("openai") ? "180ms" : "Offline"}
                                    </span>
                                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                      selectedProviders.includes("openai")
                                        ? "border-gold-custom bg-gold-custom text-black shadow-[0_0_8px_rgba(212,160,23,0.3)]"
                                        : "border-white/10 bg-slate-955/50 text-transparent"
                                    }`}>
                                      <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>

                                {/* Title & Badge */}
                                <div className="space-y-1">
                                  <span className="text-sm font-extrabold text-gray-200 block font-sans tracking-tight leading-tight">
                                    {t.engineOpenAI}
                                  </span>
                                  <div>
                                    <span className="inline-block text-[9px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-widest whitespace-nowrap">
                                      {t.engineOpenAISub}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                {lang === "es" 
                                  ? "Genera respuestas estructuradas usando el modelo gpt-4o de OpenAI. Requiere OpenAI API Key." 
                                  : "Generates structured responses using OpenAI's gpt-4o model. Requires OpenAI API Key."}
                              </p>
                            </div>
                          </div>

                          {/* Google Gemini Blade */}
                          <div
                            onClick={() => {
                              setSelectedProviders(prev => {
                                if (prev.includes("gemini")) {
                                  if (prev.length === 1) return prev;
                                  return prev.filter(p => p !== "gemini");
                                } else {
                                  return [...prev, "gemini"];
                                }
                              });
                            }}
                            className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 transition-all duration-300 cursor-pointer relative overflow-hidden select-none h-full ${
                              selectedProviders.includes("gemini")
                                ? "border-gold-custom bg-gradient-to-br from-purple-500/[0.04] to-transparent shadow-[0_0_20px_rgba(212,160,23,0.12)] scale-[1.01]"
                                : "border-border-custom bg-card-bg/60 hover:border-white/20 hover:bg-card-bg/80 hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="flex flex-col justify-between h-full gap-3">
                              <div className="space-y-3">
                                {/* Top Row: Brand Icon and Selection Circle */}
                                <div className="flex justify-between items-center w-full">
                                  <div className={`p-2 rounded-xl transition-all ${
                                    selectedProviders.includes("gemini")
                                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                      : "bg-white/5 text-gray-400 border border-white/5"
                                  }`}>
                                    <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2a1 1 0 0 1 .9.6l1.9 4.3 4.3 1.9a1 1 0 0 1 0 1.8l-4.3 1.9-1.9 4.3a1 1 0 0 1-1.8 0l-1.9-4.3-4.3-1.9a1 1 0 0 1 0-1.8l4.3-1.9 1.9-4.3A1 1 0 0 1 12 2zm6 13a1 1 0 0 1 .9.6l.9 2 2 .9a1 1 0 0 1 0 .9l-2 .9-.9 2-2 .9a1 1 0 0 1-1.8 0l-.9-2-2-.9a1 1 0 0 1 0-.9l2-.9.9-2 2-.9a1 1 0 0 1 .9-.6z" />
                                    </svg>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[8px] font-mono uppercase tracking-widest ${selectedProviders.includes("gemini") ? "text-purple-400 font-bold" : "text-gray-555"}`}>
                                      {selectedProviders.includes("gemini") ? "120ms" : "Offline"}
                                    </span>
                                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                      selectedProviders.includes("gemini")
                                        ? "border-gold-custom bg-gold-custom text-black shadow-[0_0_8px_rgba(212,160,23,0.3)]"
                                        : "border-white/10 bg-slate-955/50 text-transparent"
                                    }`}>
                                      <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>

                                {/* Title & Badge */}
                                <div className="space-y-1">
                                  <span className="text-sm font-extrabold text-gray-200 block font-sans tracking-tight leading-tight">
                                    {t.engineGemini}
                                  </span>
                                  <div>
                                    <span className="inline-block text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-widest whitespace-nowrap">
                                      {t.engineGeminiSub}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                {lang === "es" 
                                  ? "Consulta Gemini 1.5 Flash con Grounding de búsqueda de Google integrado. Requiere Gemini API Key." 
                                  : "Queries Gemini 1.5 Flash with built-in Google Search Grounding. Requires Gemini API Key."}
                              </p>
                            </div>
                          </div>

                          {/* Mock Data Blade */}
                          <div
                            onClick={() => {
                              setSelectedProviders(prev => {
                                if (prev.includes("mock")) {
                                  if (prev.length === 1) return prev;
                                  return prev.filter(p => p !== "mock");
                                } else {
                                  return [...prev, "mock"];
                                }
                              });
                            }}
                            className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 transition-all duration-300 cursor-pointer relative overflow-hidden select-none h-full ${
                              selectedProviders.includes("mock")
                                ? "border-gold-custom bg-gradient-to-br from-blue-500/[0.04] to-transparent shadow-[0_0_20px_rgba(212,160,23,0.12)] scale-[1.01]"
                                : "border-border-custom bg-card-bg/60 hover:border-white/20 hover:bg-card-bg/80 hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="flex flex-col justify-between h-full gap-3">
                              <div className="space-y-3">
                                {/* Top Row: Brand Icon and Selection Circle */}
                                <div className="flex justify-between items-center w-full">
                                  <div className={`p-2 rounded-xl transition-all ${
                                    selectedProviders.includes("mock")
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                      : "bg-white/5 text-gray-400 border border-white/5"
                                  }`}>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                                      <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
                                    </svg>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[8px] font-mono uppercase tracking-widest ${selectedProviders.includes("mock") ? "text-blue-400 font-bold" : "text-gray-555"}`}>
                                      {selectedProviders.includes("mock") ? "10ms" : "Offline"}
                                    </span>
                                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                      selectedProviders.includes("mock")
                                        ? "border-gold-custom bg-gold-custom text-black shadow-[0_0_8px_rgba(212,160,23,0.3)]"
                                        : "border-white/10 bg-slate-955/50 text-transparent"
                                    }`}>
                                      <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>

                                {/* Title & Badge */}
                                <div className="space-y-1">
                                  <span className="text-sm font-extrabold text-gray-200 block font-sans tracking-tight leading-tight">
                                    {t.engineMock}
                                  </span>
                                  <div>
                                    <span className="inline-block text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-widest whitespace-nowrap">
                                      {t.engineMockSub}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                {lang === "es" 
                                  ? "Genera una simulación local inmediata basada en tu perfil. Ideal para demostraciones instantáneas." 
                                  : "Generates an immediate local simulation based on your profile. Ideal for instant demos."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* API Key Forms */}
                      {selectedProviders.some(p => ["perplexity", "openai", "gemini"].includes(p)) && (
                        <div className="space-y-4">
                          {selectedProviders.includes("perplexity") && (
                            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold-custom/25 to-transparent" />
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-300 block font-mono uppercase tracking-wider">
                                  {lang === "es" ? "Clave API de Perplexity (Opcional)" : "Perplexity API Key (Optional)"}
                                </label>
                                <span className="text-[9px] font-mono text-gold-custom bg-gold-custom/10 px-2 py-0.5 rounded border border-gold-custom/25 font-bold uppercase tracking-wider">
                                  {lang === "es" ? "SOBRESCRITURA" : "OVERRIDE"}
                                </span>
                              </div>
                              
                              <div className="relative flex items-center">
                                <div className="absolute left-3.5 text-gray-555">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                  </svg>
                                </div>
                                <input 
                                  type="password"
                                  value={perplexityKey}
                                  onChange={(e) => {
                                    setPerplexityKey(e.target.value);
                                    localStorage.setItem("pplx_key_override", e.target.value.trim());
                                  }}
                                  placeholder="pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-white/10 hover:border-white/20 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom/30 rounded-xl text-xs text-gray-200 placeholder-gray-655 focus:outline-none focus:ring-gold-custom font-mono transition-all duration-300"
                                />
                              </div>
                            </div>
                          )}
                          
                          {selectedProviders.includes("openai") && (
                            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold-custom/25 to-transparent" />
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-300 block font-mono uppercase tracking-wider">
                                  {lang === "es" ? "Clave API de OpenAI (Opcional)" : "OpenAI API Key (Optional)"}
                                </label>
                                <span className="text-[9px] font-mono text-gold-custom bg-gold-custom/10 px-2 py-0.5 rounded border border-gold-custom/25 font-bold uppercase tracking-wider">
                                  {lang === "es" ? "SOBRESCRITURA" : "OVERRIDE"}
                                </span>
                              </div>
                              
                              <div className="relative flex items-center">
                                <div className="absolute left-3.5 text-gray-555">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                  </svg>
                                </div>
                                <input 
                                  type="password"
                                  value={openaiKey}
                                  onChange={(e) => {
                                    setOpenaiKey(e.target.value);
                                    localStorage.setItem("openai_key_override", e.target.value.trim());
                                  }}
                                  placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                  className="w-full pl-10 pr-4 py-3 bg-slate-955/80 border border-white/10 hover:border-white/20 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom/30 rounded-xl text-xs text-gray-200 placeholder-gray-650 focus:outline-none focus:ring-gold-custom font-mono transition-all duration-300"
                                />
                              </div>
                            </div>
                          )}
                          
                          {selectedProviders.includes("gemini") && (
                            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold-custom/25 to-transparent" />
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-300 block font-mono uppercase tracking-wider">
                                  {lang === "es" ? "Clave API de Gemini (Opcional)" : "Gemini API Key (Optional)"}
                                </label>
                                <span className="text-[9px] font-mono text-gold-custom bg-gold-custom/10 px-2 py-0.5 rounded border border-gold-custom/25 font-bold uppercase tracking-wider">
                                  {lang === "es" ? "SOBRESCRITURA" : "OVERRIDE"}
                                </span>
                              </div>
                              
                              <div className="relative flex items-center">
                                <div className="absolute left-3.5 text-gray-555">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                  </svg>
                                </div>
                                <input 
                                  type="password"
                                  value={geminiKey}
                                  onChange={(e) => {
                                    setGeminiKey(e.target.value);
                                    localStorage.setItem("gemini_key_override", e.target.value.trim());
                                  }}
                                  placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                  className="w-full pl-10 pr-4 py-3 bg-slate-955/80 border border-white/10 hover:border-white/20 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom/30 rounded-xl text-xs text-gray-200 placeholder-gray-655 focus:outline-none focus:ring-gold-custom font-mono transition-all duration-300"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cyber Terminal Tradeoffs Panel */}
                    <div className="bg-[#080B11] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl relative">
                      <div className="bg-slate-900/90 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 shrink-0" />
                          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 shrink-0" />
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500/80 shrink-0" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 ml-2 font-bold flex items-center gap-1">
                            <span>{t.diagnosticHeader}</span>
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500 uppercase font-black bg-white/5 px-2 py-0.5 rounded">SECURE_SHELL v1.4</span>
                      </div>
                      
                      <div className="p-5 text-xs font-mono leading-relaxed text-gray-400 space-y-4 bg-[#05070A]/85 backdrop-blur-md max-h-80 overflow-y-auto">
                        {(() => {
                          const renderTerminalLine = (line: string, index: number) => {
                            let colorClass = "text-gray-300";
                            if (line.startsWith("▶")) {
                              colorClass = "text-gold-custom font-extrabold";
                            } else if (line.startsWith("✓")) {
                              colorClass = "text-emerald-400 font-bold";
                            } else if (line.startsWith("⚠")) {
                              colorClass = "text-amber-500 font-bold animate-pulse";
                            } else if (line.startsWith("•") || line.startsWith("  •")) {
                              colorClass = "text-gray-450";
                            }
                            return (
                              <div key={index} className="flex gap-2.5 items-start py-0.5">
                                <span className="text-[9px] text-gray-600 select-none font-mono tracking-tight shrink-0 mt-0.5">{(index + 1).toString().padStart(2, '0')}</span>
                                <span className={`text-[11px] font-mono leading-relaxed ${colorClass}`}>{line}</span>
                              </div>
                            );
                          };
                          
                          const renderDiagnosticBlock = (cmd: string, text: string) => {
                            const lines = text.split("\n").filter(l => l.trim().length > 0);
                            return (
                              <div className="space-y-1.5 border-b border-white/[0.04] pb-3 last:border-b-0 last:pb-0">
                                <div className="flex gap-2 items-center text-gray-500 text-[10px] pb-1.5">
                                  <span className="text-gold-custom font-black font-mono animate-pulse">#</span>
                                  <span className="font-mono text-gray-450 font-bold">$ {cmd}</span>
                                </div>
                                {lines.map((line, idx) => renderTerminalLine(line, idx))}
                              </div>
                            );
                          };

                          return (
                            <>
                              {selectedProviders.includes("perplexity") && 
                                renderDiagnosticBlock("check --api --provider pplx-sonar", t.diagnosticPplx.replace("{time}", `${questions.length * 6}-${questions.length * 10}`))
                              }
                              {selectedProviders.includes("openai") && 
                                renderDiagnosticBlock("check --api --provider openai-search", t.diagnosticOpenAI.replace("{time}", `${questions.length * 6}-${questions.length * 10}`))
                              }
                              {selectedProviders.includes("gemini") && 
                                renderDiagnosticBlock("check --api --provider gemini-grounding", t.diagnosticGemini.replace("{time}", `${questions.length * 6}-${questions.length * 10}`))
                              }
                              {selectedProviders.includes("mock") && 
                                renderDiagnosticBlock("check --api --provider local-simulator", t.diagnosticMock)
                              }
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Confirmation Checkbox */}
                    <div className={`border rounded-2xl p-4 flex items-start gap-3.5 select-none transition-all duration-300 ${
                      isConfirmed 
                        ? "bg-gold-custom/[0.02] border-gold-custom/30 shadow-[0_0_15px_rgba(212,160,23,0.05)]" 
                        : "bg-slate-900/40 border-white/5 hover:border-white/10"
                    }`}>
                      <div className="relative flex items-center mt-0.5">
                        <input
                          type="checkbox"
                          id="audit-confirm"
                          checked={isConfirmed}
                          onChange={(e) => setIsConfirmed(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-white/15 bg-slate-955 text-gold-custom focus:ring-gold-custom cursor-pointer transition-all"
                        />
                      </div>
                      <label htmlFor="audit-confirm" className={`text-xs leading-normal font-semibold cursor-pointer transition-colors duration-300 ${isConfirmed ? "text-gold-custom font-bold" : "text-gray-300"}`}>
                        {t.confirmationCheck.replace("{count}", String(questions.length * selectedProviders.length))}
                      </label>
                    </div>

                    {/* Validation Warning */}
                    {!isConfirmed && (
                      <div className="flex items-center gap-2.5 text-xs text-amber-500 bg-amber-500/[0.03] border border-amber-500/15 px-4 py-3 rounded-xl animate-pulse">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="font-semibold">{t.confirmationWarning}</span>
                      </div>
                    )}

                    {/* Actions Step 3 */}
                    <div className="flex justify-between items-center pt-3 border-t border-white/[0.05]">
                      <button
                        onClick={() => handleGoToStep(2)}
                        className="flex items-center gap-2 text-xs text-gray-400 hover:text-white font-black px-5 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all cursor-pointer uppercase tracking-wider"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{t.btnBack}</span>
                      </button>
                      <button
                        onClick={handleStartAudit}
                        disabled={!isConfirmed}
                        className={isConfirmed
                          ? "flex items-center gap-2 bg-gradient-to-r from-gold-custom to-amber-500 hover:from-gold-hover hover:to-amber-600 text-black font-black px-7 py-3.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 transform hover:scale-[1.02] active:scale-95 cursor-pointer shadow-lg shadow-gold-custom/25 border-none"
                          : "flex items-center gap-2 bg-white/5 text-gray-500 font-black px-7 py-3.5 rounded-xl text-xs tracking-wider uppercase cursor-not-allowed opacity-30 border border-white/5"
                        }
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t.btnStartAudit}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Citation Extraction */}
              {step === 4 && (
                <div className="space-y-6">
                  {auditLoading ? (
                    // Real-time loop execution view with scanning radar side-by-side
                    <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-fade-in">
                      
                      {/* Left Column: Radar Scanner & Overall Diagnostic Terminal */}
                      <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-card-bg border border-border-custom rounded-2xl p-6 shadow-2xl">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold text-white font-sans">{t.scanHeader}</h3>
                            <p className="text-xs text-gray-400">
                              {t.scanSubHeader}
                            </p>
                          </div>

                          {/* Animated Radar Sweep */}
                          <div className="relative w-40 h-40 mx-auto flex items-center justify-center bg-black/50 rounded-full border border-gold-custom/20 overflow-hidden select-none">
                            {/* Concentric rings */}
                            <div className="absolute inset-2 rounded-full border border-gold-custom/5" />
                            <div className="absolute inset-8 rounded-full border border-gold-custom/5" />
                            <div className="absolute inset-14 rounded-full border border-gold-custom/10" />
                            
                            {/* Rotating sweep line */}
                            <div className="absolute inset-0 origin-center animate-spin" style={{ animationDuration: '3.5s' }}>
                              <div className="w-1/2 h-full bg-gradient-to-r from-transparent to-gold-custom/15 border-r border-gold-custom/30" />
                            </div>

                            {/* Center blinking light */}
                            <div className="absolute h-2.5 w-2.5 rounded-full bg-success-custom animate-pulse shadow-[0_0_8px_#22C55E]" />
                          </div>
                        </div>

                        {/* Progress Bar & Log Terminal */}
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-mono font-bold text-gray-400">
                              <span>{t.scanProgress}</span>
                              <span className="text-gold-custom text-xs">{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-955 rounded-full h-2 overflow-hidden border border-white/5">
                              <div
                                className="bg-gold-custom h-full rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Terminal Log Output */}
                          <div className="bg-slate-955 border border-white/5 rounded-lg p-3.5 h-44 overflow-y-auto text-left font-mono text-xs text-gray-400 space-y-1.5 scrollbar-thin">
                            {auditLogs.map((log, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-gold-custom shrink-0">▶</span>
                                <span className={log.startsWith("❌") ? "text-error-custom" : log.includes("✓") ? "text-success-custom" : "text-gray-200"}>
                                  {log}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Active crawling states of questions */}
                      <div className="lg:col-span-7 bg-card-bg border border-border-custom rounded-2xl p-6 shadow-2xl flex flex-col justify-between gap-4 h-full max-h-[550px]">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono block border-b border-white/5 pb-2">
                          {t.scanStatusHeader}
                        </span>

                        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                          {questionStates.map((qs, qidx) => (
                            <div key={qs.id || qidx} className="flex flex-col gap-2 p-3 bg-slate-955 border border-white/5 rounded-lg text-sm hover:border-white/10 transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-xs text-gray-500 font-mono shrink-0">
                                    {String(qidx + 1).padStart(2, "0")}
                                  </span>
                                  <p className="text-gray-355 font-semibold truncate font-sans">{qs.text}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  {qs.status === "pending" && (
                                    <span className="text-gray-600 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider font-mono">
                                      <span className="h-1.5 w-1.5 rounded-full bg-gray-700 animate-pulse" />
                                      {t.pending}
                                    </span>
                                  )}
                                  {qs.status === "auditing" && (
                                    <span className="text-gold-custom flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider font-mono animate-pulse">
                                      <RotateCw className="w-3.5 h-3.5 animate-spin text-gold-custom" />
                                      {t.scanSearching}
                                    </span>
                                  )}
                                  {qs.status === "completed" && (
                                    <span className="text-success-custom flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider font-mono">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-success-custom" />
                                      {t.scanReady}
                                    </span>
                                  )}
                                  {qs.status === "failed" && (
                                    <span className="text-error-custom flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider font-mono">
                                      <X className="w-3.5 h-3.5" />
                                      {t.scanError}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Extracted domains pop up immediately on complete */}
                              {qs.status === "completed" && qs.citations && qs.citations.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1 pl-5 animate-fade-in">
                                  {qs.citations.map((c: any, cidx: number) => {
                                    let classificationColor = "text-gray-400 bg-slate-900 border-white/5";
                                    if (c.classification === "target") classificationColor = "text-gold-custom bg-gold-custom/10 border-gold-custom/25 font-bold";
                                    else if (c.classification === "competitor") classificationColor = "text-warning-custom bg-warning-custom/10 border-warning-custom/25 font-bold";
                                    return (
                                      <span key={cidx} className={`text-[10px] font-mono border px-2 py-0.5 rounded ${classificationColor}`}>
                                        {c.domain}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    // Extraction split-panel dashboard (inspection view)
                    <div className="space-y-5 animate-fade-in">
                      <div className="space-y-1">
                        <h1 className="text-2xl font-bold text-white">{t.scanInspectTitle}</h1>
                        <p className="text-sm text-gray-400">
                          {t.scanInspectSub}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                        
                        {/* Left panel: List of analyzed questions */}
                        <div className="md:col-span-4 bg-card-bg border border-border-custom rounded-xl p-3.5 space-y-2.5 h-[500px] overflow-y-auto">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block px-2 mb-1">
                            {t.scanInspectQuestions}
                          </span>
                          {questions.map((q, idx) => {
                            const localQs = questionStates[idx];
                            const responseItem = reportData?.metrics?.questionsDetail?.[idx];
                            
                            const isAppeared = responseItem ? responseItem.appeared : (localQs?.appeared || false);
                            const hasCitations = responseItem ? responseItem.citationsCount > 0 : (localQs?.citations?.length > 0);
                            const isFailed = localQs?.status === "failed";

                            const statusColor = isFailed
                              ? "bg-error-custom/10 text-error-custom border-error-custom/25"
                              : isAppeared
                              ? "bg-success-custom/10 text-success-custom border-success-custom/25"
                              : hasCitations
                              ? "bg-warning-custom/10 text-warning-custom border-warning-custom/25"
                              : "bg-slate-950 text-gray-500 border-white/5";

                            const statusLabel = isFailed
                              ? t.statusFailed
                              : isAppeared
                              ? t.statusPresent
                              : hasCitations
                              ? t.statusCited
                              : t.statusAbsent;

                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedQuestionIdx(idx)}
                                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all select-none ${
                                  selectedQuestionIdx === idx
                                    ? "bg-slate-955 border-gold-custom"
                                    : "bg-transparent border-transparent hover:bg-slate-955/40"
                                }`}
                              >
                                <span className="text-[10px] text-gray-500 font-mono block mb-1">{t.queryTitleLabel.replace("{num}", String(idx + 1))}</span>
                                <p className="text-sm font-semibold text-gray-300 line-clamp-2 mb-2">{q.text}</p>
                                <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Main panel: Selected question details */}
                        {(() => {
                          const currentResponse = reportData?.metrics?.questionsDetail?.[selectedQuestionIdx] || questionStates[selectedQuestionIdx];

                          return (
                            <div className="md:col-span-8 bg-card-bg border border-border-custom rounded-xl p-6 space-y-4 animate-fade-in">
                              <div className="flex justify-between items-start gap-4">
                                <h3 className="text-xs font-bold text-gray-400 font-mono shrink-0 uppercase tracking-widest mt-1">
                                  {t.queryDetailTitle}
                                </h3>
                                {currentResponse?.answer && (
                                  <button
                                    onClick={() => setRawResponseModal(currentResponse || {})}
                                    className="text-xs font-bold text-gray-400 hover:text-white border border-white/10 px-2.5 py-1 rounded bg-slate-950/40 hover:bg-slate-950 transition-colors shrink-0 cursor-pointer"
                                  >
                                    {t.viewRawJson}
                                  </button>
                                )}
                              </div>

                              <h2 className="text-base font-bold text-white bg-slate-950/20 border border-white/5 p-4 rounded-lg leading-relaxed">
                                {questions[selectedQuestionIdx]?.text}
                              </h2>

                              {/* AI Response Summary */}
                              <div className="space-y-1.5">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                                  {t.aiResponseLabel}
                                </span>
                                <div className="bg-slate-955 border border-white/5 rounded-lg p-3.5 text-sm text-gray-300 leading-relaxed font-normal whitespace-pre-wrap max-h-44 overflow-y-auto">
                                  {currentResponse?.answer || (currentResponse?.status === "failed" ? t.queryDetailFailed : t.queryDetailNoResponse)}
                                </div>
                              </div>

                              {/* Target brand detection */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3.5 bg-slate-950 rounded-lg border border-white/5 flex flex-col justify-between">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{t.ownMentionLabel}</span>
                                  <div className="flex items-center gap-2 mt-2">
                                    {currentResponse?.appeared ? (
                                      <>
                                        <span className="text-sm font-extrabold text-success-custom uppercase">✓ {t.statusCited}</span>
                                        <span className="text-xs text-gray-400 font-mono">({projectForm.domain})</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm font-extrabold text-error-custom uppercase">✕ {t.statusAbsent}</span>
                                        <span className="text-xs text-gray-400 font-mono">({projectForm.domain})</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3.5 bg-slate-955 rounded-lg border border-white/5 flex flex-col justify-between">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{t.detectedCompetitorsLabel}</span>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {currentResponse?.citations?.filter((c: any) => c.classification === "competitor").length > 0 ? (
                                      currentResponse.citations
                                        .filter((c: any) => c.classification === "competitor")
                                        .map((c: any, cidx: number) => (
                                          <span
                                            key={cidx}
                                            className="text-[10px] font-semibold text-warning-custom bg-warning-custom/10 border border-warning-custom/25 px-2 py-0.5 rounded font-mono"
                                          >
                                            {c.domain}
                                          </span>
                                        ))
                                    ) : (
                                      <span className="text-xs text-gray-500 italic">{t.noneCitedLabel}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Citation Domains chips list */}
                              <div className="space-y-1.5">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                                  {t.citedDomainsLabel} ({currentResponse?.citations?.length || 0})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {currentResponse?.citations && currentResponse.citations.length > 0 ? (
                                    currentResponse.citations.map((cit: any, cidx: number) => (
                                      <a
                                        key={cidx}
                                        href={cit.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-300 bg-slate-955 hover:bg-slate-900 border border-white/10 px-2.5 py-1 rounded transition-colors group"
                                      >
                                        <span>{cit.domain}</span>
                                        <ExternalLink className="w-2.5 h-2.5 text-gray-500 group-hover:text-gold-custom transition-colors" />
                                      </a>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-500 italic">{t.noCitationsFound}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Actions Step 4 */}
                      <div className="flex justify-between items-center pt-2.5">
                        <button
                          onClick={() => handleGoToStep(3)}
                          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white font-semibold px-4 py-2.5 border border-white/10 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>{t.btnBack}</span>
                        </button>
                        <button
                          onClick={() => setStep(5)}
                          className="flex items-center gap-1.5 bg-[#D4A017] hover:bg-[#F5B942] text-black font-extrabold px-6 py-2.5 rounded-lg text-sm tracking-wider uppercase transition-all duration-300 transform scale-105 cursor-pointer shadow-lg shadow-gold-custom/40 border border-[#D4A017] gold-glow ring-2 ring-gold-custom/30 gold-pulse"
                        >
                          <span>{t.btnViewReport}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: Audit Report (Executive intelligence report) */}
              {step === 5 && activeReportData && (() => {
                const reportData = activeReportData;
                return (
                  <div className="space-y-8 animate-fade-in">
                  
                  {/* Top Header Summary in Natural Language */}
                  <div className="bg-gradient-to-r from-gold-custom/10 via-slate-950 to-slate-950 border border-gold-custom/20 rounded-xl p-5 shadow-xl">
                    <span className="text-[9px] font-bold text-gold-custom uppercase tracking-wider block mb-1">{t.reportExecSummary}</span>
                    <h2 className="text-base font-bold text-white leading-relaxed">
                      {lang === "es" ? (
                        <>
                          La marca <span className="text-gold-custom font-extrabold">{projectForm.company_name}</span> se detectó en <span className="text-gold-custom font-extrabold">{reportData.metrics.targetPresenceCount} de {reportData.metrics.totalQuestions}</span> intenciones de búsqueda directas, logrando un <span className="text-gold-custom font-extrabold">{reportData.metrics.shareOfVoice}%</span> de Share of Voice (SOV) en motores generativos.
                        </>
                      ) : (
                        <>
                          The brand <span className="text-gold-custom font-extrabold">{projectForm.company_name}</span> was detected in <span className="text-gold-custom font-extrabold">{reportData.metrics.targetPresenceCount} out of {reportData.metrics.totalQuestions}</span> direct search intents, achieving a <span className="text-gold-custom font-extrabold">{reportData.metrics.shareOfVoice}%</span> Share of Voice (SOV) in generative search engines.
                        </>
                      )}
                    </h2>
                    <p className="text-xs text-gray-400 mt-2 font-normal">
                      {reportData.metrics.shareOfVoice === 100 
                        ? t.reportSovGood 
                        : reportData.metrics.shareOfVoice >= 50
                        ? t.reportSovMedium
                        : t.reportSovCritical}
                    </p>
                  </div>

                  {/* Top Toolbar Exit CTAs */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 select-none">
                    <div className="space-y-0.5">
                      <h2 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-widest">
                        {t.reportToolbarTitle}
                      </h2>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => handleGoToStep(1)}
                        className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white font-bold border border-white/10 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <SettingsIcon className="w-3.5 h-3.5" />
                        <span>{t.btnEditConfig}</span>
                      </button>
                      
                      <button
                        onClick={handleExportReport}
                        className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white font-bold border border-white/10 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>{t.btnExportJson}</span>
                      </button>

                      <button
                        onClick={handleStartNewAudit}
                        className="flex items-center gap-1.5 bg-[#D4A017] hover:bg-[#F5B942] text-black font-extrabold px-4 py-2 rounded-lg text-xs tracking-wider uppercase transition-all duration-300 transform scale-105 cursor-pointer shadow-lg shadow-gold-custom/40 border border-[#D4A017] gold-glow ring-2 ring-gold-custom/30 gold-pulse"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.btnNewAudit}</span>
                      </button>
                    </div>
                  </div>

                  {/* Engine Filter Pills (visible only when multiple providers are audited) */}
                  {uniqueProviders.length > 1 && (
                    <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-white/5 max-w-fit select-none mb-4">
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest px-2">{lang === "es" ? "FILTRAR MOTOR:" : "FILTER ENGINE:"}</span>
                      <button
                        onClick={() => setSelectedEngine("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          selectedEngine === "all"
                            ? "bg-[#D4A017] text-black shadow-md shadow-gold-custom/20 font-extrabold animate-fade-in"
                            : "text-gray-405 hover:text-white bg-transparent"
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
                              ? "bg-[#D4A017] text-black shadow-md shadow-gold-custom/20 font-extrabold animate-fade-in"
                              : "text-gray-405 hover:text-white bg-transparent"
                          }`}
                        >
                          {prov.toLowerCase() === "perplexity" ? "Perplexity" : "Mock Data"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Report Navigation Tabs */}
                  <div className="flex border-b border-white/5 gap-1 select-none">
                    <button
                      onClick={() => setReportTab("overview")}
                      className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        reportTab === "overview"
                          ? "border-gold-custom text-gold-custom font-extrabold bg-white/[0.02]"
                          : "border-transparent text-gray-500 hover:text-gray-305"
                      }`}
                    >
                      {t.tabOverview}
                    </button>
                    <button
                      onClick={() => setReportTab("analysis")}
                      className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        reportTab === "analysis"
                          ? "border-gold-custom text-gold-custom font-extrabold bg-white/[0.02]"
                          : "border-transparent text-gray-500 hover:text-gray-305"
                      }`}
                    >
                      {t.tabAnalysis}
                    </button>
                    <button
                      onClick={() => setReportTab("diagnosis")}
                      className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        reportTab === "diagnosis"
                          ? "border-gold-custom text-gold-custom font-extrabold bg-white/[0.02]"
                          : "border-transparent text-gray-500 hover:text-gray-305"
                      }`}
                    >
                      {lang === "es" ? "Diagnóstico Competitivo" : "Competitive Diagnosis"}
                    </button>
                    <button
                      onClick={() => setReportTab("opportunities")}
                      className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        reportTab === "opportunities"
                          ? "border-gold-custom text-gold-custom font-extrabold bg-white/[0.02]"
                          : "border-transparent text-gray-500 hover:text-gray-305"
                      }`}
                    >
                      {t.tabRecommendations}
                    </button>
                    <button
                      onClick={() => setReportTab("comparison")}
                      className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        reportTab === "comparison"
                          ? "border-gold-custom text-gold-custom font-extrabold bg-white/[0.02]"
                          : "border-transparent text-gray-500 hover:text-gray-305"
                      }`}
                    >
                      {lang === "es" ? "Comparación de Motores" : "Engine Comparison"}
                    </button>
                  </div>

                  {/* BLOCK 1: Share of Voice & Domain Rankings */}
                  {reportTab === "overview" && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-gold-custom pl-3">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider">
                        {t.sovHeader}
                      </h2>
                      <p className="text-xs text-gray-500">{t.sovSubHeader}</p>
                    </div>

                    {/* KEY INSIGHTS QUICK DIAGNOSIS DASHBOARD */}
                    <div className="bg-slate-950/40 border border-gold-custom/20 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <div className="h-5 w-5 rounded bg-gold-custom/10 flex items-center justify-center border border-gold-custom/30">
                          <Sparkles className="w-3.5 h-3.5 text-gold-custom" />
                        </div>
                        <span className="text-xs font-bold text-gold-custom uppercase tracking-wider font-mono">
                          {lang === "es" ? "Diagnóstico Rápido de Auditoría (Resumen de Objetivos)" : "Quick Audit Diagnosis (Objectives Summary)"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Objective 1: Dominios Más Citados */}
                        <div 
                          onClick={() => setActiveModal("topDomains")}
                          className="p-4 rounded-xl border border-white/5 bg-slate-955/20 space-y-3 cursor-pointer hover:border-gold-custom/50 hover:bg-[#0D121B]/40 transition-all group"
                          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                        >
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 group-hover:text-gold-custom transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold-custom"></span>
                            <span>{lang === "es" ? "1. Dominios Más Citados" : "1. Most Cited Domains"}</span>
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            {reportData.metrics.topDomains.slice(0, 3).map((dom: any, i: number) => (
                              <div key={i} className="flex justify-between items-center bg-black/20 p-1.5 rounded border border-white/5 font-mono">
                                <span className="text-gray-300 font-bold truncate max-w-[200px]">{dom.name}</span>
                                <span className="text-gold-custom font-extrabold">{dom.value} {lang === "es" ? "citas" : "citations"}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Objective 2: Presencia de la Empresa Objetivo */}
                        <div 
                          onClick={() => setActiveModal("targetPresence")}
                          className="p-4 rounded-xl border border-white/5 bg-slate-955/20 space-y-3 cursor-pointer hover:border-gold-custom/50 hover:bg-[#0D121B]/40 transition-all group"
                          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                        >
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 group-hover:text-gold-custom transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold-custom"></span>
                            <span>{lang === "es" ? "2. Presencia de la Empresa Objetivo" : "2. Target Brand Presence"}</span>
                          </h4>
                          <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
                            <div className="flex-1 space-y-1">
                              <span className="text-xs text-gray-400 block font-semibold">
                                {lang === "es" ? `Aparece en ${reportData.metrics.targetPresenceCount} de ${reportData.metrics.totalQuestions} preguntas` : `Appears in ${reportData.metrics.targetPresenceCount} of ${reportData.metrics.totalQuestions} questions`}
                              </span>
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border max-w-fit block ${
                                reportData.metrics.shareOfVoice >= 70 ? "bg-success-custom/10 text-success-custom border-success-custom/25" :
                                reportData.metrics.shareOfVoice >= 35 ? "bg-warning-custom/10 text-warning-custom border-warning-custom/25" :
                                "bg-error-custom/10 text-error-custom border-error-custom/25"
                              }`}>
                                {reportData.metrics.shareOfVoice >= 70 ? (lang === "es" ? "PRESENCIA FUERTE" : "STRONG PRESENCE") :
                                 reportData.metrics.shareOfVoice >= 35 ? (lang === "es" ? "PRESENCIA PARCIAL" : "PARTIAL PRESENCE") :
                                 (lang === "es" ? "AUSENCIA CRÍTICA" : "CRITICAL ABSENCE")}
                              </span>
                            </div>
                            <span className="text-2xl font-black text-white font-mono">{reportData.metrics.shareOfVoice}% <span className="text-[10px] text-gray-500 font-normal">SOV</span></span>
                          </div>
                        </div>

                        {/* Objective 3: Competidores y Terceros en Respuestas */}
                        <div 
                          onClick={() => setActiveModal("competitorCitations")}
                          className="p-4 rounded-xl border border-white/5 bg-slate-955/20 space-y-3 cursor-pointer hover:border-gold-custom/50 hover:bg-[#0D121B]/40 transition-all group"
                          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                        >
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 group-hover:text-gold-custom transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold-custom"></span>
                            <span>{lang === "es" ? "3. Competidores y Terceros Citados" : "3. Competitors & Third-Parties Cited"}</span>
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div>
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold block mb-1">{lang === "es" ? "Competidores detectados:" : "Competitors detected:"}</span>
                              <div className="flex flex-wrap gap-1">
                                {reportData.metrics.topDomains.filter((d: any) => d.classification === 'competitor').length > 0 ? (
                                  reportData.metrics.topDomains.filter((d: any) => d.classification === 'competitor').slice(0, 3).map((d: any, idx: number) => (
                                    <span key={idx} className="bg-red-500/10 border border-red-500/20 text-red-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                                      {d.name} ({d.value})
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-500 italic text-[10px]">{lang === "es" ? "Ninguno detectado" : "None detected"}</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-bold block mb-1">{lang === "es" ? "Sitios de autoridad / terceros:" : "Third-party / Authority sites:"}</span>
                              <div className="flex flex-wrap gap-1">
                                {reportData.metrics.authorityAnalysis.mostInfluentialDomains.length > 0 ? (
                                  reportData.metrics.authorityAnalysis.mostInfluentialDomains.slice(0, 3).map((d: any, idx: number) => (
                                    <span key={idx} className="bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                                      {d.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-500 italic text-[10px]">{lang === "es" ? "Ninguna fuente externa" : "No external sources"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Objective 4: Oportunidades de Contenido */}
                        <div 
                          onClick={() => setActiveModal("contentOpportunities")}
                          className="p-4 rounded-xl border border-white/5 bg-slate-955/20 space-y-3 cursor-pointer hover:border-gold-custom/50 hover:bg-[#0D121B]/40 transition-all group"
                          title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                        >
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 group-hover:text-gold-custom transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold-custom"></span>
                            <span>{lang === "es" ? "4. Oportunidades de Contenido" : "4. Content Opportunities"}</span>
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            {reportData.metrics.questionsDetail.filter((q: any) => !q.appeared || q.isOpportunity).length > 0 ? (
                              reportData.metrics.questionsDetail
                                .filter((q: any) => !q.appeared || q.isOpportunity)
                                .slice(0, 2)
                                .map((q: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 bg-black/20 p-1.5 rounded border border-red-500/10 text-gray-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                                    <span className="truncate font-semibold text-[11px]" title={q.questionText}>{q.questionText}</span>
                                  </div>
                                ))
                            ) : (
                              <div className="text-success-custom text-xs italic py-2">
                                {lang === "es" ? "¡Felicidades! No hay brechas críticas." : "Congratulations! No critical gaps found."}
                              </div>
                            )}
                            {reportData.metrics.questionsDetail.filter((q: any) => !q.appeared || q.isOpportunity).length > 2 && (
                              <span className="text-[10px] text-gray-500 block text-right font-mono">
                                + {reportData.metrics.questionsDetail.filter((q: any) => !q.appeared || q.isOpportunity).length - 2} {lang === "es" ? "más en pestaña Análisis" : "more in Analysis tab"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPI Widget Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* 1. Visibility Score */}
                      <div 
                        onClick={() => setActiveModal("visibility")}
                        className="bg-card-bg border border-border-custom p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-gold-custom/50 hover:bg-[#0D121B]/40 transition-all"
                        title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                            {lang === "es" ? "Puntuación de Visibilidad" : "Visibility Score"}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">{reportData.metrics.newKpis.visibilityScore}%</span>
                          </div>
                        </div>
                        <div className="relative h-11 w-11 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="22" cy="22" r="18" className="stroke-slate-900" strokeWidth="2.5" fill="transparent" />
                            <circle cx="22" cy="22" r="18" className="stroke-gold-custom" strokeWidth="2.5" fill="transparent"
                              strokeDasharray={2 * Math.PI * 18}
                              strokeDashoffset={2 * Math.PI * 18 * (1 - reportData.metrics.newKpis.visibilityScore / 100)}
                            />
                          </svg>
                          <span className="absolute text-[11px] font-bold text-white">{reportData.metrics.newKpis.visibilityScore}%</span>
                        </div>
                      </div>

                      {/* 2. Authority Score */}
                      <div 
                        onClick={() => setActiveModal("authority")}
                        className="bg-card-bg border border-border-custom p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-500/50 hover:bg-[#0D121B]/40 transition-all"
                        title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                            {lang === "es" ? "Puntuación de Autoridad" : "Authority Score"}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">{reportData.metrics.newKpis.authorityScore}%</span>
                          </div>
                        </div>
                        <div className="relative h-11 w-11 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="22" cy="22" r="18" className="stroke-slate-900" strokeWidth="2.5" fill="transparent" />
                            <circle cx="22" cy="22" r="18" className="stroke-blue-500" strokeWidth="2.5" fill="transparent"
                              strokeDasharray={2 * Math.PI * 18}
                              strokeDashoffset={2 * Math.PI * 18 * (1 - reportData.metrics.newKpis.authorityScore / 100)}
                            />
                          </svg>
                          <span className="absolute text-[11px] font-bold text-white">{reportData.metrics.newKpis.authorityScore}%</span>
                        </div>
                      </div>

                      {/* 3. Competitor Dominance Score */}
                      <div 
                        onClick={() => setActiveModal("competitors")}
                        className="bg-card-bg border border-border-custom p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-red-500/50 hover:bg-[#0D121B]/40 transition-all"
                        title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                            {lang === "es" ? "Dominio de Competidores" : "Competitor Dominance"}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">{reportData.metrics.newKpis.competitorDominanceScore}%</span>
                          </div>
                        </div>
                        <div className="relative h-11 w-11 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="22" cy="22" r="18" className="stroke-slate-900" strokeWidth="2.5" fill="transparent" />
                            <circle cx="22" cy="22" r="18" className="stroke-red-500" strokeWidth="2.5" fill="transparent"
                              strokeDasharray={2 * Math.PI * 18}
                              strokeDashoffset={2 * Math.PI * 18 * (1 - reportData.metrics.newKpis.competitorDominanceScore / 100)}
                            />
                          </svg>
                          <span className="absolute text-[11px] font-bold text-white">{reportData.metrics.newKpis.competitorDominanceScore}%</span>
                        </div>
                      </div>

                      {/* 4. Content Gap Score */}
                      <div 
                        onClick={() => setActiveModal("contentGap")}
                        className="bg-card-bg border border-border-custom p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-orange-500/50 hover:bg-[#0D121B]/40 transition-all"
                        title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                            {lang === "es" ? "Brecha de Contenido" : "Content Gap Score"}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">{reportData.metrics.newKpis.contentGapScore}%</span>
                          </div>
                        </div>
                        <div className="relative h-11 w-11 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="22" cy="22" r="18" className="stroke-slate-900" strokeWidth="2.5" fill="transparent" />
                            <circle cx="22" cy="22" r="18" className="stroke-orange-500" strokeWidth="2.5" fill="transparent"
                              strokeDasharray={2 * Math.PI * 18}
                              strokeDashoffset={2 * Math.PI * 18 * (1 - reportData.metrics.newKpis.contentGapScore / 100)}
                            />
                          </svg>
                          <span className="absolute text-[11px] font-bold text-white">{reportData.metrics.newKpis.contentGapScore}%</span>
                        </div>
                      </div>

                      {/* 5. Opportunity Score */}
                      <div 
                        onClick={() => setActiveModal("opportunity")}
                        className="bg-card-bg border border-border-custom p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-green-500/50 hover:bg-[#0D121B]/40 transition-all"
                        title={lang === "es" ? "Haz clic para ver más detalles" : "Click to view more details"}
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                            {lang === "es" ? "Puntuación de Oportunidad" : "Opportunity Score"}
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">{reportData.metrics.newKpis.opportunityScore}%</span>
                          </div>
                        </div>
                        <div className="relative h-11 w-11 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="22" cy="22" r="18" className="stroke-slate-900" strokeWidth="2.5" fill="transparent" />
                            <circle cx="22" cy="22" r="18" className="stroke-green-500" strokeWidth="2.5" fill="transparent"
                              strokeDasharray={2 * Math.PI * 18}
                              strokeDashoffset={2 * Math.PI * 18 * (1 - reportData.metrics.newKpis.opportunityScore / 100)}
                            />
                          </svg>
                          <span className="absolute text-[11px] font-bold text-white">{reportData.metrics.newKpis.opportunityScore}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Table rankings side-by-side */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {/* Top Cited Domains */}
                      <div className="lg:col-span-6 bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest">
                          {t.rankingDomainsHeader}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 font-mono uppercase tracking-wider text-[10px]">
                                <th className="pb-2 font-semibold">{t.tableColDomain}</th>
                                <th className="pb-2 font-semibold text-right">{t.tableColCitations}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium text-gray-300">
                              {reportData.metrics.topDomains.length > 0 ? (
                                reportData.metrics.topDomains.map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="py-2.5 flex items-center gap-2">
                                      <span className="text-gray-500 font-mono text-xs">{idx + 1}.</span>
                                      <span className="font-semibold text-gray-200 text-sm">{item.name}</span>
                                      {item.classification === "target" && (
                                        <span className="text-[10px] font-extrabold uppercase bg-gold-custom/10 text-gold-custom border border-gold-custom/25 px-1.5 py-0.5 rounded leading-none">
                                          {t.rankingTargetBadge}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-right font-mono text-white font-bold text-sm">{item.value}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} className="py-6 text-center text-gray-500 italic text-sm">{t.noCitationsExtracted}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Competitors Found */}
                      <div className="lg:col-span-6 bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest">
                          {t.competitorsDetectedHeader}
                        </h3>
                        <div className="space-y-2">
                          {reportData.metrics.topDomains.filter((d: any) => d.classification === "competitor").length > 0 ? (
                            reportData.metrics.topDomains
                              .filter((d: any) => d.classification === "competitor")
                              .map((item: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="bg-slate-955 border border-white/5 p-3.5 rounded-lg flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-warning-custom shrink-0" />
                                    <span className="text-sm font-bold text-gray-200">{item.name}</span>
                                  </div>
                                  <div className="text-right text-sm">
                                    <span className="font-mono text-white font-extrabold text-sm">{item.value}</span>
                                    <span className="text-gray-500 text-xs font-mono ml-1">{t.competitorsDetectedSub}</span>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="border border-dashed border-white/5 rounded-lg py-8 text-center text-gray-500 text-sm italic">
                              {t.noCompetitorsDetected}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Suggested Competitors (Auto-detection) */}
                    {reportData.metrics.detectedPotentialCompetitors && reportData.metrics.detectedPotentialCompetitors.length > 0 && (
                      <div className="bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest">
                            {lang === "es" ? "Detección Automática de Competidores (IA)" : "Automatic Competitor Detection (AI)"}
                          </h3>
                          <p className="text-[10px] text-gray-500">
                            {lang === "es"
                              ? "Estos dominios no están en tu lista de competidores pero son citados con frecuencia en las respuestas de la IA."
                              : "These domains are not in your competitor list but are frequently cited in AI responses."}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {reportData.metrics.detectedPotentialCompetitors.map((item: any) => (
                            <div
                              key={item.domain}
                              className="bg-slate-955 border border-white/5 p-3 rounded-lg flex items-center justify-between gap-3 text-xs"
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
                                    const rawCompList = projectForm.competitors || "";
                                    const currentComps = rawCompList
                                      .split(",")
                                      .map((c: string) => c.trim())
                                      .filter((c: string) => c.length > 0);
                                    
                                    const updatedComps = [...currentComps, item.domain];
                                    const res = await fetch("/api/projects", {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        id: projectId,
                                        competitors: updatedComps,
                                      }),
                                    });
                                    if (!res.ok) throw new Error();

                                    triggerNotification(
                                      lang === "es" ? "Competidor agregado y clasificado." : "Competitor added and classified.",
                                      "success"
                                    );

                                    if (runId) handleLoadPastRun(runId);
                                  } catch (err) {
                                    triggerNotification(
                                      lang === "es" ? "Error al agregar competidor" : "Error adding competitor",
                                      "error"
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 bg-gold-custom hover:bg-gold-hover text-black font-extrabold rounded text-[9px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>{lang === "es" ? "Agregar" : "Add"}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  {reportTab === "analysis" && (
                  <div className="space-y-4">
                    <div className="border-l-2 border-gold-custom pl-3">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider">
                        {t.tableBreakdownHeader}
                      </h2>
                      <p className="text-xs text-gray-500">{t.tableBreakdownSub}</p>
                    </div>

                    <div className="bg-card-bg border border-border-custom rounded-xl p-5 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-500 font-mono uppercase tracking-wider text-[10px]">
                              <th className="pb-2.5 font-semibold w-8">{t.tableColNumber}</th>
                              <th className="pb-2.5 font-semibold">{t.tableColQuestion}</th>
                              <th className="pb-2.5 font-semibold text-center">{t.tableColTargetBrand}</th>
                              <th className="pb-2.5 font-semibold text-center">{t.tableColCitationsExtracted}</th>
                              <th className="pb-2.5 font-semibold text-center">{t.tableColCompetitorsCited}</th>
                              <th className="pb-2.5 font-semibold text-center">{t.tableColPriority}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-medium text-gray-300 text-sm">
                            {reportData.metrics.questionsDetail.map((item: any, idx: number) => {
                              const compCount = item.citations?.filter((c: any) => c.classification === "competitor").length || 0;

                              return (
                                <tr key={item.questionId || idx} className="hover:bg-white/5 transition-colors">
                                  <td className="py-3 font-mono text-gray-500">{idx + 1}</td>
                                  <td className="py-3 max-w-sm sm:max-w-md truncate font-bold text-gray-200 text-sm" title={item.questionText}>
                                    {item.questionText}
                                  </td>
                                  <td className="py-3 text-center">
                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                      item.appeared
                                        ? "bg-success-custom/10 text-success-custom border-success-custom/25"
                                        : "bg-error-custom/10 text-error-custom border-error-custom/25"
                                    }`}>
                                      {item.appeared ? t.badgePresent : t.badgeAbsent}
                                    </span>
                                  </td>
                                  <td className="py-3 text-center font-mono font-bold text-white text-sm">
                                    {item.citationsCount}
                                  </td>
                                  <td className="py-3 text-center font-mono font-bold text-white text-sm">
                                    {compCount}
                                  </td>
                                  <td className="py-3 text-center">
                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                      item.isOpportunity
                                        ? "bg-red-500/10 text-red-400 border-red-500/25"
                                        : "bg-blue-500/10 text-blue-400 border-blue-500/25"
                                    }`}>
                                      {item.isOpportunity ? t.badgePriorityCritical : t.badgePriorityLow}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* BLOCK: Competitive Diagnosis Tab */}
                  {reportTab === "diagnosis" && (
                    <div className="space-y-6 animate-fade-in text-sm">
                      {/* Section Header */}
                      <div className="border-l-2 border-gold-custom pl-3">
                        <h2 className="text-base font-bold text-white uppercase tracking-wider">
                          {lang === "es" ? "Por qué los Competidores se Posicionan Mejor" : "Why Competitors Rank Better"}
                        </h2>
                        <p className="text-xs text-gray-500">
                          {lang === "es" 
                            ? "Análisis detallado de factores de visibilidad, autoridad y presencia de marca comparado con los competidores detectados." 
                            : "Detailed analysis of visibility factors, authority, and brand presence compared against detected competitors."}
                        </p>
                      </div>

                      {/* 1. Comparison Table */}
                      <div className="bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest">
                          {lang === "es" ? "Tabla Comparativa de Posicionamiento" : "Competitive Positioning Comparison Table"}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 font-mono uppercase tracking-wider text-[10px]">
                                <th className="pb-2 font-semibold">{lang === "es" ? "Compañía" : "Company"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Menciones IA" : "AI Mentions"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Citas Totales" : "Citation Count"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Citas 3ros" : "3rd-Party Citations"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Sitios Reseñas" : "Review Sites"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Págs. Comparación" : "Comparison Pages"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Cobertura Edu" : "Edu Coverage"}</th>
                                <th className="pb-2 font-semibold text-center">{lang === "es" ? "Prensa / Noticias" : "Industry Publications"}</th>
                                <th className="pb-2 font-semibold text-right">{lang === "es" ? "Puntuación Visibilidad" : "Visibility Score"}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium text-gray-300 text-sm">
                              {reportData.metrics.competitorComparisons.map((row: any, idx: number) => (
                                <tr key={idx} className={`hover:bg-white/5 transition-colors ${row.isTarget ? "bg-white/[0.01]" : ""}`}>
                                  <td className="py-3 flex items-center gap-2">
                                    <span className="font-semibold text-gray-200 text-sm">{row.company}</span>
                                    {row.isTarget ? (
                                      <span className="text-[10px] font-extrabold uppercase bg-gold-custom/10 text-gold-custom border border-gold-custom/25 px-1.5 py-0.5 rounded leading-none">
                                        {lang === "es" ? "Tu Marca" : "Your Brand"}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-gray-500 font-mono">({row.domain})</span>
                                    )}
                                  </td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.aiMentions}</td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.citationCount}</td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.thirdPartyCitations}</td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.reviewSitesFound}</td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.comparisonPagesFound}</td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.educationalCoverage}</td>
                                  <td className="py-3 text-center font-mono text-gray-400 text-sm">{row.industryPubsFound}</td>
                                  <td className="py-3 text-right">
                                    <span className={`font-bold font-mono text-sm ${row.isTarget ? "text-gold-custom font-extrabold" : "text-white"}`}>
                                      {row.visibilityScore}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 2. Authority & Domain Source breakdown widgets */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Citation categories breakdown */}
                        <div className="lg:col-span-5 bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                          <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest">
                            {lang === "es" ? "Distribución de Autoridad por Categoría" : "Authority Distribution by Category"}
                          </h3>
                          <div className="space-y-3">
                            {Object.entries(reportData.metrics.authorityAnalysis.categoryCounts).map(([cat, count]: [string, any]) => {
                              const total = Object.values(reportData.metrics.authorityAnalysis.categoryCounts).reduce((s: any, v: any) => s + v, 0) as number;
                              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                              return (
                                <div key={cat} className="space-y-1">
                                  <div className="flex justify-between text-xs font-medium text-gray-400">
                                    <span>{cat}</span>
                                    <span className="font-mono text-gray-305 text-xs">{count} ({percent}%)</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        cat === "Company Website" ? "bg-gold-custom" :
                                        cat === "Competitor Website" ? "bg-red-500" :
                                        cat === "Review Site" ? "bg-blue-500" :
                                        cat === "Industry Publication" ? "bg-purple-500" :
                                        cat === "Directory" ? "bg-orange-500" :
                                        cat === "Community / Forum" ? "bg-teal-500" : "bg-gray-600"
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Influential domains / External Sources */}
                        <div className="lg:col-span-7 bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                          <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest">
                            {lang === "es" ? "Fuentes Externas y Dominios Más Influyentes" : "External Sources & Most Influential Domains"}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {/* Influential domains list */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-extrabold text-gold-custom uppercase tracking-wider font-mono">
                                {lang === "es" ? "■ Autoridad Externa (Reseñas/Prensa)" : "■ External Authority (Reviews/PR)"}
                              </h4>
                              {reportData.metrics.authorityAnalysis.mostInfluentialDomains.length > 0 ? (
                                <div className="space-y-2">
                                  {reportData.metrics.authorityAnalysis.mostInfluentialDomains.map((dom: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs p-1.5 border border-white/5 bg-slate-950/20 rounded">
                                      <span className="font-semibold text-gray-300 truncate max-w-[120px] text-xs">{dom.name}</span>
                                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono">{dom.classification}</span>
                                      <span className="font-mono text-gray-400 font-bold text-xs">{dom.value}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 italic">{lang === "es" ? "No se detectaron fuentes de autoridad externa." : "No external authority sources detected."}</p>
                              )}
                            </div>

                            {/* External sources list */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-extrabold text-gold-custom uppercase tracking-wider font-mono">
                                {lang === "es" ? "■ Fuentes de Referencia Citadas" : "■ Referenced Cited Sources"}
                              </h4>
                              {reportData.metrics.authorityAnalysis.mostCitedExternalSources.length > 0 ? (
                                <div className="space-y-2">
                                  {reportData.metrics.authorityAnalysis.mostCitedExternalSources.map((dom: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs p-1.5 border border-white/5 bg-slate-950/20 rounded">
                                      <span className="font-semibold text-gray-300 truncate max-w-[120px] text-xs">{dom.name}</span>
                                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 font-mono">{dom.classification}</span>
                                      <span className="font-mono text-gray-400 font-bold text-xs">{dom.value}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 italic">{lang === "es" ? "No se detectaron otras fuentes externas." : "No other external sources detected."}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Competitor strengths & Checkpoints */}
                      <div className="bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-gold-custom" />
                          <span>{lang === "es" ? "Fortalezas del Competidor (Competitor Strengths)" : "Competitor Strengths"}</span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          {lang === "es"
                            ? "Factores y explicaciones dinámicas de por qué cada competidor es seleccionado por los modelos de IA."
                            : "Dynamic factors and explanations for why each competitor is recommended by generative search engines."}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(reportData.metrics.rankingFactors)
                            .filter(([domain]: [string, any]) => {
                              const targetDomainNormalized = (projectForm.domain || "").trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
                              return domain !== targetDomainNormalized;
                            })
                            .map(([domain, data]: [string, any]) => {
                              const strengthsList = lang === "es" ? data.strengths : data.strengthsEn;
                              return (
                                <div key={domain} className="p-4 border border-white/5 bg-slate-955/30 rounded-xl space-y-3">
                                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <h4 className="text-sm font-bold text-white">{domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1)}</h4>
                                    <span className="text-xs text-gray-500 font-mono">{domain}</span>
                                  </div>
                                  
                                  {strengthsList.length > 0 ? (
                                    <ul className="space-y-2">
                                      {strengthsList.map((strength: string, i: number) => (
                                        <li key={i} className="text-xs text-gray-300 font-medium leading-relaxed">
                                          {strength}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-gray-500 italic">{lang === "es" ? "No se registraron fortalezas competitivas en esta auditoría." : "No competitive strengths registered in this run."}</p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* 4. Opportunity Analysis - Questions Brand Missing and Competitor Found */}
                      <div className="bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 font-mono uppercase tracking-widest flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-gold-custom" />
                          <span>{lang === "es" ? "Oportunidades de Alta Prioridad" : "High Priority Opportunities"}</span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          {lang === "es"
                            ? "Consultas clave del comprador donde tu marca no aparece citada pero tus competidores directos sí."
                            : "Key buyer intents where your brand is missing but your competitors are cited."}
                        </p>

                        {reportData.metrics.opportunityAnalysis.length > 0 ? (
                          <div className="space-y-3.5">
                            {reportData.metrics.opportunityAnalysis.map((opp: any, idx: number) => (
                              <div key={idx} className="p-4 border border-red-500/10 bg-red-500/[0.02] hover:border-red-500/20 rounded-xl space-y-3 transition-all">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-white/5 pb-2">
                                  <span className="text-sm font-extrabold text-white">
                                    {lang === "es" ? `Pregunta: "${opp.questionText}"` : `Question: "${opp.questionText}"`}
                                  </span>
                                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-red-500/20 bg-red-500/10 text-red-300 max-w-fit">
                                    {lang === "es" ? "ALTA PRIORIDAD" : "HIGH PRIORITY"}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  <div className="space-y-1">
                                    <p className="text-gray-450 font-semibold">
                                      {lang === "es" ? "Competidores Encontrados:" : "Competitors Found:"}
                                    </p>
                                    <p className="text-gray-200 font-bold">{opp.competitorsFound.join(", ")}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-gray-450 font-semibold">
                                      {lang === "es" ? "Dominios Citados:" : "Domains Cited:"}
                                    </p>
                                    <p className="text-gray-400 font-mono truncate">{opp.domainsCited.join(", ")}</p>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                  <p className="text-xs text-gray-300">
                                    <strong className="text-gold-custom">{lang === "es" ? "Acción Recomendada: " : "Recommended Action: "}</strong>
                                    {lang === "es" ? opp.recommendedAction : opp.recommendedActionEn}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center border border-white/5 bg-slate-950/20 rounded-xl">
                            <CheckCircle2 className="w-8 h-8 text-gold-custom mx-auto mb-2 opacity-80" />
                            <p className="text-xs text-gray-400">
                              {lang === "es"
                                ? "¡Excelente! No hay brechas de alta prioridad donde los competidores aparezcan y tu marca esté ausente."
                                : "Excellent! There are no high priority gaps where competitors are present and your brand is absent."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* BLOCK 3: Actionable recommendations (Content Gaps) */}
                  {reportTab === "opportunities" && (
                    <div className="space-y-6">
                      <div className="border-l-2 border-gold-custom pl-3">
                        <h2 className="text-base font-bold text-white uppercase tracking-wider">
                          {lang === "es" ? "Plan de Acción de Visibilidad de IA" : "AI Visibility Action Plan"}
                        </h2>
                        <p className="text-xs text-gray-500">
                          {lang === "es"
                            ? "Recomendaciones estratégicas ordenadas por prioridad para mejorar tu presencia y autoridad en motores conversacionales."
                            : "Strategic recommendations sorted by priority to improve your presence and authority in conversational engines."}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {/* 1. HIGH PRIORITY Accordion */}
                        <div className="bg-card-bg border border-border-custom rounded-xl overflow-hidden">
                          <button
                            onClick={() => setOpenPriorities(prev => ({ ...prev, High: !prev.High }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-950/20 hover:bg-slate-950/40 border-b border-border-custom/50 text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                              <span className="text-sm font-bold text-white uppercase tracking-widest font-mono">
                                {lang === "es" ? "Prioridad Alta - Mejoras Directas de Visibilidad" : "High Priority - Direct Visibility Uplift"}
                              </span>
                              <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/10 text-red-300 font-mono">
                                {reportData.metrics.actionPlan.filter((a: any) => a.priority === "High").length} {lang === "es" ? "Recomendaciones" : "Recommendations"}
                              </span>
                            </div>
                            {openPriorities.High ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </button>
                          
                          {openPriorities.High && (
                            <div className="p-5 space-y-3 bg-slate-950/[0.05]">
                              {reportData.metrics.actionPlan.filter((a: any) => a.priority === "High").map((act: any, idx: number) => (
                                <div key={idx} className="flex gap-3 p-3 border border-red-500/10 bg-red-500/[0.01] rounded-xl hover:border-red-500/20 transition-all text-sm">
                                  <div className="p-1 rounded bg-red-500/10 text-red-400 h-fit">
                                    <Zap className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-gray-200">{lang === "es" ? act.action : act.actionEn}</p>
                                    <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{lang === "es" ? "Tipo: Creación de Contenido" : "Type: Content Creation"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 2. MEDIUM PRIORITY Accordion */}
                        <div className="bg-card-bg border border-border-custom rounded-xl overflow-hidden">
                          <button
                            onClick={() => setOpenPriorities(prev => ({ ...prev, Medium: !prev.Medium }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-950/20 hover:bg-slate-950/40 border-b border-border-custom/50 text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                              <span className="text-sm font-bold text-white uppercase tracking-widest font-mono">
                                {lang === "es" ? "Prioridad Media - Construcción de Autoridad" : "Medium Priority - Authority Building"}
                              </span>
                              <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded border border-orange-500/20 bg-orange-500/10 text-orange-300 font-mono">
                                {reportData.metrics.actionPlan.filter((a: any) => a.priority === "Medium").length} {lang === "es" ? "Recomendaciones" : "Recommendations"}
                              </span>
                            </div>
                            {openPriorities.Medium ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </button>
                          
                          {openPriorities.Medium && (
                            <div className="p-5 space-y-3 bg-slate-955/[0.05]">
                              {reportData.metrics.actionPlan.filter((a: any) => a.priority === "Medium").map((act: any, idx: number) => (
                                <div key={idx} className="flex gap-3 p-3 border border-orange-500/10 bg-orange-500/[0.01] rounded-xl hover:border-orange-500/20 transition-all text-sm">
                                  <div className="p-1 rounded bg-orange-500/10 text-orange-400 h-fit">
                                    <Layers className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-gray-200">{lang === "es" ? act.action : act.actionEn}</p>
                                    <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{lang === "es" ? "Tipo: Autoridad Externa" : "Type: External Authority"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. LOW PRIORITY Accordion */}
                        <div className="bg-card-bg border border-border-custom rounded-xl overflow-hidden">
                          <button
                            onClick={() => setOpenPriorities(prev => ({ ...prev, Low: !prev.Low }))}
                            className="w-full flex items-center justify-between p-4 bg-slate-955/20 hover:bg-slate-955/40 border-b border-border-custom/50 text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                              <span className="text-sm font-bold text-white uppercase tracking-widest font-mono">
                                {lang === "es" ? "Prioridad Baja - Optimización Técnica" : "Low Priority - Technical Optimization"}
                              </span>
                              <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-300 font-mono">
                                {reportData.metrics.actionPlan.filter((a: any) => a.priority === "Low").length} {lang === "es" ? "Recomendaciones" : "Recommendations"}
                              </span>
                            </div>
                            {openPriorities.Low ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </button>
                          
                          {openPriorities.Low && (
                            <div className="p-5 space-y-3 bg-slate-955/[0.05]">
                              {reportData.metrics.actionPlan.filter((a: any) => a.priority === "Low").map((act: any, idx: number) => (
                                <div key={idx} className="flex gap-3 p-3 border border-blue-500/10 bg-blue-500/[0.01] rounded-xl hover:border-blue-500/20 transition-all text-sm">
                                  <div className="p-1 rounded bg-blue-500/10 text-blue-400 h-fit">
                                    <SettingsIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-gray-200">{lang === "es" ? act.action : act.actionEn}</p>
                                    <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{lang === "es" ? "Tipo: Metadatos y Estructura" : "Type: Metadata & Structure"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {reportTab === "comparison" && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Engine Comparison Header & Question Selector */}
                      <div className="bg-card-bg border border-border-custom rounded-xl p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                              {lang === "es" ? "Analizador Comparativo de Motores" : "Comparative Engine Analyzer"}
                            </h3>
                            <p className="text-[10px] text-gray-500 leading-normal">
                              {lang === "es" 
                                ? "Compara las respuestas, citas y el Share of Voice estimado entre los tres principales motores de búsqueda de IA." 
                                : "Compare answers, citations, and estimated Share of Voice between the three primary AI search engines."}
                            </p>
                          </div>
                          
                          <select
                            value={comparisonQuestionIdx}
                            onChange={(e) => setComparisonQuestionIdx(Number(e.target.value))}
                            className="px-3.5 py-2 bg-slate-955 border border-white/10 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-gold-custom font-mono cursor-pointer max-w-full sm:max-w-xs"
                          >
                            {reportData.metrics.questionsDetail.map((q: any, idx: number) => (
                              <option key={idx} value={idx}>
                                {idx + 1}. {q.questionText}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Engine Cards Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {(["perplexity", "openai", "gemini"] as const).map((eng) => {
                          const qText = reportData.metrics.questionsDetail[comparisonQuestionIdx]?.questionText || "";
                          const qDefault = reportData.metrics.questionsDetail[comparisonQuestionIdx]?.answer || "";
                          const engineData = getEngineSimulatedData(eng, qText, qDefault);
                          const isActualRunEngine = reportData?.run?.provider?.toLowerCase().includes(eng);
                          
                          return (
                            <div 
                              key={eng} 
                              className={`bg-card-bg border rounded-xl overflow-hidden flex flex-col justify-between transition-all duration-300 ${
                                isActualRunEngine 
                                  ? 'border-gold-custom/50 shadow-[0_0_20px_rgba(212,160,23,0.12)] scale-[1.01]' 
                                  : 'border-border-custom hover:border-white/15'
                              }`}
                            >
                              <div className="p-5 space-y-4">
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${
                                      eng === "perplexity" ? "bg-emerald-400" : eng === "openai" ? "bg-sky-400" : "bg-purple-400"
                                    }`} />
                                    <span className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                                      {eng === "perplexity" ? "Perplexity AI" : eng === "openai" ? "OpenAI Search" : "Google Gemini"}
                                    </span>
                                  </div>
                                  
                                  {isActualRunEngine ? (
                                    <span className="text-[7px] font-bold text-gold-custom border border-gold-custom/30 bg-gold-custom/10 px-1.5 py-0.2 rounded animate-pulse">
                                      {lang === "es" ? "EJECUCIÓN REAL" : "LIVE RUN"}
                                    </span>
                                  ) : (
                                    <span className="text-[7px] font-bold text-gray-500 border border-white/5 bg-white/5 px-1.5 py-0.2 rounded">
                                      {lang === "es" ? "SIMULADO" : "SIMULATED"}
                                    </span>
                                  )}
                                </div>

                                {/* Visibility score bar */}
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center text-[10px] font-mono">
                                    <span className="text-gray-500 uppercase">{lang === "es" ? "Presencia Estimada" : "Estimated Presence"}</span>
                                    <span className={`${isActualRunEngine ? 'text-gold-custom font-extrabold' : 'text-gray-300 font-semibold'}`}>
                                      {engineData.sov}% SOV
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        eng === "perplexity" ? "bg-emerald-500" : eng === "openai" ? "bg-sky-500" : "bg-purple-500"
                                      }`}
                                      style={{ width: `${engineData.sov}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Response */}
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-semibold block">
                                    {lang === "es" ? "RESPUESTA GENERADA" : "GENERATED RESPONSE"}
                                  </span>
                                  <p className="text-gray-300 font-sans text-xs leading-relaxed whitespace-pre-wrap bg-black/35 p-3 rounded border border-white/5 min-h-[150px] font-normal">
                                    {engineData.answer}
                                  </p>
                                </div>

                                {/* Citations */}
                                <div className="space-y-2">
                                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-semibold block">
                                    {lang === "es" ? "FUENTES DE CITAS" : "CITED SOURCE DOMAINS"}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                    {engineData.citations.map((cit: string, cIdx: number) => {
                                      const isSelf = cit.toLowerCase().includes((projectForm.domain || "").toLowerCase().trim());
                                      return (
                                        <span 
                                          key={cIdx} 
                                          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border transition-all ${
                                            isSelf 
                                              ? 'bg-gold-custom/10 border-gold-custom/30 text-gold-custom font-extrabold' 
                                              : 'bg-white/5 border-white/10 text-gray-400'
                                          }`}
                                        >
                                          {cit}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Optimization Strategy Advice */}
                              <div className="bg-white/[0.02] border-t border-white/5 p-4.5 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-mono text-gold-custom uppercase tracking-widest font-extrabold">
                                    💡 {lang === "es" ? "Estrategia para Elevar Posición" : "Elevation Strategy"}
                                  </span>
                                </div>
                                <p className="text-gray-450 text-xs leading-relaxed font-normal">
                                  {engineData.advice}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ); })()}
            </div>
        )}
      </section>

      {/* Raw Response JSON Inspector Modal (Step 4) */}
      {rawResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-905 border border-white/10 w-full max-w-lg rounded-xl overflow-hidden flex flex-col justify-between shadow-2xl">
            <div className="flex justify-between items-center bg-slate-950/60 px-4 py-3 border-b border-white/5">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-widest font-mono">{t.viewRawJson}</span>
              <button
                onClick={() => setRawResponseModal(null)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-[360px]">
              <pre className="text-[10px] font-mono text-gold-custom bg-black/60 p-3 rounded-lg border border-white/5 overflow-x-auto leading-relaxed">
                {JSON.stringify(rawResponseModal, null, 2)}
              </pre>
            </div>
            <div className="bg-slate-950/40 p-3 border-t border-white/5 text-right">
              <button
                onClick={() => setRawResponseModal(null)}
                className="px-4 py-1.5 bg-gold-custom hover:bg-gold-hover text-black text-xs font-bold rounded cursor-pointer"
              >
                {t.closeInspector}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for KPI / Objective Cards */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
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
                const metrics = reportData?.metrics;
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
                          <span className="text-3xl font-black text-gold-custom font-mono">{metrics.newKpis?.visibilityScore}%</span>
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

      {/* Step 2 AI Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#0D121B] border border-gold-custom/20 w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xl relative max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-slate-950/60 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded bg-gold-custom/10 flex items-center justify-center border border-gold-custom/30">
                  <Eye className="w-3.5 h-3.5 text-gold-custom" />
                </div>
                <div>
                  <span className="text-xs font-black text-gold-custom uppercase tracking-wider font-mono block leading-none">
                    {lang === "es" ? "Vista Previa de Respuesta IA" : "AI Answer Preview"}
                  </span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mt-1 block">
                    {lang === "es" ? "Diagnóstico de Renderización Individual" : "Individual Render Diagnostics"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewQuestion(null);
                  setPreviewResponse(null);
                  setPreviewError(null);
                }}
                className="text-gray-550 hover:text-white transition-colors cursor-pointer p-1.5 hover:bg-white/5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5 text-sm text-gray-300">
              {/* Question Text */}
              <div className="bg-slate-955 border border-white/5 p-4 rounded-xl space-y-1.5">
                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                  {lang === "es" ? "PREGUNTA SELECCIONADA" : "SELECTED INTENT QUERY"}
                </span>
                <p className="text-gray-200 text-xs font-semibold leading-relaxed">
                  {previewQuestion.text}
                </p>
              </div>

              {/* Engine Selector */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest font-bold block">
                  {lang === "es" ? "SELECCIONAR MOTOR DE IA" : "SELECT GENERATIVE ENGINE"}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "perplexity", label: "Perplexity", sub: "Sonar Search", color: "from-emerald-500/[0.03]" },
                    { id: "openai", label: "OpenAI Search", sub: "gpt-4o Web", color: "from-sky-500/[0.03]" },
                    { id: "gemini", label: "Google Gemini", sub: "Search Ground", color: "from-purple-500/[0.03]" },
                    { id: "mock", label: "Simulated Data", sub: "Local Mock", color: "from-blue-500/[0.03]" },
                  ].map((engine) => {
                    const isSelected = previewEngine === engine.id;
                    return (
                      <button
                        key={engine.id}
                        onClick={() => {
                          setPreviewEngine(engine.id);
                          setPreviewResponse(null);
                          setPreviewError(null);
                        }}
                        className={`p-3 border rounded-xl flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                          isSelected
                            ? "border-gold-custom bg-gradient-to-br " + engine.color + " to-transparent shadow-[0_0_15px_rgba(212,160,23,0.08)]"
                            : "border-white/5 bg-slate-950/40 hover:border-white/10 hover:bg-slate-950/80"
                        }`}
                      >
                        <span className={`text-xs font-black tracking-tight ${isSelected ? "text-gold-custom" : "text-gray-300"}`}>
                          {engine.label}
                        </span>
                        <span className="text-[8px] font-mono text-gray-550 uppercase tracking-widest">
                          {engine.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inline Key Override if needed */}
              {["perplexity", "openai", "gemini"].includes(previewEngine) && (
                <div className="bg-slate-955 border border-white/[0.04] p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-mono text-gray-400 uppercase tracking-widest font-bold">
                      {previewEngine === "perplexity" ? (lang === "es" ? "Clave API de Perplexity" : "Perplexity API Key") :
                       previewEngine === "openai" ? (lang === "es" ? "Clave API de OpenAI" : "OpenAI API Key") :
                       (lang === "es" ? "Clave API de Gemini" : "Gemini API Key")}
                    </label>
                    <span className="text-[8px] font-mono text-gold-custom bg-gold-custom/5 px-2 py-0.5 rounded border border-gold-custom/15 font-black uppercase">
                      {lang === "es" ? "SOBRESCRITURA DE SESIÓN" : "SESSION OVERRIDE"}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-gray-500">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={
                        previewEngine === "perplexity" ? perplexityKey :
                        previewEngine === "openai" ? openaiKey :
                        geminiKey
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (previewEngine === "perplexity") {
                          setPerplexityKey(val);
                          localStorage.setItem("pplx_key_override", val.trim());
                        } else if (previewEngine === "openai") {
                          setOpenaiKey(val);
                          localStorage.setItem("openai_key_override", val.trim());
                        } else {
                          setGeminiKey(val);
                          localStorage.setItem("gemini_key_override", val.trim());
                        }
                      }}
                      placeholder={
                        previewEngine === "perplexity" ? "pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" :
                        previewEngine === "openai" ? "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" :
                        "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-white/5 hover:border-white/10 focus:border-gold-custom focus:ring-1 focus:ring-gold-custom/30 rounded-lg text-xs text-gray-200 placeholder-gray-600 font-mono transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Action Trigger */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleRunPreview}
                  disabled={previewLoading}
                  className="flex items-center gap-2 bg-gradient-to-r from-gold-custom to-amber-500 hover:from-gold-hover hover:to-amber-600 text-black font-black px-6 py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 transform hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md shadow-gold-custom/10 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {previewLoading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === "es" ? "Consultando..." : "Querying..."}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>{lang === "es" ? "Probar Consulta" : "Run Test Query"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Results Section */}
              <div className="space-y-3.5 pt-3.5 border-t border-white/[0.05]">
                {previewLoading && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 animate-pulse">
                    <div className="h-6 w-6 rounded-full border-2 border-gold-custom border-t-transparent animate-spin shrink-0" />
                    <span className="text-xs text-gray-500 font-mono tracking-widest uppercase">
                      {lang === "es" ? "Consultando motor en tiempo real..." : "Consulting generative engine..."}
                    </span>
                  </div>
                )}

                {previewError && (
                  <div className="flex items-start gap-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-4 rounded-xl animate-fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold block uppercase font-mono tracking-wide">
                        {lang === "es" ? "Error de Consulta" : "API Query Error"}
                      </span>
                      <p className="leading-relaxed">{previewError}</p>
                    </div>
                  </div>
                )}

                {previewResponse && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Answer Block */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-mono text-gray-550 uppercase tracking-widest font-bold block">
                        {lang === "es" ? "RESPUESTA GENERADA" : "GENERATED RESPONSE"}
                      </span>
                      <div className="bg-[#05070A]/50 border border-white/5 p-4.5 rounded-xl text-xs text-gray-300 leading-relaxed font-sans max-h-56 overflow-y-auto whitespace-pre-wrap">
                        {previewResponse.answer || (lang === "es" ? "Respuesta vacía." : "Empty answer response.")}
                      </div>
                    </div>

                    {/* Citations Block */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-mono text-gray-550 uppercase tracking-widest font-bold block">
                        {lang === "es" ? "FUENTES Y CITAS EXTRACTADAS" : "EXTRACTED CITATIONS & SOURCES"}
                      </span>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {previewResponse.citations && previewResponse.citations.length > 0 ? (
                          previewResponse.citations.map((c: any, index: number) => {
                            const isTarget = c.classification === "target";
                            const isCompetitor = c.classification === "competitor";
                            return (
                              <div
                                key={index}
                                className={`flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border font-mono text-xs transition-all ${
                                  isTarget ? "border-gold-custom/25 bg-gold-custom/[0.01]" :
                                  isCompetitor ? "border-red-500/15 bg-red-500/[0.01]" :
                                  "border-white/5"
                                }`}
                              >
                                <div className="flex flex-col min-w-0 pr-3">
                                  <span className="text-gray-200 font-bold truncate max-w-[420px]">
                                    {c.title || c.domain}
                                  </span>
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-gray-500 hover:text-gold-custom transition-colors truncate max-w-[400px] flex items-center gap-1.5 mt-0.5"
                                  >
                                    <span>{c.url}</span>
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                  </a>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${
                                  isTarget ? "bg-gold-custom/10 text-gold-custom border-gold-custom/25" :
                                  isCompetitor ? "bg-red-500/10 text-red-300 border-red-500/20" :
                                  "bg-white/5 text-gray-400 border-white/5"
                                }`}>
                                  {c.classification}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-gray-500 italic text-xs py-1.5">
                            {lang === "es" ? "No se detectaron citas en la respuesta." : "No citations detected in this response."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950/40 p-4 border-t border-white/5 text-right flex justify-between items-center">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                {lang === "es" ? "MODO DIAGNÓSTICO PREVIO" : "DIAGNOSTIC PREVIEW MODE"}
              </span>
              <button
                onClick={() => {
                  setPreviewQuestion(null);
                  setPreviewResponse(null);
                  setPreviewError(null);
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-all uppercase tracking-wider"
              >
                {lang === "es" ? "Cerrar" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

