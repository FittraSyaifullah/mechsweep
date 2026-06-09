import { describe, expect, it } from "vitest";
import { docTypeFromExtension, hasDirectDocumentUrl, isDocType } from "@/lib/file-types";

describe("file type helpers", () => {
  it("maps extensions to document types", () => {
    expect(docTypeFromExtension("bracket.stl")).toBe("stl");
    expect(docTypeFromExtension("part.step")).toBe("step");
    expect(docTypeFromExtension("assembly.stp")).toBe("step");
    expect(docTypeFromExtension("drawing.dwg")).toBe("dwg");
    expect(docTypeFromExtension("spec.json")).toBe("json");
    expect(docTypeFromExtension("notes.md")).toBe("md");
    expect(docTypeFromExtension("bundle.zip")).toBe("zip");
  });

  it("validates doc types", () => {
    expect(isDocType("pdf")).toBe(true);
    expect(isDocType("dwg")).toBe(true);
    expect(isDocType("docx")).toBe(false);
  });

  it("detects direct document urls", () => {
    expect(hasDirectDocumentUrl("https://example.com/manual.pdf")).toBe(true);
    expect(hasDirectDocumentUrl("https://example.com/blog/post")).toBe(false);
  });
});
