/** Maximum documents the local library can hold. */
export const MAX_LIBRARY_DOCUMENTS = 5000;

/** Debounce delay before persisting library changes (ms). */
export const LIBRARY_SAVE_DEBOUNCE_MS = 1000;

/** Default web sweep results returned per search request. */
export const DEFAULT_SWEEP_MAX_RESULTS = 100;

/** Hard cap for a single sweep request (Exa API limit). */
export const MAX_SWEEP_RESULTS = 100;

/** Minimum sweep results per request. */
export const MIN_SWEEP_RESULTS = 1;

/** Maximum domains Exa can exclude per request. */
export const MAX_EXA_EXCLUDE_DOMAINS = 50;

/** Total character budget for Exa page text across all sweep results. */
export const EXA_TOTAL_TEXT_BUDGET = 120_000;

/** Max prefetched text returned per sweep result in API responses. */
export const SWEEP_PREFETCH_MAX_CHARS = 2_500;
