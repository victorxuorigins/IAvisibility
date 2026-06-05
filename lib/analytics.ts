import { AuditRunDetails } from "./db";

export interface DashboardMetrics {
  totalQuestions: number;
  targetPresenceCount: number;
  shareOfVoice: number; // percentage (0-100)
  topDomains: { name: string; value: number; classification: string }[];
  classificationBreakdown: { name: string; value: number; key: string }[];
  questionsDetail: {
    questionId: string;
    questionText: string;
    appeared: boolean;
    citationsCount: number;
    topDomains: string[];
    isOpportunity: boolean;
    answer: string;
    provider?: string;
    citations: {
      url: string;
      domain: string;
      title?: string;
      classification: "target" | "competitor" | "review" | "publication" | "other";
    }[];
  }[];
  totalOpportunities: number;
  detectedPotentialCompetitors?: { domain: string; count: number }[];
  
  // New Competitive positioning and ranking analytics fields
  competitorComparisons: {
    company: string;
    domain: string;
    isTarget: boolean;
    aiMentions: number;
    citationCount: number;
    thirdPartyCitations: number;
    reviewSitesFound: number;
    comparisonPagesFound: number;
    educationalCoverage: number;
    industryPubsFound: number;
    visibilityScore: number;
  }[];
  
  authorityAnalysis: {
    categoryCounts: { [category: string]: number };
    mostInfluentialDomains: { name: string; value: number; classification: string }[];
    mostCitedExternalSources: { name: string; value: number; classification: string }[];
  };

  rankingFactors: {
    [companyDomain: string]: {
      contentCoverage: {
        buyingGuides: boolean;
        comparisonArticles: boolean;
        bestTools: boolean;
        educationalContent: boolean;
        faqs: boolean;
      };
      externalAuthority: {
        reviewPlatforms: boolean;
        industryPublications: boolean;
        directories: boolean;
        thirdPartyArticles: boolean;
      };
      aiPresence: {
        mentions: number;
        citations: number;
        questionsAppeared: number;
        questionsMissing: number;
      };
      strengths: string[];
      strengthsEn: string[];
    };
  };

  opportunityAnalysis: {
    questionId: string;
    questionText: string;
    competitorsFound: string[];
    domainsCited: string[];
    recommendedAction: string;
    recommendedActionEn: string;
    priority: "High" | "Medium" | "Low";
  }[];

  actionPlan: {
    priority: "High" | "Medium" | "Low";
    action: string;
    actionEn: string;
    category: "content" | "authority" | "optimization";
  }[];

  newKpis: {
    visibilityScore: number;
    authorityScore: number;
    competitorDominanceScore: number;
    contentGapScore: number;
    opportunityScore: number;
  };
}

const GENERAL_EXCLUSIONS = new Set([
  "google.com",
  "github.com",
  "microsoft.com",
  "apple.com",
  "wikipedia.org",
  "youtube.com",
  "amazon.com",
  "aws.amazon.com",
  "linkedin.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "reddit.com",
  "medium.com",
  "stackoverflow.com",
  "w3.org",
  "vercel.app",
  "netlify.app",
  "git-scm.com",
  "npmtrends.com",
  "npmjs.com",
  "yarnpkg.com",
]);

function cleanDomain(d: string): string {
  return d.toLowerCase().replace(/^www\./, "").trim();
}

/**
 * Classifies a domain into the 7 requested categories.
 */
function classifyDomainForDisplay(
  domain: string,
  targetDomain: string,
  competitorDomains: string[]
): "Company Website" | "Competitor Website" | "Review Site" | "Industry Publication" | "Directory" | "Community / Forum" | "Unknown" {
  const cleanD = cleanDomain(domain);
  const cleanTarget = cleanDomain(targetDomain);
  const cleanComps = competitorDomains.map(cleanDomain);

  const isMatch = (d: string, t: string) => d === t || d.endsWith("." + t);

  if (isMatch(cleanD, cleanTarget)) return "Company Website";
  if (cleanComps.some(comp => comp && isMatch(cleanD, comp))) return "Competitor Website";

  const reviewSites = [
    "g2.com", "capterra.com", "trustradius.com", "softwareadvice.com",
    "getapp.com", "trustpilot.com", "tripadvisor.com", "yelp.com", "clutch.co"
  ];
  if (reviewSites.some(site => isMatch(cleanD, site))) return "Review Site";

  const communities = [
    "reddit.com", "quora.com", "stackoverflow.com", "github.com",
    "news.ycombinator.com", "medium.com", "facebook.com", "twitter.com",
    "linkedin.com", "instagram.com", "youtube.com"
  ];
  if (communities.some(site => isMatch(cleanD, site))) return "Community / Forum";

  const publications = [
    "forbes.com", "bloomberg.com", "techcrunch.com", "wsj.com",
    "nytimes.com", "economist.com", "reuters.com", "industryweek.com",
    "machinedesign.com", "gartner.com", "idc.com", "forrester.com",
    "hbr.org", "wired.com", "zdnet.com", "venturebeat.com"
  ];
  if (publications.some(site => isMatch(cleanD, site))) return "Industry Publication";

  const directories = [
    "yellowpages.com", "crunchbase.com", "zoominfo.com", "thomasnet.com",
    "dnb.com", "manta.com"
  ];
  if (directories.some(site => isMatch(cleanD, site))) return "Directory";

  return "Unknown";
}

/**
 * Aggregates audit run database records into structured metric calculations for frontend widgets.
 */
export function calculateDashboardMetrics(
  runDetails: AuditRunDetails,
  targetDomain: string,
  competitorDomainsInput: string[] = []
): DashboardMetrics {
  const { responses } = runDetails;
  const totalQuestions = responses.length;

  let targetPresenceCount = 0;
  const domainCounts: { [domain: string]: { count: number; classification: string } } = {};
  const classificationCounts: { [cls: string]: number } = {
    target: 0,
    competitor: 0,
    review: 0,
    publication: 0,
    other: 0,
  };

  const questionsDetail = responses.map((resp) => {
    const citations = resp.citations || [];
    const hasTarget = citations.some((c) => c.classification === "target");

    if (hasTarget) {
      targetPresenceCount++;
    }

    citations.forEach((c) => {
      if (c.domain) {
        const cleanD = c.domain.toLowerCase().trim();
        if (!domainCounts[cleanD]) {
          domainCounts[cleanD] = { count: 0, classification: c.classification };
        }
        domainCounts[cleanD].count++;
      }
      classificationCounts[c.classification] = (classificationCounts[c.classification] || 0) + 1;
    });

    const topRespDomains = citations.slice(0, 3).map((c) => c.domain);
    const isOpportunity = !hasTarget || citations.length === 0;

    return {
      questionId: resp.question_id,
      questionText: resp.question_text,
      appeared: hasTarget,
      citationsCount: citations.length,
      topDomains: topRespDomains,
      isOpportunity,
      answer: resp.answer,
      provider: resp.provider,
      citations,
    };
  });

  // Sort and filter the top 10 cited domains
  const topDomains = Object.entries(domainCounts)
    .map(([name, data]) => ({
      name,
      value: data.count,
      classification: data.classification,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const labelMap: { [key: string]: string } = {
    target: "Empresa Objetivo",
    competitor: "Competidores",
    review: "Sitios de Reseñas",
    publication: "Publicaciones / Noticias",
    other: "Otros",
  };

  const classificationBreakdown = Object.entries(classificationCounts)
    .map(([key, count]) => ({
      name: labelMap[key] || key,
      value: count,
      key,
    }))
    .filter((item) => item.value > 0);

  const shareOfVoice = totalQuestions > 0 ? Math.round((targetPresenceCount / totalQuestions) * 100) : 0;
  const totalOpportunities = questionsDetail.filter((q) => q.isOpportunity).length;

  const detectedPotentialCompetitors = Object.entries(domainCounts)
    .filter(([domain, data]) => {
      return (
        data.classification === "other" &&
        !GENERAL_EXCLUSIONS.has(domain) &&
        domain.includes(".") &&
        cleanDomain(domain) !== cleanDomain(targetDomain)
      );
    })
    .map(([domain, data]) => ({
      domain,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ----------------------------------------------------
  // EXTRACT ALL DETECTED COMPETITORS FROM RUN
  // ----------------------------------------------------
  const detectedCompetitorsSet = new Set<string>();
  responses.forEach((resp) => {
    (resp.citations || []).forEach((c) => {
      if (c.classification === "competitor" && c.domain) {
        detectedCompetitorsSet.add(cleanDomain(c.domain));
      }
    });
  });
  competitorDomainsInput.forEach(d => {
    if (d) detectedCompetitorsSet.add(cleanDomain(d));
  });
  const allCompetitorDomains = Array.from(detectedCompetitorsSet);

  // Helper to capitalize domains (e.g. kaeser.com -> Kaeser)
  const formatCompanyName = (domain: string): string => {
    const part = domain.split(".")[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  };

  // Helper check for third party attribution to a brand
  const isThirdPartyAboutBrand = (cit: any, brandDomain: string) => {
    const cleanCitDomain = cleanDomain(cit.domain);
    const cleanBrandDomain = cleanDomain(brandDomain);
    if (cleanCitDomain === cleanBrandDomain) return false;
    
    const brandName = formatCompanyName(brandDomain).toLowerCase();
    const urlLower = cit.url.toLowerCase();
    const titleLower = (cit.title || "").toLowerCase();
    return urlLower.includes(brandName) || urlLower.includes(cleanBrandDomain) || titleLower.includes(brandName);
  };

  // Helper to check content features
  const checkComparison = (title: string, url: string) => {
    const t = (title + " " + url).toLowerCase();
    return t.includes("vs") || t.includes("compare") || t.includes("comparison") || t.includes("comparar") || t.includes("comparativa") || t.includes("alternative") || t.includes("alternativa");
  };
  const checkGuide = (title: string, url: string) => {
    const t = (title + " " + url).toLowerCase();
    return t.includes("guide") || t.includes("buyer") || t.includes("guia") || t.includes("compra");
  };
  const checkBest = (title: string, url: string) => {
    const t = (title + " " + url).toLowerCase();
    return t.includes("best") || t.includes("mejor") || t.includes("top") || t.includes("lider");
  };
  const checkEdu = (title: string, url: string) => {
    const t = (title + " " + url).toLowerCase();
    return t.includes("how") || t.includes("what") || t.includes("que") || t.includes("como") || t.includes("education") || t.includes("learn") || t.includes("educacion") || t.includes("wiki");
  };
  const checkFaq = (title: string, url: string) => {
    const t = (title + " " + url).toLowerCase();
    return t.includes("faq") || t.includes("pregunta") || t.includes("question");
  };

  // ----------------------------------------------------
  // CALCULATE COMPARISONS FOR EACH COMPANY
  // ----------------------------------------------------
  const companiesList = [
    { company: formatCompanyName(targetDomain), domain: targetDomain, isTarget: true },
    ...allCompetitorDomains.map(d => ({ company: formatCompanyName(d), domain: d, isTarget: false }))
  ];

  const competitorComparisons = companiesList.map((comp) => {
    let aiMentions = 0;
    let citationCount = 0;
    let thirdPartyCitations = 0;
    let reviewSitesFound = 0;
    let comparisonPagesFound = 0;
    let educationalCoverage = 0;
    let industryPubsFound = 0;

    questionsDetail.forEach((q) => {
      let companyFoundInQuestion = false;

      q.citations.forEach((cit) => {
        const cleanCitDomain = cleanDomain(cit.domain);
        const cleanCompDomain = cleanDomain(comp.domain);
        const classification = classifyDomainForDisplay(cit.domain, targetDomain, allCompetitorDomains);

        const isDirect = cleanCitDomain === cleanCompDomain;
        const isThirdParty = isThirdPartyAboutBrand(cit, comp.domain);

        if (isDirect || isThirdParty) {
          companyFoundInQuestion = true;
          citationCount++;

          if (isThirdParty) {
            thirdPartyCitations++;
          }
          if (classification === "Review Site") {
            reviewSitesFound++;
          }
          if (checkComparison(cit.title || "", cit.url)) {
            comparisonPagesFound++;
          }
          if (checkEdu(cit.title || "", cit.url)) {
            educationalCoverage++;
          }
          if (classification === "Industry Publication") {
            industryPubsFound++;
          }
        }
      });

      if (companyFoundInQuestion) {
        aiMentions++;
      }
    });

    const visibilityScore = totalQuestions > 0 ? Math.round((aiMentions / totalQuestions) * 100) : 0;

    return {
      company: comp.company,
      domain: comp.domain,
      isTarget: comp.isTarget,
      aiMentions,
      citationCount,
      thirdPartyCitations,
      reviewSitesFound,
      comparisonPagesFound,
      educationalCoverage,
      industryPubsFound,
      visibilityScore
    };
  });

  // Sort: Target ALWAYS first, then competitors sorted by visibilityScore/citations
  const targetRow = competitorComparisons.find(r => r.isTarget);
  const competitorRows = competitorComparisons.filter(r => !r.isTarget).sort((a, b) => b.visibilityScore - a.visibilityScore || b.citationCount - a.citationCount);
  const sortedComparisons = targetRow ? [targetRow, ...competitorRows] : competitorRows;

  // ----------------------------------------------------
  // AUTHORITY ANALYSIS DESGLOSE
  // ----------------------------------------------------
  const authorityCounts: { [cat: string]: number } = {
    "Company Website": 0,
    "Competitor Website": 0,
    "Review Site": 0,
    "Industry Publication": 0,
    "Directory": 0,
    "Community / Forum": 0,
    "Unknown": 0
  };

  const domainDetailedCounts: { [domain: string]: { count: number; classification: string } } = {};

  responses.forEach((resp) => {
    (resp.citations || []).forEach((c) => {
      if (c.domain) {
        const cleanD = cleanDomain(c.domain);
        const classification = classifyDomainForDisplay(c.domain, targetDomain, allCompetitorDomains);
        authorityCounts[classification]++;

        if (!domainDetailedCounts[cleanD]) {
          domainDetailedCounts[cleanD] = { count: 0, classification };
        }
        domainDetailedCounts[cleanD].count++;
      }
    });
  });

  const sortedAllDetailed = Object.entries(domainDetailedCounts)
    .map(([name, data]) => ({
      name,
      value: data.count,
      classification: data.classification
    }))
    .sort((a, b) => b.value - a.value);

  const mostInfluentialDomains = sortedAllDetailed
    .filter(d => ["Review Site", "Industry Publication", "Directory"].includes(d.classification))
    .slice(0, 10);

  const mostCitedExternalSources = sortedAllDetailed
    .filter(d => d.name !== cleanDomain(targetDomain) && !allCompetitorDomains.map(cleanDomain).includes(d.name))
    .slice(0, 10);

  // ----------------------------------------------------
  // RANKING FACTORS DETECTION
  // ----------------------------------------------------
  const rankingFactors: { [domain: string]: any } = {};

  companiesList.forEach((comp) => {
    let buyingGuides = false;
    let comparisonArticles = false;
    let bestTools = false;
    let educationalContent = false;
    let faqs = false;

    let reviewPlatforms = false;
    let industryPublications = false;
    let directories = false;
    let thirdPartyArticles = false;

    let mentions = 0;
    let citations = 0;
    let questionsAppeared = 0;

    questionsDetail.forEach((q) => {
      let companyInQuestion = false;

      q.citations.forEach((cit) => {
        const cleanCitDomain = cleanDomain(cit.domain);
        const cleanCompDomain = cleanDomain(comp.domain);
        const classification = classifyDomainForDisplay(cit.domain, targetDomain, allCompetitorDomains);

        const isDirect = cleanCitDomain === cleanCompDomain;
        const isThirdParty = isThirdPartyAboutBrand(cit, comp.domain);

        if (isDirect || isThirdParty) {
          companyInQuestion = true;
          citations++;

          if (isThirdParty) {
            thirdPartyArticles = true;
          }

          if (checkComparison(cit.title || "", cit.url)) comparisonArticles = true;
          if (checkGuide(cit.title || "", cit.url)) buyingGuides = true;
          if (checkBest(cit.title || "", cit.url)) bestTools = true;
          if (checkEdu(cit.title || "", cit.url)) educationalContent = true;
          if (checkFaq(cit.title || "", cit.url)) faqs = true;

          if (classification === "Review Site") reviewPlatforms = true;
          if (classification === "Industry Publication") industryPublications = true;
          if (classification === "Directory") directories = true;
        }
      });

      if (companyInQuestion) {
        mentions++;
        questionsAppeared++;
      }
    });

    const questionsMissing = totalQuestions - questionsAppeared;

    const strengths: string[] = [];
    const strengthsEn: string[] = [];

    const compName = comp.company;

    if (comparisonArticles) {
      strengths.push(`✓ Aparece en artículos de comparación`);
      strengthsEn.push(`✓ Appears in comparison articles`);
    }
    if (industryPublications) {
      strengths.push(`✓ Citado por publicaciones de la industria`);
      strengthsEn.push(`✓ Cited by industry publications`);
    }
    if (reviewPlatforms) {
      strengths.push(`✓ Referenciado en múltiples sitios de reseñas`);
      strengthsEn.push(`✓ Referenced by multiple review sites`);
    }
    if (questionsAppeared > 0) {
      strengths.push(`✓ Mencionado en ${questionsAppeared} de ${totalQuestions} preguntas de intención de compra`);
      strengthsEn.push(`✓ Mentioned in ${questionsAppeared} of ${totalQuestions} buyer-intent questions`);
    }

    rankingFactors[comp.domain] = {
      contentCoverage: { buyingGuides, comparisonArticles, bestTools, educationalContent, faqs },
      externalAuthority: { reviewPlatforms, industryPublications, directories, thirdPartyArticles },
      aiPresence: { mentions, citations, questionsAppeared, questionsMissing },
      strengths,
      strengthsEn
    };
  });

  // ----------------------------------------------------
  // OPPORTUNITY ANALYSIS & ACTION PLAN
  // ----------------------------------------------------
  const opportunityAnalysis: any[] = [];

  questionsDetail.forEach((q) => {
    if (!q.appeared) {
      // Find competitors appearing in this question
      const compsFound: string[] = [];
      const domainsCited: string[] = [];

      q.citations.forEach((cit) => {
        const cleanCitDomain = cleanDomain(cit.domain);
        if (cleanCitDomain && !domainsCited.includes(cleanCitDomain)) {
          domainsCited.push(cleanCitDomain);
        }

        allCompetitorDomains.forEach((compDomain) => {
          if (cleanCitDomain === cleanDomain(compDomain) || isThirdPartyAboutBrand(cit, compDomain)) {
            const compName = formatCompanyName(compDomain);
            if (!compsFound.includes(compName)) {
              compsFound.push(compName);
            }
          }
        });
      });

      if (compsFound.length > 0) {
        const compStr = compsFound.join(", ");
        const questionTextLower = q.questionText.toLowerCase();

        let action = `Crear una página de comparación dirigida a "${q.questionText}" que resalte nuestras ventajas competitivas frente a ${compStr}.`;
        let actionEn = `Create a comparison page targeting "${q.questionText}" highlighting our competitive advantages vs ${compStr}.`;

        if (questionTextLower.includes("vs") || questionTextLower.includes("alternativ")) {
          action = `Publicar una guía comparativa o página alternativa del tipo "NuestraMarca vs ${compStr}" optimizada para búsquedas directas.`;
          actionEn = `Publish a comparative guide or alternative page like "OurBrand vs ${compStr}" optimized for direct searches.`;
        } else if (questionTextLower.includes("mejor") || questionTextLower.includes("best") || questionTextLower.includes("top")) {
          action = `Crear un artículo de listado "Las mejores soluciones..." e incluir a nuestra marca junto con la propuesta de valor diferenciada.`;
          actionEn = `Create a listing article "The best solutions..." and include our brand with a differentiated value proposition.`;
        }

        opportunityAnalysis.push({
          questionId: q.questionId,
          questionText: q.questionText,
          competitorsFound: compsFound,
          domainsCited: domainsCited.slice(0, 5),
          recommendedAction: action,
          recommendedActionEn: actionEn,
          priority: "High"
        });
      }
    }
  });

  // Action Plan builder
  const actionPlan: any[] = [];

  // 1. High Priority Actions
  if (opportunityAnalysis.length > 0) {
    actionPlan.push({
      priority: "High",
      action: "Crear páginas de comparación personalizadas enfocadas en las palabras clave y preguntas donde los competidores lideran.",
      actionEn: "Create custom comparison pages targeting key search queries where competitors are leading.",
      category: "content"
    });
  }
  
  const targetComparisons = sortedComparisons.find(c => c.isTarget);
  const targetComparisonPages = targetComparisons ? targetComparisons.comparisonPagesFound : 0;
  if (targetComparisonPages === 0) {
    actionPlan.push({
      priority: "High",
      action: "Crear guías de compra completas y listas de las mejores herramientas para el sector de mercado objetivo.",
      actionEn: "Create buyer guides and best tools listings targeting the specific industry segments.",
      category: "content"
    });
  }

  // 2. Medium Priority Actions
  const targetReviews = targetComparisons ? targetComparisons.reviewSitesFound : 0;
  if (targetReviews < 2) {
    const listReviewSites = mostInfluentialDomains.filter(d => d.classification === "Review Site").map(d => d.name).slice(0, 2);
    const siteStr = listReviewSites.length > 0 ? ` (${listReviewSites.join(", ")})` : "";
    actionPlan.push({
      priority: "Medium",
      action: `Registrar la marca y solicitar opiniones de clientes reales en sitios de reseñas clave${siteStr}.`,
      actionEn: `List the company and solicit real customer reviews on key review websites${siteStr}.`,
      category: "authority"
    });
  }

  const targetPubs = targetComparisons ? targetComparisons.industryPubsFound : 0;
  if (targetPubs < 2) {
    actionPlan.push({
      priority: "Medium",
      action: "Aumentar la visibilidad de prensa y publicar artículos patrocinados o notas de prensa en portales de noticias del sector.",
      actionEn: "Boost PR and release sponsored articles or press releases on industry news publications.",
      category: "authority"
    });
  }

  actionPlan.push({
    priority: "Medium",
    action: "Publicar casos de estudio exitosos estructurados con subtítulos claros y testimonios referenciables por LLMs.",
    actionEn: "Publish detailed customer case studies structured with clear headers and references suitable for LLMs.",
    category: "authority"
  });

  // 3. Low Priority Actions
  actionPlan.push({
    priority: "Low",
    action: "Optimizar el marcado estructurado de datos (Schema.org de Producto, Organización y FAQ) en todas las landing pages.",
    actionEn: "Optimize structured data markup (Schema.org Product, Organization, and FAQ) across all main landing pages.",
    category: "optimization"
  });
  actionPlan.push({
    priority: "Low",
    action: "Mejorar las etiquetas de metadatos (Title, Description) incorporando variaciones naturales de las preguntas de usuario.",
    actionEn: "Improve page metadata (Titles, Descriptions) incorporating natural phrasing of typical user queries.",
    category: "optimization"
  });
  actionPlan.push({
    priority: "Low",
    action: "Expandir la sección de preguntas frecuentes (FAQ) añadiendo respuestas directas cortas (menos de 60 palabras) y concisas.",
    actionEn: "Expand the website FAQ section with short, direct answers (under 60 words) targeting conversation queries.",
    category: "optimization"
  });

  // ----------------------------------------------------
  // CALCULATE NEW 5 KPI CARDS
  // ----------------------------------------------------
  // 1. Visibility Score (Share of Voice of target)
  const visibilityScore = shareOfVoice;

  // 2. Authority Score (Calculated based on reviews, publications, directories for target)
  const targetReviewCits = targetComparisons ? targetComparisons.reviewSitesFound : 0;
  const targetPubCits = targetComparisons ? targetComparisons.industryPubsFound : 0;
  const targetThirdPartyCits = targetComparisons ? targetComparisons.thirdPartyCitations : 0;
  const targetTotalCits = targetComparisons ? targetComparisons.citationCount : 0;

  let authorityScore = 0;
  if (targetTotalCits > 0) {
    authorityScore = Math.round(
      Math.max(0, Math.min(100, (targetReviewCits * 30 + targetPubCits * 25 + (targetThirdPartyCits - targetReviewCits - targetPubCits) * 15 + (targetTotalCits - targetThirdPartyCits) * 10)))
    );
  }

  // 3. Competitor Dominance Score
  const competitorScores = sortedComparisons.filter(c => !c.isTarget).map(c => c.visibilityScore);
  const competitorDominanceScore = competitorScores.length > 0 ? Math.max(...competitorScores) : 0;

  // 4. Content Gap Score (Percentage of questions where brand is missing but a competitor was cited)
  let contentGapCount = 0;
  questionsDetail.forEach((q) => {
    if (!q.appeared) {
      const anyCompetitorCited = q.citations.some(cit => {
        return allCompetitorDomains.some(comp => cleanDomain(cit.domain) === cleanDomain(comp) || isThirdPartyAboutBrand(cit, comp));
      });
      if (anyCompetitorCited) {
        contentGapCount++;
      }
    }
  });
  const contentGapScore = totalQuestions > 0 ? Math.round((contentGapCount / totalQuestions) * 100) : 0;

  // 5. Opportunity Score (Calculated potential uplift)
  const opportunityScore = Math.max(0, 100 - visibilityScore);

  const newKpis = {
    visibilityScore,
    authorityScore,
    competitorDominanceScore,
    contentGapScore,
    opportunityScore
  };

  return {
    totalQuestions,
    targetPresenceCount,
    shareOfVoice,
    topDomains,
    classificationBreakdown,
    questionsDetail,
    totalOpportunities,
    detectedPotentialCompetitors,
    competitorComparisons: sortedComparisons,
    authorityAnalysis: {
      categoryCounts: authorityCounts,
      mostInfluentialDomains,
      mostCitedExternalSources
    },
    rankingFactors,
    opportunityAnalysis,
    actionPlan,
    newKpis
  };
}

