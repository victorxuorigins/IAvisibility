import { Citation, CitationProvider, ProviderResponse } from "./types";
import { normalizeCitations } from "../citations";

export class GeminiSearchProvider implements CitationProvider {
  readonly name = "gemini";

  constructor(private apiKey: string) {}

  async query(question: string): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("Gemini API key is missing");
      }

      // Delay to avoid free tier rate limiting (15 RPM)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: question }]
            }
          ],
          tools: [
            {
              googleSearchRetrieval: {}
            }
          ]
        }),
        signal: AbortSignal.timeout(20000), // 20 seconds timeout
      });

      if (!res.ok) {
        throw new Error(`Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const answer = candidate?.content?.parts?.[0]?.text ?? "";
      
      const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((c: any) => {
          if (c.web) {
            return {
              url: c.web.uri,
              title: c.web.title || c.web.uri,
            };
          }
          return null;
        })
        .filter(Boolean);

      return {
        answer,
        citations: normalizeCitations(sources),
        provider: this.name,
        raw: data,
      };
    } catch (err) {
      console.error("Gemini provider error:", String(err));
      return {
        answer: "",
        citations: [],
        provider: this.name,
        raw: { error: String(err) },
      };
    }
  }
}
