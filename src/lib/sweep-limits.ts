import {
  DEFAULT_SWEEP_MAX_RESULTS,
  DEFAULT_SWEEP_SESSION_MAX,
  EXA_TOTAL_TEXT_BUDGET,
  MAX_EXA_EXCLUDE_DOMAINS,
  MAX_SWEEP_RESULTS,
  MIN_SWEEP_RESULTS,
  SWEEP_BATCH_SIZE,
  SWEEP_MAX_BATCHES,
  SWEEP_SERVER_TIMEOUT_MS,
} from "@/lib/constants";
import { sanitizeEnvNumber, sanitizeEnvString } from "@/lib/env-sanitize";

export function resolveSweepMaxResults(override?: number): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.min(Math.max(Math.floor(override), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
  }

  const raw = sanitizeEnvNumber(
    process.env.SWEEP_MAX_RESULTS ?? process.env.EXA_NUM_RESULTS,
    DEFAULT_SWEEP_MAX_RESULTS
  );
  return Math.min(Math.max(Math.floor(raw), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
}

/** Per-request batch size (each /api/sweep call). */
export function resolveSweepBatchSize(override?: number): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.min(Math.max(Math.floor(override), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
  }

  const raw = sanitizeEnvNumber(process.env.SWEEP_BATCH_SIZE, SWEEP_BATCH_SIZE);
  return Math.min(Math.max(Math.floor(raw), MIN_SWEEP_RESULTS), MAX_SWEEP_RESULTS);
}

/** Total unique results to collect across batched Exa calls in one sweep. */
export function resolveSweepSessionMax(override?: number): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.min(Math.max(Math.floor(override), MIN_SWEEP_RESULTS), resolveSweepSessionCap());
  }

  const raw = sanitizeEnvNumber(
    process.env.SWEEP_SESSION_MAX ?? process.env.SWEEP_MAX_RESULTS,
    DEFAULT_SWEEP_SESSION_MAX
  );
  return Math.min(Math.max(Math.floor(raw), MIN_SWEEP_RESULTS), resolveSweepSessionCap());
}

export function resolveSweepMaxBatches(): number {
  const raw = sanitizeEnvNumber(process.env.SWEEP_MAX_BATCHES, SWEEP_MAX_BATCHES);
  return Math.min(Math.max(Math.floor(raw), 1), 50);
}

export function resolveSweepSessionCap(): number {
  return resolveSweepBatchSize() * resolveSweepMaxBatches();
}

export function sweepBatchCount(
  totalTarget: number,
  batchSize: number,
  singleBatch = false
): number {
  if (singleBatch) return 1;
  const maxBatches = resolveSweepMaxBatches();
  const needed = Math.max(1, Math.ceil(totalTarget / batchSize));
  return Math.min(needed, maxBatches);
}

/** Cap a single sweep request to one batch. */
export function resolveSweepRequestLimit(requested?: number): number {
  const batchSize = resolveSweepBatchSize();
  if (requested === undefined) return batchSize;
  return Math.min(resolveSweepMaxResults(requested), batchSize);
}

export function resolveExaExcludeDomainLimit(): number {
  const raw = Number(process.env.EXA_EXCLUDE_DOMAIN_LIMIT ?? MAX_EXA_EXCLUDE_DOMAINS);
  if (!Number.isFinite(raw)) return MAX_EXA_EXCLUDE_DOMAINS;
  return Math.min(Math.max(Math.floor(raw), 1), MAX_EXA_EXCLUDE_DOMAINS);
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

/** Scale Exa fetch timeout — capped for Vercel serverless (Hobby ≈10s). */
export function resolveExaRequestTimeoutMs(
  numResults: number,
  searchType = "fast"
): number {
  const platformCap = sanitizeEnvNumber(
    process.env.SWEEP_SERVER_TIMEOUT_MS,
    SWEEP_SERVER_TIMEOUT_MS
  );

  const base =
    searchType === "deep-reasoning"
      ? 55_000
      : searchType.startsWith("deep")
        ? 45_000
        : searchType === "auto"
          ? 35_000
          : searchType === "fast"
            ? 12_000
            : 10_000;

  return Math.min(platformCap, base, 8_000 + Math.max(numResults, 1) * 450);
}

export function resolveSweepServerTimeoutMs(): number {
  return resolveExaRequestTimeoutMs(resolveSweepBatchSize(), "fast");
}
