import { Citation, CitationProvider, ProviderResponse } from "./types";
import { normalizeCitations } from "../citations";

export class OpenAISearchProvider implements CitationProvider {
  readonly name = "openai";

  constructor(private apiKey: string) {}

  async query(question: string): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("OpenAI API key is missing");
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an AI Search engine that answers queries and extracts citations. " +
                       "You must answer the query and provide a list of URLs that would be cited for this information. " +
                       "Provide your response in JSON format matching this schema: " +
                       "{ \"answer\": \"your markdown response\", \"citations\": [{ \"url\": \"https://example.com/page\", \"title\": \"Page Title\" }] }"
            },
            { role: "user", content: question }
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20000), // 20 seconds timeout
      });

      if (!res.ok) {
        throw new Error(`OpenAI API returned status ${res.status}`);
      }

      const data = await res.json();
      const contentStr = data.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(contentStr);
      
      const answer = parsed.answer ?? "";
      const rawCitations = parsed.citations ?? [];

      const sources = rawCitations.map((c: any) => ({
        url: c.url ?? "",
        title: c.title ?? "",
      }));

      return {
        answer,
        citations: normalizeCitations(sources),
        provider: this.name,
        raw: data,
      };
    } catch (err) {
      return {
        answer: "",
        citations: [],
        provider: this.name,
        raw: { error: String(err) },
      };
    }
  }
}
