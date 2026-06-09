import {
  DEFAULT_SWEEP_MAX_RESULTS,
  EXA_TOTAL_TEXT_BUDGET,
  MAX_EXA_EXCLUDE_DOMAINS,
  MAX_SWEEP_RESULTS,
  MIN_SWEEP_RESULTS,
} from "@/lib/constants";

export function resolveSweepMaxResults(override?: number): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.min(Math.max(Math.floor(override), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
  }

  const raw = Number(
    process.env.SWEEP_MAX_RESULTS ?? process.env.EXA_NUM_RESULTS ?? DEFAULT_SWEEP_MAX_RESULTS
  );

  if (!Number.isFinite(raw)) return DEFAULT_SWEEP_MAX_RESULTS;
  return Math.min(Math.max(Math.floor(raw), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
}

export function resolveExaExcludeDomainLimit(): number {
  return MAX_EXA_EXCLUDE_DOMAINS;
}

/** Scale Exa text extraction so large sweeps stay within payload/time limits. */
export function resolveExaTextMaxCharacters(numResults: number): number {
  const count = Math.max(numResults, 1);
  return Math.min(12_000, Math.max(1_500, Math.floor(EXA_TOTAL_TEXT_BUDGET / count)));
}

/** Full page text is only fetched for smaller sweeps; larger ones rely on highlights. */
export function exaIncludesFullText(numResults: number): boolean {
  return numResults < 50;
}
