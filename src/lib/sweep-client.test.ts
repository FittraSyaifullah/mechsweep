import { describe, expect, it, vi, afterEach } from "vitest";
import { DEFAULT_SWEEP_SESSION_MAX, SWEEP_BATCH_SIZE } from "@/lib/constants";
import { mergeSweepResults, runBatchedSweep } from "@/lib/sweep-client";
import { sweepBatchCount } from "@/lib/sweep-limits";
import type { SweepResult } from "@/types";

function result(url: string): SweepResult {
  return {
    title: url,
    url,
    type: "pdf",
    description: "test",
    relevanceScore: 0.9,
  };
}

describe("mergeSweepResults", () => {
  it("deduplicates by url", () => {
    const merged = mergeSweepResults(
      [result("https://a.test/1")],
      [result("https://a.test/1"), result("https://a.test/2")]
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.url)).toEqual([
      "https://a.test/1",
      "https://a.test/2",
    ]);
  });
});

describe("sweepBatchCount", () => {
  it("plans ten batches for 500 results at size 50", () => {
    expect(sweepBatchCount(DEFAULT_SWEEP_SESSION_MAX, SWEEP_BATCH_SIZE)).toBe(10);
  });

  it("returns one batch for sweep more", () => {
    expect(sweepBatchCount(DEFAULT_SWEEP_SESSION_MAX, SWEEP_BATCH_SIZE, true)).toBe(1);
  });
});

describe("runBatchedSweep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges multiple batch responses until target is reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { excludeUrls?: string[] };
        if ((body.excludeUrls ?? []).includes("https://a.test/1")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                results: [result("https://a.test/3")],
                provider: "exa",
              }),
          };
        }
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              results: [result("https://a.test/1"), result("https://a.test/2")],
              provider: "exa",
            }),
        };
      })
    );

    const outcome = await runBatchedSweep({
      query: "heat transfer",
      excludeUrls: [],
      totalTarget: 3,
      batchSize: 2,
    });

    expect(outcome.results).toHaveLength(3);
    expect(outcome.batchesCompleted).toBe(2);
    expect(outcome.provider).toBe("exa");
  });
});
