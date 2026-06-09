import { describe, expect, it } from "vitest";
import {
  detectDocTypeFromContentType,
  detectDocTypeFromUrl,
  extractJsonFromResponse,
  extractTextFromHtml,
} from "@/lib/parser";

describe("parser helpers", () => {
  it("detects document types from URLs and content types", () => {
    expect(detectDocTypeFromUrl("https://example.com/report.pdf?download=1")).toBe("pdf");
    expect(detectDocTypeFromUrl("https://example.com/data.csv")).toBe("csv");
    expect(detectDocTypeFromUrl("https://example.com/part.stl")).toBe("stl");
    expect(detectDocTypeFromUrl("https://example.com/spec.json")).toBe("json");
    expect(detectDocTypeFromContentType("text/html; charset=utf-8", "pdf")).toBe("txt");
    expect(detectDocTypeFromContentType("application/pdf", "txt")).toBe("pdf");
    expect(detectDocTypeFromContentType("application/json", "txt")).toBe("json");
  });

  it("extracts JSON from fenced model responses", () => {
    expect(extractJsonFromResponse('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(extractJsonFromResponse('prefix [{"a":1}] suffix')).toBe('[{"a":1}]');
  });

  it("strips scripts and tags from HTML", () => {
    expect(
      extractTextFromHtml("<main>Hello&nbsp;<strong>pump</strong></main><script>bad()</script>")
    ).toBe("Hello pump");
  });
});
