import {
  DEFAULT_EXA_SEARCH_TYPE,
  EXA_MECHANICAL_QUERY_PREFIX,
  MAX_EXA_EXCLUDE_DOMAINS,
  SWEEP_BATCH_SIZE,
} from "@/lib/constants";
import {
  exaIncludesFullText,
  resolveExaExcludeDomainLimit,
  resolveExaRequestTimeoutMs,
  resolveExaTextMaxCharacters,
  resolveSweepBatchSize,
} from "@/lib/sweep-limits";

export const EXA_SEARCH_TYPES = [
  "auto",
  "instant",
  "fast",
  "deep-lite",
  "deep",
  "deep-reasoning",
] as const;

export type ExaSearchType = (typeof EXA_SEARCH_TYPES)[number];

export const EXA_CATEGORIES = [
  "company",
  "people",
  "research paper",
  "news",
  "personal site",
  "financial report",
] as const;

export type ExaCategory = (typeof EXA_CATEGORIES)[number];

export interface ExaSearchRequestOptions {
  query: string;
  numResults: number;
  excludeUrls?: string[];
  excludeDomains?: string[];
}

export interface ExaSearchRequestBody {
  query: string;
  type: ExaSearchType;
  numResults: number;
  contents: Record<string, unknown>;
  excludeDomains?: string[];
  includeDomains?: string[];
  category?: ExaCategory;
  additionalQueries?: string[];
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function resolveExaSearchType(): ExaSearchType {
  const raw = (process.env.EXA_SEARCH_TYPE?.trim() || DEFAULT_EXA_SEARCH_TYPE).toLowerCase();
  return EXA_SEARCH_TYPES.includes(raw as ExaSearchType)
    ? (raw as ExaSearchType)
    : DEFAULT_EXA_SEARCH_TYPE;
}

export function resolveExaCategory(): ExaCategory | undefined {
  const raw = process.env.EXA_CATEGORY?.trim().toLowerCase();
  if (!raw || raw === "none") return undefined;
  return EXA_CATEGORIES.includes(raw as ExaCategory) ? (raw as ExaCategory) : undefined;
}

export function resolveExaIncludeDomains(): string[] {
  const raw = process.env.EXA_INCLUDE_DOMAINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)
    .slice(0, MAX_EXA_EXCLUDE_DOMAINS);
}

export function resolveExaQueryPrefix(): string {
  return process.env.EXA_QUERY_PREFIX?.trim() || EXA_MECHANICAL_QUERY_PREFIX;
}

export function buildExaSearchQuery(userQuery: string): string {
  const trimmed = userQuery.trim();
  const prefix = resolveExaQueryPrefix();
  if (!prefix) return trimmed || "mechanical engineering documents";
  if (!trimmed) return prefix;
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase().slice(0, 24))) return trimmed;
  return `${prefix} ${trimmed}`;
}

export function buildExaExcludeDomains(excludeUrls: string[] = []): string[] {
  return Array.from(
    new Set(
      excludeUrls
        .map(hostnameFromUrl)
        .filter((host): host is string => Boolean(host))
    )
  ).slice(0, resolveExaExcludeDomainLimit());
}

export function buildExaContentsOptions(numResults: number): Record<string, unknown> {
  const highlightBudget = Math.min(2000, resolveExaTextMaxCharacters(numResults));
  const lightweight = process.env.EXA_LIGHTWEIGHT?.trim().toLowerCase() === "true";
  const fullContents = process.env.EXA_FULL_CONTENTS?.trim().toLowerCase() === "true";

  if (!lightweight && fullContents && exaIncludesFullText(numResults)) {
    return {
      highlights: true,
      summary: true,
      text: { maxCharacters: resolveExaTextMaxCharacters(numResults) },
    };
  }

  if (lightweight) {
    return {
      highlights: { maxCharacters: Math.min(1500, highlightBudget) },
    };
  }

  return {
    highlights: { maxCharacters: highlightBudget },
    summary: true,
  };
}

export function resolveExaAdditionalQueries(userQuery: string): string[] | undefined {
  const raw = process.env.EXA_ADDITIONAL_QUERIES?.trim();
  if (raw) {
    return raw
      .split("|")
      .map((query) => query.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  const searchType = resolveExaSearchType();
  if (!searchType.startsWith("deep")) return undefined;

  const trimmed = userQuery.trim();
  if (!trimmed) return undefined;

  return [
    `${trimmed} PDF datasheet`,
    `${trimmed} engineering textbook`,
    `${trimmed} CAD STL STEP`,
  ].slice(0, 3);
}

/** Batch size tuned to search type and serverless timeout budget. */
export function resolveEffectiveExaBatchSize(): number {
  const configured = resolveSweepBatchSize();
  const searchType = resolveExaSearchType();

  if (searchType.startsWith("deep")) {
    return Math.min(configured, Number(process.env.EXA_DEEP_BATCH_SIZE ?? 10));
  }
  if (searchType === "auto") {
    return Math.min(configured, Number(process.env.EXA_AUTO_BATCH_SIZE ?? 50));
  }
  return configured;
}

export function buildExaSearchRequestBody(
  options: ExaSearchRequestOptions
): ExaSearchRequestBody {
  const searchType = resolveExaSearchType();
  const numResults = Math.min(Math.max(Math.floor(options.numResults), 1), 100);
  const includeDomains = resolveExaIncludeDomains();
  const excludeDomains =
    options.excludeDomains && options.excludeDomains.length > 0
      ? options.excludeDomains.slice(0, resolveExaExcludeDomainLimit())
      : buildExaExcludeDomains(options.excludeUrls);
  const category = resolveExaCategory();
  const additionalQueries = resolveExaAdditionalQueries(options.query);

  return {
    query: buildExaSearchQuery(options.query),
    type: searchType,
    numResults,
    contents: buildExaContentsOptions(numResults),
    ...(includeDomains.length > 0 ? { includeDomains } : {}),
    ...(excludeDomains.length > 0 ? { excludeDomains } : {}),
    ...(category ? { category } : {}),
    ...(additionalQueries ? { additionalQueries } : {}),
  };
}

export function describeExaSearchProfile(): {
  searchType: ExaSearchType;
  batchSize: number;
  requestTimeoutMs: number;
  category?: ExaCategory;
} {
  const batchSize = resolveEffectiveExaBatchSize();
  return {
    searchType: resolveExaSearchType(),
    batchSize,
    requestTimeoutMs: resolveExaRequestTimeoutMs(batchSize, resolveExaSearchType()),
    category: resolveExaCategory(),
  };
}

export { resolveExaRequestTimeoutMs };

/** Client-side default batch size (mirrors server when env unset). */
export const CLIENT_SWEEP_BATCH_SIZE = SWEEP_BATCH_SIZE;
