import {
  DEFAULT_SWEEP_MAX_RESULTS,
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
