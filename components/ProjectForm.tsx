"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Globe, Building2, BookOpen, AlertCircle, ArrowRight } from "lucide-react";

export default function ProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    domain: "",
    description: "",
    competitors: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic client validations
    if (!form.company_name.trim()) {
      setError("El nombre de la empresa es obligatorio");
      setLoading(false);
      return;
    }
    if (!form.domain.trim()) {
      setError("El dominio de la empresa es obligatorio");
      setLoading(false);
      return;
    }
    if (!form.description.trim()) {
      setError("La descripción/categoría es obligatoria");
      setLoading(false);
      return;
    }

    try {
      // Parse competitors comma-separated string to list
      const competitorsArray = form.competitors
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          domain: form.domain.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, ""),
          description: form.description.trim(),
          competitors: competitorsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al crear el proyecto");
      }

      // Success, route to the questions setup screen
      router.push(`/project/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Error de red al crear el proyecto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 text-red-200 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Company Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Nombre de la Empresa
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Building2 className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            required
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            placeholder="Ej: Atlas Copco"
            className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all"
            disabled={loading}
          />
        </div>
      </div>

      {/* Target Domain */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Dominio de la Empresa (Target Domain)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Globe className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            required
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            placeholder="Ej: atlascopco.com"
            className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all"
            disabled={loading}
          />
        </div>
      </div>

      {/* Category / Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Categoría de Producto / Industria
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 pt-3 flex items-start pointer-events-none">
            <BookOpen className="h-4 w-4 text-gray-400" />
          </div>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej: compresores de aire industriales y soluciones de energía"
            className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all resize-none"
            disabled={loading}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          La descripción sirve para alimentar el LLM y generar preguntas de intención de compra contextuales.
        </p>
      </div>

      {/* Competitor Domains */}
      <div>
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Dominios de Competidores (Separados por coma)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Plus className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={form.competitors}
            onChange={(e) => setForm({ ...form, competitors: e.target.value })}
            placeholder="Ej: ingersollrand.com, kaeser.com"
            className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-all"
            disabled={loading}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm shadow-lg shadow-indigo-950/50 hover:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Generando preguntas...</span>
          </>
        ) : (
          <>
            <span>Crear Proyecto</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
