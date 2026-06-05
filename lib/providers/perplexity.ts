import { Citation, CitationProvider, ProviderResponse } from "./types";
import { normalizeCitations } from "../citations";

export class PerplexitySonarProvider implements CitationProvider {
  readonly name = "perplexity";

  constructor(private apiKey: string) {}

  async query(question: string): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("Perplexity API key is missing");
      }

      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: question }],
        }),
        signal: AbortSignal.timeout(20000), // 20 seconds timeout
      });

      if (!res.ok) {
        throw new Error(`Perplexity API returned status ${res.status}`);
      }

      const data = await res.json();
      const answer: string = data.choices?.[0]?.message?.content ?? "";

      // Perplexity returns citations as string[] and search_results as objects
      const results = data.search_results ?? [];
      const urls: string[] = data.citations ?? [];

      // Prefer search_results because they usually have titles; fall back to citations URLs list
      const sources: { url: string; title?: string }[] = results.length
        ? results.map((r: any) => ({ url: r.url, title: r.title }))
        : urls.map((u: string) => ({ url: u }));

      return {
        answer,
        citations: normalizeCitations(sources),
        provider: this.name,
        raw: data,
      };
    } catch (err) {
      // Do not let a single provider query throw and crash the entire run.
      // Instead, record the error details so the runner can save the state.
      return {
        answer: "",
        citations: [],
        provider: this.name,
        raw: { error: String(err) },
      };
    }
  }
}
