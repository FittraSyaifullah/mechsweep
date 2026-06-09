import {
  DEFAULT_SWEEP_MAX_RESULTS,
  EXA_TOTAL_TEXT_BUDGET,
  MAX_EXA_EXCLUDE_DOMAINS,
  MAX_SWEEP_RESULTS,
  MIN_SWEEP_RESULTS,
  SWEEP_BATCH_SIZE,
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

/** Per-request batch size (each /api/sweep call). */
export function resolveSweepBatchSize(override?: number): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.min(Math.max(Math.floor(override), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
  }

  const raw = Number(process.env.SWEEP_BATCH_SIZE ?? SWEEP_BATCH_SIZE);
  if (!Number.isFinite(raw)) return SWEEP_BATCH_SIZE;
  return Math.min(Math.max(Math.floor(raw), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
}

/** Cap a single sweep request to one batch. */
export function resolveSweepRequestLimit(requested?: number): number {
  const batchSize = resolveSweepBatchSize();
  if (requested === undefined) return batchSize;
  return Math.min(resolveSweepMaxResults(requested), batchSize);
}

export function sweepBatchCount(totalTarget: number, batchSize: number, singleBatch = false): number {
  if (singleBatch) return 1;
  return Math.max(1, Math.ceil(totalTarget / batchSize));
}

export function resolveExaExcludeDomainLimit(): number {
  return MAX_EXA_EXCLUDE_DOMAINS;
}

/** Scale Exa text extraction so large sweeps stay within payload/time limits. */
export function resolveExaTextMaxCharacters(numResults: number): number {
  const count = Math.max(numResults, 1);
  return Math.min(12_000, Math.max(1_500, Math.floor(EXA_TOTAL_TEXT_BUDGET / count)));
}

/** Full page text only for very small batches; larger ones use highlights only. */
export function exaIncludesFullText(numResults: number): boolean {
  return numResults < resolveSweepBatchSize();
}

/** Scale Exa fetch timeout with batch size (keeps each request under serverless limits). */
export function resolveExaRequestTimeoutMs(numResults: number): number {
  return Math.min(28_000, 8_000 + Math.max(numResults, 1) * 500);
}
