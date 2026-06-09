import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SWEEP_MAX_RESULTS,
  DEFAULT_SWEEP_SESSION_MAX,
  MAX_SWEEP_RESULTS,
  SWEEP_BATCH_SIZE,
} from "@/lib/constants";
import {
  resolveSweepMaxResults,
  resolveExaTextMaxCharacters,
  exaIncludesFullText,
  resolveExaRequestTimeoutMs,
  resolveSweepSessionMax,
  sweepBatchCount,
} from "@/lib/sweep-limits";

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

describe("sweep session limits", () => {
  it("defaults to 500 results across batched Exa calls", () => {
    expect(resolveSweepSessionMax()).toBe(DEFAULT_SWEEP_SESSION_MAX);
  });

  it("plans ten batches for a full session at batch size 50", () => {
    expect(sweepBatchCount(DEFAULT_SWEEP_SESSION_MAX, SWEEP_BATCH_SIZE)).toBe(10);
  });
});

describe("Exa sweep payload limits", () => {
  it("scales text budget down as result count grows", () => {
    expect(resolveExaTextMaxCharacters(100)).toBeLessThan(resolveExaTextMaxCharacters(32));
    expect(resolveExaTextMaxCharacters(100)).toBeGreaterThanOrEqual(1500);
  });

  it("skips full page text for batch-sized sweeps", () => {
    expect(exaIncludesFullText(49)).toBe(true);
    expect(exaIncludesFullText(50)).toBe(false);
  });

  it("scales Exa timeout with batch size and search type", () => {
    expect(resolveExaRequestTimeoutMs(50, "auto")).toBeLessThanOrEqual(35_000);
    expect(resolveExaRequestTimeoutMs(50, "deep")).toBeGreaterThan(20_000);
  });
});
