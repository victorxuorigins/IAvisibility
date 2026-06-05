import { CitationProvider } from "./types";
import { MockProvider } from "./mock";
import { PerplexitySonarProvider } from "./perplexity";
import { OpenAISearchProvider } from "./openai";
import { GeminiSearchProvider } from "./gemini";

export interface ProviderConfig {
  targetCompany?: string;
  targetDomain?: string;
  competitors?: string[];
}

/**
 * Factory function to retrieve the configured CitationProvider.
 * If providerName is "perplexity", "openai", or "gemini" but no key is present, it falls back to "mock".
 */
export function getProvider(
  providerName: string = process.env.CITATION_PROVIDER || "mock",
  config?: ProviderConfig,
  overrideApiKey?: string
): CitationProvider {
  const selectedProvider = providerName.toLowerCase();

  switch (selectedProvider) {
    case "perplexity":
      const apiKey = overrideApiKey || process.env.PERPLEXITY_API_KEY;
      if (!apiKey) {
        console.warn("PERPLEXITY_API_KEY not found in environment. Falling back to MockProvider.");
        return new MockProvider(config?.targetCompany, config?.targetDomain, config?.competitors);
      }
      return new PerplexitySonarProvider(apiKey);

    case "openai":
      const openaiKey = overrideApiKey || process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.warn("OPENAI_API_KEY not found. Falling back to MockProvider.");
        return new MockProvider(config?.targetCompany, config?.targetDomain, config?.competitors);
      }
      return new OpenAISearchProvider(openaiKey);

    case "gemini":
      const geminiKey = overrideApiKey || process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        console.warn("GEMINI_API_KEY not found. Falling back to MockProvider.");
        return new MockProvider(config?.targetCompany, config?.targetDomain, config?.competitors);
      }
      return new GeminiSearchProvider(geminiKey);

    case "mock":
    default:
      return new MockProvider(config?.targetCompany, config?.targetDomain, config?.competitors);
  }
}
export * from "./types";
