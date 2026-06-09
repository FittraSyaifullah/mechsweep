import { describe, expect, it } from "vitest";
import { extractDocumentText, extractPrintableStrings } from "@/lib/document-extract";

describe("document extract helpers", () => {
  it("extracts json into readable text", async () => {
    const buffer = Buffer.from(JSON.stringify({ title: "Pump", rpm: 3600 }));
    const result = await extractDocumentText("json", buffer);
    expect(result.text).toContain("Pump");
    expect(result.text).toContain("3600");
  });

  it("extracts ascii stl content", async () => {
    const stl = "solid bracket\nfacet normal 0 0 1\nendsolid bracket\n";
    const result = await extractDocumentText("stl", Buffer.from(stl));
    expect(result.text).toContain("solid bracket");
  });

  it("pulls printable strings from binary buffers", () => {
    const buffer = Buffer.from([0, 0, ...Buffer.from("PRODUCT('BOLT')"), 0, 0]);
    const strings = extractPrintableStrings(buffer);
    expect(strings.join(" ")).toContain("PRODUCT('BOLT')");
  });
});
