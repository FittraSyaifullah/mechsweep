import { describe, expect, it, afterEach } from "vitest";
import {
  exaSearchEnabled,
  resolveWebSearchProvider,
  sweepMistralFallbackEnabled,
} from "@/lib/search-provider";

describe("search-provider", () => {
  afterEach(() => {
    delete process.env.SEARCH_PROVIDER;
    delete process.env.EXA_API_KEY;
    delete process.env.SWEEP_MISTRAL_FALLBACK;
  });

  it("uses Exa when SEARCH_PROVIDER=exa and key is set", () => {
    process.env.SEARCH_PROVIDER = "exa";
    process.env.EXA_API_KEY = "test-key";
    expect(resolveWebSearchProvider()).toBe("exa");
    expect(exaSearchEnabled()).toBe(true);
  });

  it("defaults to Exa when provider unset and key exists", () => {
    process.env.EXA_API_KEY = "test-key";
    expect(resolveWebSearchProvider()).toBe("exa");
  });

  it("disables Mistral sweep fallback by default", () => {
    expect(sweepMistralFallbackEnabled()).toBe(false);
  });

  it("only enables Mistral fallback when explicitly opted in", () => {
    process.env.SWEEP_MISTRAL_FALLBACK = "true";
    expect(sweepMistralFallbackEnabled()).toBe(true);
  });
});
