import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SweepResult } from "@/types";
import { runSweepAgent } from "./sweep-agent";

vi.mock("./sweep-client", () => ({
  runBatchedSweep: vi.fn(),
}));

vi.mock("./sweep-limits", () => ({
  resolveSweepSessionMax: () => 100,
}));

import { runBatchedSweep } from "./sweep-client";

const mockResult = (url: string): SweepResult => ({
  url,
  title: `Doc ${url}`,
  description: "desc",
  type: "pdf",
  relevanceScore: 0.9,
});

describe("runSweepAgent", () => {
  beforeEach(() => {
    vi.mocked(runBatchedSweep).mockReset();
  });

  it("searches, filters known URLs, and adds new documents", async () => {
    vi.mocked(runBatchedSweep).mockResolvedValue({
      results: [mockResult("https://a.com"), mockResult("https://b.com")],
      provider: "exa",
      batchesCompleted: 1,
    });

    const added: string[] = [];
    const stepSnapshots: string[][] = [];

    const outcome = await runSweepAgent({
      query: "heat transfer",
      excludeUrls: ["https://a.com"],
      onAdd: async (r) => {
        added.push(r.url);
      },
      onSteps: (steps) => {
        stepSnapshots.push(steps.map((s) => s.status));
      },
    });

    expect(outcome.added).toBe(1);
    expect(outcome.skipped).toBe(1);
    expect(added).toEqual(["https://b.com"]);
    expect(stepSnapshots.at(-1)).toEqual(["done", "done", "done", "done"]);
  });

  it("skips add step when all results are already known", async () => {
    vi.mocked(runBatchedSweep).mockResolvedValue({
      results: [mockResult("https://a.com")],
      provider: "exa",
      batchesCompleted: 1,
    });

    const onAdd = vi.fn();
    const outcome = await runSweepAgent({
      query: "fea",
      excludeUrls: ["https://a.com"],
      onAdd,
    });

    expect(outcome.added).toBe(0);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
