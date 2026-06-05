export interface Citation {
  url: string;
  domain: string;        // normalized: lowercase, without "www."
  title?: string;
}

export interface ProviderResponse {
  answer: string;        // response text
  citations: Citation[]; // cited sources
  provider: string;      // "mock" | "perplexity" | ...
  raw?: unknown;         // raw payload for debugging
}

export interface CitationProvider {
  readonly name: string;
  /** Runs a single question and returns the answer + citations.
   * Should never throw; instead, on error returns empty answer/citations and populates raw.error. */
  query(question: string): Promise<ProviderResponse>;
}
