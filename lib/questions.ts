export function getFallbackQuestions(company: string, description: string, lang: "es" | "en" = "en"): string[] {
  let category = description.trim();
  if (category.endsWith(".")) {
    category = category.slice(0, -1);
  }
  
  // If the description is too long, extract a concise summary (up to first 5 words)
  if (category.split(/\s+/).length > 6) {
    category = category.split(/\s+/).slice(0, 5).join(" ") + "...";
  }

  return lang === "es" ? [
    `¿Cuáles son las mejores empresas de ${category}?`,
    `¿Cómo elijo un proveedor de ${category}?`,
    `¿Qué empresas lideran en ${category}?`,
    `¿Cómo se compara ${company} con la competencia en ${category}?`,
    `¿Qué debo tener en cuenta al comprar ${category}?`,
    `¿Cuáles son las alternativas a ${company}?`
  ] : [
    `What are the best companies for ${category}?`,
    `How do I choose a provider for ${category}?`,
    `Which companies lead in ${category}?`,
    `How does ${company} compare to the competition in ${category}?`,
    `What should I consider when buying ${category}?`,
    `What are the alternatives to ${company}?`
  ];
}

/**
 * Generates purchase intent questions.
 * Attempts to hit Gemini API first; falls back to template patterns on error or if no key is configured.
 */
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

  if (provider === "gemini" && geminiKey) {
    try {
      const prompt = lang === "es"
        ? `Actúa como un experto en SEO, GEO (Generative Engine Optimization) y comportamiento de compra B2B/B2C.
Analiza la siguiente empresa y su descripción para generar exactamente 6 preguntas reales que un comprador potencial haría en un buscador de IA (como Perplexity, Gemini, ChatGPT con búsqueda) en distintas etapas del funnel de compra (descubrimiento, comparación, decisión).

Empresa: ${company}
Descripción: ${description}

Las preguntas deben cubrir:
1. Descubrimiento de categoría (ej: cuáles son los líderes en...)
2. Comparativas directas (ej: alternativas a..., comparativa de...)
3. Criterios de compra o selección (ej: cómo elegir...)

Devuelve exclusivamente un JSON con el siguiente formato, sin markdown, sin bloques de código, sin comentarios:
{
  "questions": [
    "Pregunta 1",
    "Pregunta 2",
    "Pregunta 3",
    "Pregunta 4",
    "Pregunta 5",
    "Pregunta 6"
  ]
}
`
        : `Act as an expert in SEO, GEO (Generative Engine Optimization) and B2B/B2C buyer behavior.
Analyze the following company and its description to generate exactly 6 real questions that a potential buyer would ask in an AI search engine (such as Perplexity, Gemini, ChatGPT Search) at different stages of the buying funnel (discovery, comparison, decision).

Company: ${company}
Description: ${description}

The questions must cover:
1. Category discovery (e.g. what are the leaders in...)
2. Direct comparisons (e.g. alternatives to..., comparison of...)
3. Purchase or selection criteria (e.g. how to choose...)

Return exclusively a JSON with the following format, without markdown, without code blocks, without comments:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5",
    "Question 6"
  ]
}
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = JSON.parse(jsonText.trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: string) => ({
            text: q.trim(),
            source: "generated" as const,
          }));
        }
      }
    } catch (error) {
      console.warn("Gemini question generation error, falling back to templates:", error);
    }
  } else if (provider === "openai" && openaiKey) {
    try {
      const systemPrompt = lang === "es"
        ? "Actúa como un experto en SEO, GEO (Generative Engine Optimization) y comportamiento de compra B2B/B2C. Devuelve exclusivamente un JSON con exactamente 6 preguntas reales de intención de compra en distintas etapas del funnel (descubrimiento, comparación, decisión)."
        : "Act as an expert in SEO, GEO (Generative Engine Optimization) and B2B/B2C buyer behavior. Return exclusively a JSON with exactly 6 real purchase intent questions at different stages of the buying funnel (discovery, comparison, decision).";

      const userPrompt = lang === "es"
        ? `Genera exactamente 6 preguntas de compra en base a esta empresa y descripción.
Empresa: ${company}
Descripción: ${description}

Devuelve exclusivamente un JSON con el siguiente formato, sin markdown, sin bloques de código, sin comentarios:
{
  "questions": [
    "Pregunta 1",
    "Pregunta 2",
    "Pregunta 3",
    "Pregunta 4",
    "Pregunta 5",
    "Pregunta 6"
  ]
}`
        : `Generate exactly 6 buyer intent questions based on this company and description.
Company: ${company}
Description: ${description}

Return exclusively a JSON with the following format, without markdown, without code blocks, without comments:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5",
    "Question 6"
  ]
}`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const contentStr = data.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(contentStr.trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: string) => ({
            text: q.trim(),
            source: "generated" as const,
          }));
        }
      }
    } catch (error) {
      console.warn("OpenAI question generation error, falling back to templates:", error);
    }
  } else if (provider === "perplexity" && perplexityKey) {
    try {
      const prompt = lang === "es"
        ? `Actúa como un experto en SEO y GEO. Analiza la siguiente empresa y su descripción para generar exactamente 6 preguntas de intención de compra en distintas etapas del funnel.
Empresa: ${company}
Descripción: ${description}

Devuelve únicamente un objeto JSON con la lista de preguntas, sin explicaciones ni markdown. Ejemplo:
{
  "questions": [
    "Pregunta 1",
    "Pregunta 2",
    "Pregunta 3",
    "Pregunta 4",
    "Pregunta 5",
    "Pregunta 6"
  ]
}`
        : `Act as an expert in SEO and GEO. Analyze the following company and description to generate exactly 6 purchase intent questions at different stages of the funnel.
Company: ${company}
Description: ${description}

Return only a JSON object with the list of questions, without explanations or markdown. Example:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5",
    "Question 6"
  ]
}`;

      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        let jsonText = data.choices?.[0]?.message?.content ?? "";
        if (jsonText.includes("```")) {
          // Strip out markdown code blocks if the model wrapped it
          jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "");
        }
        const parsed = JSON.parse(jsonText.trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed.questions.map((q: string) => ({
            text: q.trim(),
            source: "generated" as const,
          }));
        }
      }
    } catch (error) {
      console.warn("Perplexity question generation error, falling back to templates:", error);
    }
  }

  // Fallback to template questions
  return getFallbackQuestions(company, description, lang).map((q) => ({
    text: q,
    source: "generated" as const,
  }));
}
