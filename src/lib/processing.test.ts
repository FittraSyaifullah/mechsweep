import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  detectOcrStatus,
  detectUnits,
  extractTablesFromCsv,
  extractTablesFromHtml,
  extractTablesFromText,
} from "@/lib/processing";

describe("advanced processing helpers", () => {
  it("detects language and engineering units", () => {
    const text = "The pump flow is 12 m and pressure is 30 kPa at 1200 rpm.";
    expect(detectLanguage(text)).toBe("English");
    expect(detectUnits(text)).toEqual(expect.arrayContaining(["m", "Pa", "rpm"]));
  });

  it("detects scanned PDFs that likely need OCR", () => {
    expect(detectOcrStatus("", 4)).toBe("needed");
    expect(detectOcrStatus("Tiny", 1)).toBe("needed");
    expect(detectOcrStatus("The pump ".repeat(20), 1)).toBe("not_needed");
  });

  it("extracts CSV, HTML, and text tables", () => {
    expect(extractTablesFromCsv("a,b,c\n1,2,3")[0].headers).toEqual(["a", "b", "c"]);
    expect(
      extractTablesFromHtml("<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>")[0]
        .rows[0]
    ).toEqual(["1", "2"]);
    expect(extractTablesFromText("A  B  C\n1  2  3")[0].headers).toEqual(["A", "B", "C"]);
  });
});
