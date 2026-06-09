/** Maximum documents the local library can hold. */
export const MAX_LIBRARY_DOCUMENTS = 5000;

/** Debounce delay before persisting library changes (ms). */
export const LIBRARY_SAVE_DEBOUNCE_MS = 1000;

/** Default Exa results per API request (Exa max 100). */
export const DEFAULT_SWEEP_MAX_RESULTS = 100;

/** Hard cap for a single Exa API request. */
export const MAX_SWEEP_RESULTS = 100;

/** Minimum sweep results per request. */
export const MIN_SWEEP_RESULTS = 1;

/** Default Exa search mode — fast is reliable on Vercel Hobby (~10s limit). Use auto via env for quality. */
export const DEFAULT_EXA_SEARCH_TYPE = "fast";

/** Server-side max wait for one Exa call (must stay under Vercel function limit). */
export const SWEEP_SERVER_TIMEOUT_MS = 9_000;

/** Prepended to user sweep queries for mechanical-engineering focus. */
export const EXA_MECHANICAL_QUERY_PREFIX =
  "mechanical engineering documents PDF datasheets CAD STL STEP DWG JSON CSV markdown zip textbooks standards:";

/** Maximum domains Exa can exclude/include per request (Exa API limit). */
export const MAX_EXA_EXCLUDE_DOMAINS = 1200;

/** Total character budget for Exa page text across all sweep results. */
export const EXA_TOTAL_TEXT_BUDGET = 120_000;

/** Max prefetched text returned per sweep result in API responses. */
export const SWEEP_PREFETCH_MAX_CHARS = 1_200;

/** Max exclude URLs sent per sweep API request (prevents oversized/truncated JSON bodies). */
export const SWEEP_MAX_EXCLUDE_URLS = 600;

/** Default unique results collected in one full sweep (batched Exa calls). */
export const DEFAULT_SWEEP_SESSION_MAX = 200;

/** Results per batched /api/sweep call (keep low for Vercel Hobby 10s limit). */
export const SWEEP_BATCH_SIZE = 20;

/** Max batched Exa calls in one full sweep. */
export const SWEEP_MAX_BATCHES = 10;
