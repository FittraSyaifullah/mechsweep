/** Keeps long client-side exports alive — wake lock + leave-page warning. */
export class ExportSession {
  private wakeLock: WakeLockSentinel | null = null;
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;

  async begin(
    message = "Export in progress. Leaving this page may interrupt the download."
  ): Promise<void> {
    if (typeof window === "undefined") return;

    if ("wakeLock" in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Screen wake lock is optional (requires visible tab + user gesture).
      }
    }

    this.beforeUnloadHandler = (event) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);

    try {
      await navigator.storage?.persist?.();
    } catch {
      // Best-effort — OPFS may still work without persistent quota.
    }
  }

  end(): void {
    if (typeof window !== "undefined" && this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    void this.wakeLock?.release();
    this.wakeLock = null;
  }
}

export async function withExportSession<T>(
  run: () => Promise<T>,
  message?: string
): Promise<T> {
  const session = new ExportSession();
  await session.begin(message);
  try {
    return await run();
  } finally {
    session.end();
  }
}
