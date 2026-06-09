import { afterEach, describe, expect, it } from "vitest";
import {
  buildExaSearchQuery,
  buildExaSearchRequestBody,
  resolveExaSearchType,
} from "@/lib/exa-config";

describe("exa-config", () => {
  afterEach(() => {
    delete process.env.EXA_SEARCH_TYPE;
    delete process.env.EXA_CATEGORY;
    delete process.env.EXA_INCLUDE_DOMAINS;
  });

  it("defaults to auto search type", () => {
    expect(resolveExaSearchType()).toBe("auto");
  });

  it("builds a mechanical engineering focused query", () => {
    expect(buildExaSearchQuery("heat transfer")).toContain("heat transfer");
    expect(buildExaSearchQuery("heat transfer")).toMatch(/mechanical engineering/i);
  });

  it("requests highlights and summaries with max numResults", () => {
    const body = buildExaSearchRequestBody({
      query: "robotics",
      numResults: 100,
      excludeUrls: ["https://example.edu/a.pdf", "https://other.org/b.pdf"],
    });

    expect(body.type).toBe("auto");
    expect(body.numResults).toBe(100);
    expect(body.contents).toMatchObject({ highlights: true, summary: true });
    expect(body.excludeDomains).toEqual(expect.arrayContaining(["example.edu", "other.org"]));
  });

  it("supports optional category and include domains from env", () => {
    process.env.EXA_CATEGORY = "research paper";
    process.env.EXA_INCLUDE_DOMAINS = "arxiv.org, edu";

    const body = buildExaSearchRequestBody({ query: "FEA", numResults: 50 });
    expect(body.category).toBe("research paper");
    expect(body.includeDomains).toEqual(["arxiv.org", "edu"]);
  });
});
