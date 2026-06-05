import { describe, it, expect } from "vitest";
import { normalizeDomain, classifyDomain, normalizeCitations } from "../citations";
import { calculateDashboardMetrics } from "../analytics";
import { AuditRunDetails } from "../db";

describe("Domain Normalization (normalizeDomain)", () => {
  it("should remove http and https protocols", () => {
    expect(normalizeDomain("https://atlascopco.com")).toBe("atlascopco.com");
    expect(normalizeDomain("http://atlascopco.com")).toBe("atlascopco.com");
  });

  it("should remove leading www.", () => {
    expect(normalizeDomain("https://www.atlascopco.com")).toBe("atlascopco.com");
    expect(normalizeDomain("www.atlascopco.com")).toBe("atlascopco.com");
  });

  it("should convert domain to lowercase", () => {
    expect(normalizeDomain("https://WWW.AtlasCopco.COM/path")).toBe("atlascopco.com");
  });

  it("should extract hostname and ignore paths, queries, and fragments", () => {
    expect(normalizeDomain("https://atlascopco.com/products/compressors?id=123#spec")).toBe("atlascopco.com");
  });

  it("should handle domains without protocol", () => {
    expect(normalizeDomain("atlascopco.com")).toBe("atlascopco.com");
  });

  it("should return empty string for invalid URLs", () => {
    expect(normalizeDomain("")).toBe("");
  });
});

describe("Domain Deduplication (normalizeCitations)", () => {
  it("should normalize and deduplicate citations by domain in the same response", () => {
    const rawSources = [
      { url: "https://www.atlascopco.com/p1", title: "Product 1" },
      { url: "https://atlascopco.com/p2", title: "Product 2" },
      { url: "https://www.kaeser.com", title: "Kaeser Compressor" },
      { url: "", title: "Empty URL" },
      { url: "https://www.kaeser.com/parts", title: "Kaeser Parts" },
    ];

    const result = normalizeCitations(rawSources);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      url: "https://www.atlascopco.com/p1",
      domain: "atlascopco.com",
      title: "Product 1",
    });
    expect(result[1]).toEqual({
      url: "https://www.kaeser.com",
      domain: "kaeser.com",
      title: "Kaeser Compressor",
    });
  });

  it("should return empty array when given no valid URLs", () => {
    const rawSources = [
      { url: "" },
      { url: "   " },
    ];
    expect(normalizeCitations(rawSources)).toEqual([]);
  });
});

describe("Domain Classification (classifyDomain)", () => {
  const target = "atlascopco.com";
  const competitors = ["kaeser.com", "ingersollrand.com"];

  it("should classify target domain correctly", () => {
    expect(classifyDomain("atlascopco.com", target, competitors)).toBe("target");
    expect(classifyDomain("www.atlascopco.com", target, competitors)).toBe("target");
    expect(classifyDomain("sub.atlascopco.com", target, competitors)).toBe("target");
  });

  it("should classify competitor domains correctly", () => {
    expect(classifyDomain("kaeser.com", target, competitors)).toBe("competitor");
    expect(classifyDomain("www.ingersollrand.com", target, competitors)).toBe("competitor");
    expect(classifyDomain("parts.kaeser.com", target, competitors)).toBe("competitor");
  });

  it("should classify review platforms correctly", () => {
    expect(classifyDomain("g2.com", target, competitors)).toBe("review");
    expect(classifyDomain("www.capterra.com", target, competitors)).toBe("review");
    expect(classifyDomain("blog.capterra.com", target, competitors)).toBe("review");
  });

  it("should classify publications correctly", () => {
    expect(classifyDomain("wikipedia.org", target, competitors)).toBe("publication");
    expect(classifyDomain("forbes.com", target, competitors)).toBe("publication");
  });

  it("should classify unknown domains as other", () => {
    expect(classifyDomain("randomblog.net", target, competitors)).toBe("other");
  });
});

describe("Share of Voice Calculation (calculateDashboardMetrics)", () => {
  it("should calculate correct Share of Voice based on target domain presence", () => {
    // 4 responses total:
    // Resp 1: target present
    // Resp 2: target not present (only competitor)
    // Resp 3: target present
    // Resp 4: target not present (no citations)
    // SoV should be 2/4 = 50%
    const mockRunDetails: AuditRunDetails = {
      run: {
        id: "run-123",
        project_id: "project-123",
        provider: "mock",
        status: "completed",
        created_at: "2026-06-04T12:00:00Z",
      },
      responses: [
        {
          id: "resp-1",
          question_id: "q-1",
          question_text: "What is the best compressor for industrial use?",
          answer: "Atlas Copco offers great industrial compressors.",
          provider: "mock",
          citations: [
            {
              url: "https://www.atlascopco.com/compressors",
              domain: "atlascopco.com",
              title: "Atlas Copco Industrial",
              classification: "target",
            },
          ],
        },
        {
          id: "resp-2",
          question_id: "q-2",
          question_text: "How does Kaeser compare in efficiency?",
          answer: "Kaeser compressors are known for efficiency.",
          provider: "mock",
          citations: [
            {
              url: "https://www.kaeser.com",
              domain: "kaeser.com",
              title: "Kaeser Compressors",
              classification: "competitor",
            },
          ],
        },
        {
          id: "resp-3",
          question_id: "q-3",
          question_text: "Where to buy high quality compressor parts?",
          answer: "You can find parts on Atlas Copco or G2 reviews.",
          provider: "mock",
          citations: [
            {
              url: "https://atlascopco.com/parts",
              domain: "atlascopco.com",
              title: "Atlas Copco Parts",
              classification: "target",
            },
            {
              url: "https://g2.com",
              domain: "g2.com",
              title: "G2 Review site",
              classification: "review",
            },
          ],
        },
        {
          id: "resp-4",
          question_id: "q-4",
          question_text: "Are there low cost alternatives?",
          answer: "No specific recommendations are available.",
          provider: "mock",
          citations: [],
        },
      ],
    };

    const metrics = calculateDashboardMetrics(mockRunDetails, "atlascopco.com", ["kaeser.com"]);

    expect(metrics.totalQuestions).toBe(4);
    expect(metrics.targetPresenceCount).toBe(2);
    expect(metrics.shareOfVoice).toBe(50); // 2 out of 4 is 50%
    expect(metrics.totalOpportunities).toBe(2); // Resp 2 and Resp 4 are opportunities (target not present)
  });

  it("should return 0 Share of Voice if there are no questions", () => {
    const mockRunDetails: AuditRunDetails = {
      run: {
        id: "run-456",
        project_id: "project-123",
        provider: "mock",
        status: "completed",
        created_at: "2026-06-04T12:00:00Z",
      },
      responses: [],
    };

    const metrics = calculateDashboardMetrics(mockRunDetails, "atlascopco.com", ["kaeser.com"]);

    expect(metrics.totalQuestions).toBe(0);
    expect(metrics.targetPresenceCount).toBe(0);
    expect(metrics.shareOfVoice).toBe(0);
  });
});
