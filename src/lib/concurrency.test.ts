import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "@/lib/concurrency";

describe("runWithConcurrency", () => {
  it("runs all items", async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("respects concurrency limit", async () => {
    let active = 0;
    let peak = 0;

    await runWithConcurrency(Array.from({ length: 8 }, (_, i) => i), 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });
});
