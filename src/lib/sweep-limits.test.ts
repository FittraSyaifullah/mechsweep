import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SWEEP_MAX_RESULTS, MAX_SWEEP_RESULTS } from "@/lib/constants";
import { resolveSweepMaxResults, resolveExaTextMaxCharacters, exaIncludesFullText } from "@/lib/sweep-limits";

describe("resolveSweepMaxResults", () => {
  afterEach(() => {
    delete process.env.SWEEP_MAX_RESULTS;
    delete process.env.EXA_NUM_RESULTS;
  });

  it("defaults to 100 when env is unset", () => {
    expect(resolveSweepMaxResults()).toBe(DEFAULT_SWEEP_MAX_RESULTS);
  });

  it("reads SWEEP_MAX_RESULTS from env", () => {
    process.env.SWEEP_MAX_RESULTS = "75";
    expect(resolveSweepMaxResults()).toBe(75);
  });

  it("falls back to EXA_NUM_RESULTS when SWEEP_MAX_RESULTS is unset", () => {
    process.env.EXA_NUM_RESULTS = "50";
    expect(resolveSweepMaxResults()).toBe(50);
  });

  it("caps at Exa API maximum", () => {
    process.env.SWEEP_MAX_RESULTS = "500";
    expect(resolveSweepMaxResults()).toBe(MAX_SWEEP_RESULTS);
  });

  it("honors explicit override", () => {
    expect(resolveSweepMaxResults(42)).toBe(42);
    expect(resolveSweepMaxResults(500)).toBe(MAX_SWEEP_RESULTS);
  });
});

describe("Exa sweep payload limits", () => {
  it("scales text budget down as result count grows", () => {
    expect(resolveExaTextMaxCharacters(100)).toBeLessThan(resolveExaTextMaxCharacters(32));
    expect(resolveExaTextMaxCharacters(100)).toBeGreaterThanOrEqual(1500);
  });

  it("skips full page text for large sweeps", () => {
    expect(exaIncludesFullText(49)).toBe(true);
    expect(exaIncludesFullText(50)).toBe(false);
  });
});
