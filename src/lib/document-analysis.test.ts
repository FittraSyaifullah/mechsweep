import { describe, expect, it } from "vitest";
import { buildLocalAnalyzeResult, inferCategoryFromText } from "@/lib/document-analysis";

describe("document-analysis", () => {
  it("builds a local summary from content", () => {
    const result = buildLocalAnalyzeResult(
      "Heat Transfer Notes",
      "pdf",
      "Conduction and convection fundamentals for mechanical engineers."
    );
    expect(result.summary).toContain("Conduction");
    expect(result.category).toBe("Heat Transfer");
    expect(result.tags.length).toBeGreaterThan(0);
  });

  it("uses title when content is empty", () => {
    const result = buildLocalAnalyzeResult("Gear Design Guide", "pdf", "");
    expect(result.summary).toContain("Gear Design Guide");
  });

  it("infers categories from keywords", () => {
    expect(inferCategoryFromText("finite element mesh analysis")).toBe("FEA / FEM");
    expect(inferCategoryFromText("random topic")).toBe("Other");
  });
});
