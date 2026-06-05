import { Citation } from "./providers/types";

/**
 * Normalizes a URL string to its clean domain name.
 * e.g., "https://www.blog.example.com/post?id=1" -> "blog.example.com"
 */
export function normalizeDomain(urlStr: string): string {
  try {
    let cleanUrl = urlStr.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = "http://" + cleanUrl;
    }
    const url = new URL(cleanUrl);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    return "";
  }
}

/**
 * Normalizes and deduplicates a list of raw citations by domain.
 */
export function normalizeCitations(sources: { url: string; title?: string }[]): Citation[] {
  const citations: Citation[] = [];
  const seenDomains = new Set<string>();

  for (const src of sources) {
    if (!src.url) continue;
    const domain = normalizeDomain(src.url);
    if (!domain) continue; // Skip invalid URLs

    // Deduplicate citations by domain in the same response
    if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      citations.push({
        url: src.url,
        domain,
        title: src.title || undefined,
      });
    }
  }

  return citations;
}

const REVIEW_SITES = [
  "g2.com",
  "capterra.com",
  "trustpilot.com",
  "gartner.com",
  "reddit.com",
  "trustradius.com",
  "getapp.com",
  "softwareadvice.com",
  "peerinsights.gartner.com",
  "quora.com",
  "glassdoor.com",
  "indeed.com"
];

const PUBLICATION_SITES = [
  "wikipedia.org",
  "medium.com",
  "techcrunch.com",
  "forbes.com",
  "bloomberg.com",
  "wired.com",
  "nytimes.com",
  "wsj.com",
  "github.com",
  "youtube.com",
  "hbr.org",
  "infoworld.com",
  "cio.com",
  "zdnet.com",
  "techradar.com"
];

/**
 * Classifies a domain into one of the pre-defined groups:
 * - 'target': Matches the target company domain.
 * - 'competitor': Matches one of the defined competitor domains.
 * - 'review': Matches standard review platforms.
 * - 'publication': Matches editorial, research, or news portals.
 * - 'other': General websites.
 */
export function classifyDomain(
  domain: string,
  targetDomain: string,
  competitorDomains: string[] = []
): "target" | "competitor" | "review" | "publication" | "other" {
  const cleanDomain = domain.toLowerCase().trim();
  const cleanTarget = targetDomain.toLowerCase().replace(/^www\./, "").trim();

  const isMatch = (dom: string, target: string) => {
    return dom === target || dom.endsWith("." + target);
  };

  if (isMatch(cleanDomain, cleanTarget)) {
    return "target";
  }

  for (const comp of competitorDomains) {
    const cleanComp = comp.toLowerCase().replace(/^www\./, "").trim();
    if (cleanComp && isMatch(cleanDomain, cleanComp)) {
      return "competitor";
    }
  }

  if (REVIEW_SITES.some((site) => cleanDomain === site || cleanDomain.endsWith("." + site))) {
    return "review";
  }

  if (PUBLICATION_SITES.some((site) => cleanDomain === site || cleanDomain.endsWith("." + site))) {
    return "publication";
  }

  return "other";
}
