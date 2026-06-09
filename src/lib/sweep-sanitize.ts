import type { SweepResult } from "@/types";
import { sanitizeForJson } from "@/lib/json-safe";
import { SWEEP_PREFETCH_MAX_CHARS } from "@/lib/constants";

export function sanitizeSweepResult(result: SweepResult): SweepResult {
  return {
    ...result,
    title: sanitizeForJson(result.title).slice(0, 500),
    url: sanitizeForJson(result.url).slice(0, 2048),
    description: sanitizeForJson(result.description).slice(0, 500),
    category: result.category ? sanitizeForJson(result.category).slice(0, 120) : result.category,
    prefetchedText: result.prefetchedText
      ? sanitizeForJson(result.prefetchedText).slice(0, SWEEP_PREFETCH_MAX_CHARS)
      : undefined,
  };
}

export function sanitizeSweepResults(results: SweepResult[]): SweepResult[] {
  return results.map(sanitizeSweepResult);
}
