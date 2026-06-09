import { describe, expect, it } from "vitest";
import { parseJsonText, sanitizeForJson, serializeForJsonResponse } from "@/lib/json-safe";
import { buildCompactSweepPayload } from "@/lib/sweep-payload";
import { buildSweepExcludeUrls } from "@/lib/sweep-client";

describe("json-safe", () => {
  it("strips control characters from strings", () => {
    expect(sanitizeForJson("hello\u0000world")).toBe("helloworld");
  });

  it("wraps JSON parse failures with context", () => {
    expect(() => parseJsonText("{bad", "Test")).toThrow(/Test JSON parse failed/);
  });

  it("round-trips sanitized responses", () => {
    const json = serializeForJsonResponse({
      results: [{ title: "A\u0000B", url: "https://x.test/a" }],
    });
    expect(JSON.parse(json).results[0].title).toBe("AB");
  });
});

describe("buildCompactSweepPayload", () => {
  it("prioritizes sweep urls and sends domains for large libraries", () => {
    const library = Array.from({ length: 700 }, (_, i) => `https://lib.test/${i}`);
    const sweep = ["https://sweep.test/a", "https://sweep.test/b"];

    const payload = buildCompactSweepPayload({
      libraryUrls: library,
      sweepUrls: sweep,
      maxResults: 50,
    });

    expect(payload.excludeUrls[0]).toBe("https://sweep.test/a");
    expect(payload.excludeUrls[1]).toBe("https://sweep.test/b");
    expect(payload.excludeUrls.length).toBeLessThanOrEqual(120);
    expect(payload.excludeDomains).toContain("lib.test");
    expect(payload.excludeDomains).toContain("sweep.test");
    expect(JSON.stringify(payload).length).toBeLessThan(20_000);
  });
});

describe("buildSweepExcludeUrls", () => {
  it("caps at requested max", () => {
    const library = Array.from({ length: 700 }, (_, i) => `https://lib.test/${i}`);
    const sweep = ["https://sweep.test/a"];

    const excluded = buildSweepExcludeUrls(library, sweep, 50);
    expect(excluded[0]).toBe("https://sweep.test/a");
    expect(excluded).toHaveLength(50);
  });
});
