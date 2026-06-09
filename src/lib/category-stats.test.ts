import { describe, expect, it } from "vitest";
import { buildCategoryBreakdown, normalizeCategory } from "@/lib/category-stats";
import type { MechDocument } from "@/types";

function doc(category: string, status: MechDocument["status"] = "ready"): MechDocument {
  return {
    id: crypto.randomUUID(),
    title: category,
    type: "pdf",
    source: "upload",
    content: "test",
    category,
    status,
    addedAt: new Date().toISOString(),
  };
}

describe("category-stats", () => {
  it("normalizes fuzzy category labels", () => {
    expect(normalizeCategory("heat transfer notes")).toBe("Heat Transfer");
    expect(normalizeCategory("FEA simulation")).toBe("FEA / FEM");
  });

  it("builds breakdown for ready documents only", () => {
    const breakdown = buildCategoryBreakdown([
      doc("Heat Transfer"),
      doc("Heat Transfer"),
      doc("Robotics"),
      doc("Fluid Mechanics", "processing"),
    ]);

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toMatchObject({ category: "Heat Transfer", count: 2 });
    expect(breakdown[0].percentage).toBeCloseTo(66.67, 1);
    expect(breakdown[1]).toMatchObject({ category: "Robotics", count: 1 });
  });
});
