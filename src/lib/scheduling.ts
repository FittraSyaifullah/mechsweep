/** Yield so the browser can paint and handle input. */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Throttle progress callbacks so large exports stay responsive. */
export function createThrottledProgress<T>(
  onProgress: ((value: T) => void) | undefined,
  minIntervalMs = 120
): (value: T) => void {
  if (!onProgress) return () => {};

  let lastEmit = 0;
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (pending === null) return;
    onProgress(pending);
    pending = null;
    lastEmit = Date.now();
  };

  return (value: T) => {
    pending = value;
    const now = Date.now();
    if (now - lastEmit >= minIntervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
      return;
    }
    if (!timer) {
      timer = setTimeout(flush, minIntervalMs - (now - lastEmit));
    }
  };
}

/** Force a final progress emit after throttling. */
export function flushThrottledProgress<T>(
  report: (value: T) => void,
  value: T
): void {
  report(value);
}

/** Libraries above this should use streaming folder/ZIP export only. */
export const SYNC_EXPORT_MAX_DOCUMENTS = 100;
