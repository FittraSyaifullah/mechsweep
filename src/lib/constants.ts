/** Maximum documents the local library can hold. */
export const MAX_LIBRARY_DOCUMENTS = 25_000;

/** Debounce delay before persisting library changes (ms). */
export const LIBRARY_SAVE_DEBOUNCE_MS = 1000;

/** Best-effort localStorage mirror when serialized library is below this size. */
export const LOCAL_STORAGE_BACKUP_MAX_CHARS = 4_000_000;

/** Default Exa results per API request (Exa max 100). */
export const DEFAULT_SWEEP_MAX_RESULTS = 100;

/** Hard cap for a single Exa API request. */
export const MAX_SWEEP_RESULTS = 100;

/** Minimum sweep results per request. */
export const MIN_SWEEP_RESULTS = 1;

/** Default Exa search mode — auto uses full Exa quality. Set EXA_LIGHTWEIGHT=true on Hobby. */
export const DEFAULT_EXA_SEARCH_TYPE = "auto";

/** Server-side max wait for one Exa call (raise on Vercel Pro; keep ≤9000 on Hobby). */
export const SWEEP_SERVER_TIMEOUT_MS = 55_000;

/** Prepended to user sweep queries for mechanical-engineering focus. */
export const EXA_MECHANICAL_QUERY_PREFIX =
  "mechanical engineering documents PDF datasheets CAD STL STEP DWG JSON CSV markdown zip textbooks standards:";

/** Maximum domains Exa can exclude/include per request (Exa API limit). */
export const MAX_EXA_EXCLUDE_DOMAINS = 1200;

/** Total character budget for Exa page text across all sweep results. */
export const EXA_TOTAL_TEXT_BUDGET = 120_000;

/** Max prefetched text returned per sweep result in API responses. */
export const SWEEP_PREFETCH_MAX_CHARS = 800;

/** Max exact URLs sent per sweep request (domains carry the rest via Exa excludeDomains). */
export const SWEEP_MAX_EXCLUDE_URLS = 120;

/** Default unique results collected in one full sweep (batched Exa calls). */
export const DEFAULT_SWEEP_SESSION_MAX = 500;

/** Results per batched /api/sweep call (Exa max 100). */
export const SWEEP_BATCH_SIZE = 50;

/** Max batched Exa calls in one full sweep. */
export const SWEEP_MAX_BATCHES = 10;

/** Parallel document analyses (fetch + AI classify) in the browser. */
export const ANALYZE_CONCURRENCY = 4;

/** In-memory ZIP fallback when showSaveFilePicker is unavailable. */
export const MEMORY_ZIP_MAX_DOCUMENTS = 500;
