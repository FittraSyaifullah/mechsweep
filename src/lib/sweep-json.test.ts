import { describe, expect, it } from "vitest";
import { parseJsonText, sanitizeForJson } from "@/lib/json-safe";
import { buildSweepExcludeUrls } from "@/lib/sweep-client";

describe("json-safe", () => {
  it("strips control characters from strings", () => {
    expect(sanitizeForJson("hello\u0000world")).toBe("helloworld");
  });

  it("wraps JSON parse failures with context", () => {
    expect(() => parseJsonText("{bad", "Test")).toThrow(/Test JSON parse failed/);
  });
});

describe("buildSweepExcludeUrls", () => {
  it("prioritizes current sweep urls over library urls", () => {
    const library = Array.from({ length: 700 }, (_, i) => `https://lib.test/${i}`);
    const sweep = ["https://sweep.test/a", "https://sweep.test/b"];

    const excluded = buildSweepExcludeUrls(library, sweep, 600);
    expect(excluded[0]).toBe("https://sweep.test/a");
    expect(excluded[1]).toBe("https://sweep.test/b");
    expect(excluded).toHaveLength(600);
  });
});
