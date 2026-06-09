import { describe, expect, it } from "vitest";
import {
  buildPrefetchedContent,
  combineFallbackSources,
  isUsableContent,
  normalizeImportedContent,
  shouldSkipDirectFetch,
} from "@/lib/document-content";

describe("document content helpers", () => {
  it("normalizes html into plain text", () => {
    const text = normalizeImportedContent("<html><body><p>Pump spec</p></body></html>");
    expect(text).toContain("Pump spec");
  });

  it("checks usable content length", () => {
    expect(isUsableContent("short")).toBe(false);
    expect(isUsableContent("x".repeat(150))).toBe(true);
  });

  it("builds prefetched content from text or highlights", () => {
    expect(buildPrefetchedContent(undefined, ["Heat transfer notes " + "x".repeat(120)])).toContain(
      "Heat transfer notes"
    );
  });

  it("prefers direct fetch for document urls", () => {
    expect(shouldSkipDirectFetch("https://example.com/paper.pdf", "x".repeat(150))).toBe(false);
    expect(shouldSkipDirectFetch("https://example.com/page", "x".repeat(150))).toBe(true);
  });

  it("combines fallback sources", () => {
    expect(combineFallbackSources("Preview text", "Extra context")).toContain("Preview text");
    expect(combineFallbackSources("Preview text", "Extra context")).toContain("Extra context");
  });
});
