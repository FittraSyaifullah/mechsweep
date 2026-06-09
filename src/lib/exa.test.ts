import { describe, expect, it } from "vitest";
import { mapExaResult } from "@/lib/exa";

describe("Exa search helpers", () => {
  it("maps Exa results into sweep results", () => {
    const mapped = mapExaResult(
      {
        title: "Heat Transfer Notes",
        url: "https://example.edu/heat-transfer.pdf",
        highlights: ["Covers conduction and convection."],
        highlightScores: [0.91],
      },
      0
    );

    expect(mapped).toMatchObject({
      title: "Heat Transfer Notes",
      url: "https://example.edu/heat-transfer.pdf",
      type: "pdf",
      description: "Covers conduction and convection.",
      relevanceScore: 0.91,
    });
  });

  it("returns null when url is missing", () => {
    expect(mapExaResult({ title: "No URL" }, 0)).toBeNull();
  });
});
