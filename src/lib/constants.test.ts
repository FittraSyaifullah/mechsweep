import { describe, expect, it } from "vitest";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";

describe("library constants", () => {
  it("allows up to 15000 documents", () => {
    expect(MAX_LIBRARY_DOCUMENTS).toBe(15_000);
  });
});
