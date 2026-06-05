import { DashboardMetrics } from "./analytics";

export interface Recommendation {
  id: string;
  type: "warning" | "opportunity" | "competitor" | "success";
  title: string;
  description: string;
}

function getCategory(text: string): "Informational" | "Comparison" | "Commercial" | "High Intent" {
  const q = text.toLowerCase();
  if (
    q.includes("vs") ||
    q.includes("alternativas") ||
    q.includes("comparar") ||
    q.includes("comparativa") ||
    q.includes("alternative") ||
    q.includes("compare")
  ) {
    return "Comparison";
  }
  if (
    q.includes("comprar") ||
    q.includes("precio") ||
    q.includes("costo") ||
    q.includes("adquirir") ||
    q.includes("buy") ||
    q.includes("price") ||
    q.includes("cost")
  ) {
    return "High Intent";
  }
  if (
    q.includes("mejor") ||
    q.includes("lidera") ||
    q.includes("proveedor") ||
    q.includes("empresa") ||
    q.includes("best") ||
    q.includes("lead") ||
    q.includes("provider") ||
    q.includes("company")
  ) {
    return "Commercial";
  }
  return "Informational";
}

/**
 * Evaluates audit metrics to produce deterministic recommendations.
 */
export function generateRecommendations(
  metrics: DashboardMetrics,
  companyName: string,
  lang: "es" | "en" = "en"
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const isEs = lang === "es";

  // 1. Share of Voice general assessment
  if (metrics.shareOfVoice === 0) {
    recommendations.push({
      id: "sov_none",
      type: "warning",
      title: isEs ? "Visibilidad Crítica en Buscadores de IA" : "Critical Visibility in AI Search Engines",
      description: isEs
        ? `${companyName} no fue mencionado ni citado en ninguna de las preguntas analizadas. Los modelos de IA no disponen de fuentes referenciales estructuradas de tu empresa. Es crítico crear contenidos optimizados para buscadores conversacionales (AEO).`
        : `${companyName} was not mentioned or cited in any of the analyzed queries. AI models do not have structured referential sources for your company. It is critical to create content optimized for conversational search engines (AEO).`,
    });
  } else if (metrics.shareOfVoice < 30) {
    recommendations.push({
      id: "sov_low",
      type: "warning",
      title: isEs ? "Baja Visibilidad (Share of Voice < 30%)" : "Low Visibility (Share of Voice < 30%)",
      description: isEs
        ? `Tu presencia es de solo el ${metrics.shareOfVoice}%. Te sugerimos priorizar la redacción de páginas comparativas ("${companyName} vs competidores") e incorporar guías que respondan a la intención de compra directa del usuario.`
        : `Your presence is only ${metrics.shareOfVoice}%. We suggest prioritizing comparison pages ("${companyName} vs competitors") and incorporating guides that answer the user's direct buyer intent queries.`,
    });
  } else if (metrics.shareOfVoice >= 70) {
    recommendations.push({
      id: "sov_high",
      type: "success",
      title: isEs ? "Dominio de Citas Destacado (SOV ≥ 70%)" : "Outstanding Citation Dominance (SOV ≥ 70%)",
      description: isEs
        ? `¡Felicitaciones! Apareces citado en el ${metrics.shareOfVoice}% de las respuestas. Para mantener el liderazgo, asegúrate de mantener actualizadas tus hojas de producto y el marcado estructurado de datos.`
        : `Congratulations! You are cited in ${metrics.shareOfVoice}% of the responses. To maintain leadership, make sure to keep your product sheets and structured data markup updated.`,
    });
  } else {
    recommendations.push({
      id: "sov_medium",
      type: "opportunity",
      title: isEs ? `Visibilidad Moderada (SOV ${metrics.shareOfVoice}%)` : `Moderate Visibility (SOV ${metrics.shareOfVoice}%)`,
      description: isEs
        ? `Apareces en ${metrics.targetPresenceCount} de las ${metrics.totalQuestions} consultas. Para incrementar el porcentaje de menciones, fomenta que tus clientes escriban opiniones en directorios externos y optimiza las descripciones de tu web.`
        : `You appear in ${metrics.targetPresenceCount} out of ${metrics.totalQuestions} queries. To increase your mention share, encourage customers to write reviews on third-party directories and optimize your website descriptions.`,
    });
  }

  // 2. Intent Category Funnel Gaps
  const categoryPresence: Record<string, { total: number; present: number }> = {
    Informational: { total: 0, present: 0 },
    Comparison: { total: 0, present: 0 },
    Commercial: { total: 0, present: 0 },
    "High Intent": { total: 0, present: 0 },
  };

  metrics.questionsDetail.forEach((q) => {
    const cat = getCategory(q.questionText);
    categoryPresence[cat].total++;
    if (q.appeared) {
      categoryPresence[cat].present++;
    }
  });

  const transactionalTotal = categoryPresence["Comparison"].total + categoryPresence["High Intent"].total;
  const transactionalPresent = categoryPresence["Comparison"].present + categoryPresence["High Intent"].present;
  const transactionalSOV = transactionalTotal > 0 ? (transactionalPresent / transactionalTotal) * 100 : 100;

  const topFunnelTotal = categoryPresence["Informational"].total + categoryPresence["Commercial"].total;
  const topFunnelPresent = categoryPresence["Informational"].present + categoryPresence["Commercial"].present;
  const topFunnelSOV = topFunnelTotal > 0 ? (topFunnelPresent / topFunnelTotal) * 100 : 0;

  if (transactionalSOV < 40 && topFunnelSOV >= 40) {
    recommendations.push({
      id: "adv_intent_transactional_gap",
      type: "opportunity",
      title: isEs ? "Optimización de Intención Transaccional (Fondo del Embudo)" : "Transactional Intent Optimization (Bottom-Funnel)",
      description: isEs
        ? "Tu marca es visible en búsquedas informativas pero pierde tracción en comparativas directas y consultas de alta intención de compra. Te recomendamos estructurar hojas de precios claras, tablas comparativas explícitas con competidores y páginas de producto optimizadas con marcado schema."
        : "Your brand is visible in informational queries but loses traction in direct comparisons and high-intent queries. We recommend structuring clear pricing sheets, explicit comparison tables with competitors, and optimized product pages with schema markup.",
    });
  } else if (topFunnelSOV < 40 && transactionalSOV >= 40) {
    recommendations.push({
      id: "adv_intent_awareness_gap",
      type: "opportunity",
      title: isEs ? "Falta de Presencia en Descubrimiento (Parte Alta del Embudo)" : "Lack of Discovery Presence (Top-Funnel)",
      description: isEs
        ? "Eres citado en consultas transaccionales directas, pero estás ausente cuando los usuarios investigan soluciones generales de la categoría. Considera crear guías definitivas de la industria y blogs educativos para que los buscadores de IA te clasifiquen como un líder de pensamiento."
        : "You are cited in direct transactional queries but are absent when users research general category solutions. Consider creating definitive industry guides and educational blogs so AI search engines classify you as a thought leader.",
    });
  }

  // 3. Authority Review Site Gaps
  const reviewSitesCited = new Set<string>();
  let targetAbsentInReviews = false;

  metrics.questionsDetail.forEach((q) => {
    if (!q.appeared) {
      const reviews = q.citations?.filter((c) => c.classification === "review") || [];
      reviews.forEach((r) => reviewSitesCited.add(r.domain));
      if (reviews.length > 0) {
        targetAbsentInReviews = true;
      }
    }
  });

  if (targetAbsentInReviews && reviewSitesCited.size > 0) {
    const sampleSites = Array.from(reviewSitesCited).slice(0, 3).join(", ");
    recommendations.push({
      id: "adv_review_gap",
      type: "warning",
      title: isEs ? "Brecha de Presencia en Directorios de Opinión B2B" : "Visibility Gap in B2B Review Directories",
      description: isEs
        ? `Los motores de IA citan portales de opiniones (${sampleSites}) para responder consultas donde tu marca está ausente. Los indexadores de LLMs utilizan estas plataformas para extraer opiniones consolidadas de clientes. Sugerimos lanzar una campaña activa de recolección de reseñas en estos directorios para forzar tu indexación.`
        : `AI engines cite review portals (${sampleSites}) to answer queries where your brand is absent. LLM indexers leverage these platforms to extract consolidated customer feedback. We suggest launching an active review generation campaign on these directories to force indexing.`,
    });
  }

  // 4. Competitor intent dominance assessment
  const compCitations: Record<string, number> = {};
  let totalCompCitations = 0;

  metrics.questionsDetail.forEach((q) => {
    const cat = getCategory(q.questionText);
    if (cat === "Comparison" || cat === "High Intent") {
      const comps = q.citations?.filter((c) => c.classification === "competitor") || [];
      comps.forEach((c) => {
        compCitations[c.domain] = (compCitations[c.domain] || 0) + 1;
        totalCompCitations++;
      });
    }
  });

  if (totalCompCitations > 0) {
    const sortedComps = Object.entries(compCitations).sort((a, b) => b[1] - a[1]);
    const topComp = sortedComps[0];
    const percentage = Math.round((topComp[1] / totalCompCitations) * 100);

    if (percentage >= 35) {
      recommendations.push({
        id: "adv_competitor_dominance_intent",
        type: "competitor",
        title: isEs ? `Dominio de Competidor en Intención de Compra: ${topComp[0]}` : `Competitor Intent Dominance: ${topComp[0]}`,
        description: isEs
          ? `El competidor "${topComp[0]}" domina el ${percentage}% de las citas en búsquedas críticas (comparativas y transaccionales). Analiza su arquitectura de URLs y páginas dedicadas a características de productos, ya que son el principal objetivo de los agentes de búsqueda de la IA.`
          : `The competitor "${topComp[0]}" dominates ${percentage}% of citations in critical queries (comparative and transactional). Analyze their URL structure and product feature landing pages, as they are the primary targets for AI search agents.`,
      });
    }
  }

  // 5. Competitor concentration assessment (fallback global check)
  const competitorDomains = metrics.topDomains.filter((d) => d.classification === "competitor");
  if (competitorDomains.length > 0 && recommendations.length < 5) {
    const primaryCompetitor = competitorDomains[0];
    const totalTopCitations = metrics.topDomains.reduce((sum, d) => sum + d.value, 0);
    const competitorShare = totalTopCitations > 0 ? Math.round((primaryCompetitor.value / totalTopCitations) * 100) : 0;

    if (competitorShare >= 20 && !recommendations.some(r => r.id === "adv_competitor_dominance_intent")) {
      recommendations.push({
        id: "comp_dominant",
        type: "competitor",
        title: isEs ? `Monitorear Competidor: ${primaryCompetitor.name}` : `Monitor Competitor: ${primaryCompetitor.name}`,
        description: isEs
          ? `El dominio "${primaryCompetitor.name}" acapara el ${competitorShare}% de las citas del Top 10. Es recomendable auditar los enlaces específicos de su sitio web citados por el motor de búsqueda para descifrar su estrategia de contenido.`
          : `The domain "${primaryCompetitor.name}" accounts for ${competitorShare}% of the Top 10 citations. It is recommended to audit the specific links of their website cited by the search engine to decipher their content strategy.`,
      });
    }
  }

  // 6. Question-level opportunities (up to 2 specific items to keep it clean)
  const opportunities = metrics.questionsDetail.filter((q) => q.isOpportunity);
  const targetOpps = opportunities.slice(0, 2);
  targetOpps.forEach((opp, index) => {
    recommendations.push({
      id: `opp_q_${index}`,
      type: "opportunity",
      title: isEs ? `Oportunidad en: "${opp.questionText}"` : `Opportunity in: "${opp.questionText}"`,
      description: opp.citationsCount === 0
        ? (isEs
            ? "El motor de búsqueda no citó ninguna fuente en esta consulta (respuesta pobre). Esto representa un vacío de mercado: escribe un artículo definitivo respondiendo precisamente a esta duda."
            : "The search engine did not cite any source in this query (poor response). This represents a market gap: write a definitive article answering precisely this question.")
        : (isEs
            ? `Tu empresa no aparece citada. Los portales referenciados por el motor de búsqueda en esta consulta son: ${opp.topDomains.join(", ") || "otros sitios de la industria"}. Te sugerimos crear una página de aterrizaje enfocada en resolver este tema.`
            : `Your company is not cited. The portals referenced by the search engine in this query are: ${opp.topDomains.join(", ") || "other industry sites"}. We suggest creating a landing page focused on resolving this topic.`),
    });
  });

  return recommendations;
}
