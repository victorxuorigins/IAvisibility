export function getFallbackQuestions(company: string, description: string, lang: "es" | "en" = "en"): string[] {
  const sellsMatch = description.match(/sells?\s+([^,\.]+)/i) || description.match(/(?:selling|provides?|offers?|manufactures?)\s+([^,\.]+)/i);
  let category = sellsMatch ? sellsMatch[1].trim() : "";

  if (!category) {
    const stopWords = new Set(["a","an","the","and","or","that","which","for","to","of","in","is","are","company","manufacturer","provider","supplier","platform","solution","service"]);
    const words = description.trim().split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()));
    category = words.slice(0, 3).join(" ");
  }

  if (!category) category = description.trim().split(/\s+/).slice(0, 3).join(" ");

  return lang === "es" ? [
    `mejores proveedores de ${category} para uso industrial`,
    `${company} vs competidores ¿cuál es mejor?`,
    `cómo elegir un proveedor de ${category}`,
    `marcas más confiables de ${category}`,
    `alternativas a ${company}`,
    `vale la pena ${company} para comprar ${category}`,
    `qué debo saber antes de comprar ${category}`,
    `opiniones y reseñas de ${company}`,
  ] : [
    `best ${category} companies for industrial use`,
    `${company} vs competitors which is better`,
    `how to choose a ${category} supplier`,
    `most reliable ${category} brands`,
    `alternatives to ${company}`,
    `is ${company} worth it for ${category}`,
    `what to look for when buying ${category}`,
    `${company} reviews and ratings`,
  ];
}

const BUYER_JOURNEY_PROMPT_EN = (company: string, description: string) => `Act as an expert in Generative Engine Optimization (GEO) and B2B buyer psychology. Generate buyer-intent search queries that mirror how real people type into AI tools like ChatGPT, Perplexity, and Gemini.

Company: ${company}
Description: ${description}

Generate exactly 8 questions covering ALL of these buyer journey stages (at least 1 per stage):
- AWARENESS: buyer realizes they have a problem
- CATEGORY: buyer researches solution types
- SHORTLIST: buyer looks for top brands
- COMPARISON: buyer compares vendors head to head
- VALIDATION: buyer looks for proof/reviews
- DECISION: buyer has specific requirements

Rules:
- Sound like a real person typing into ChatGPT, NOT an SEO keyword phrase
- BAD: "What are the best companies for industrial compressor manufacturing?"
- GOOD: "which air compressor brand is most reliable for a factory?"
- Extract the REAL product from the description
- Mix formats: some "what/which/how", some "X vs Y", some "is X worth it", some short noun phrases

Return ONLY valid JSON:
{
  "questions": ["q1","q2","q3","q4","q5","q6","q7","q8"]
}`;

const BUYER_JOURNEY_PROMPT_ES = (company: string, description: string) => `Actúa como experto en GEO y psicología del comprador B2B. Genera consultas de intención de compra conversacionales.

Empresa: ${company}
Descripción: ${description}

Genera exactamente 8 preguntas cubriendo estas etapas (mínimo 1 por etapa):
- CONSCIENCIA, CATEGORÍA, LISTA CORTA, COMPARACIÓN, VALIDACIÓN, DECISIÓN

Reglas:
- Que suene como una persona real en ChatGPT, NO como keyword SEO
- Extrae el PRODUCTO REAL de la descripción

Devuelve ÚNICAMENTE JSON válido:
{
  "questions": ["p1","p2","p3","p4","p5","p6","p7","p8"]
}`;

export async function generateQuestions(
  company: string,
  description: string,
  overrideApiKeyOrGeminiKey?: string,
  lang: "es" | "en" = "en",
  provider: string = "gemini",
  apiKeys: { gemini?: string; openai?: string; perplexity?: string } = {}
): Promise<{ text: string; source: "generated" | "manual" }[]> {
  const geminiKey = overrideApiKeyOrGeminiKey || apiKeys.gemini || process.env.GEMINI_API_KEY;
  const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY;
  const perplexityKey = apiKeys.perplexity || process.env.PERPLEXITY_API_KEY;

  const prompt = lang === "es"
    ? BUYER_JOURNEY_PROMPT_ES(company, description)
    : BUYER_JOURNEY_PROMPT_EN(company, description);

  if (provider === "gemini" && geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = JSON.parse(jsonText.trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: string) => ({ text: q.trim(), source: "generated" as const }));
        }
      }
    } catch (error) {
      console.warn("Gemini question generation error, falling back to templates:", error);
    }
  } else if (provider === "openai" && openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: lang === "es" ? "Eres experto en GEO. Devuelve solo JSON válido." : "You are a GEO expert. Return only valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: string) => ({ text: q.trim(), source: "generated" as const }));
        }
      }
    } catch (error) {
      console.warn("OpenAI question generation error, falling back to templates:", error);
    }
  } else if (provider === "perplexity" && perplexityKey) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = await res.json();
        let jsonText = data.choices?.[0]?.message?.content ?? "";
        if (jsonText.includes("```")) jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "");
        const parsed = JSON.parse(jsonText.trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: string) => ({ text: q.trim(), source: "generated" as const }));
        }
      }
    } catch (error) {
      console.warn("Perplexity question generation error, falling back to templates:", error);
    }
  }

  return getFallbackQuestions(company, description, lang).map((q) => ({ text: q, source: "generated" as const }));
}
