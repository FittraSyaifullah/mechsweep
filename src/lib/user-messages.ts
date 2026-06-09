export interface UserFacingError {
  title: string;
  detail?: string;
  retryable: boolean;
}

/** Turn raw API/network errors into short, actionable copy. */
export function formatUserError(message: string): UserFacingError {
  const lower = message.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return {
      title: "Search timed out",
      detail: "Try a narrower query, or use Sweep more to fetch additional results in smaller batches.",
      retryable: true,
    };
  }

  if (lower.includes("json parse") || lower.includes("invalid json")) {
    return {
      title: "Could not read the server response",
      detail: "Retry the sweep. If this keeps happening, refresh the page.",
      retryable: true,
    };
  }

  if (lower.includes("exa_api_key") || lower.includes("exa api") || lower.includes("parse url")) {
    return {
      title: "Exa search is unavailable",
      detail: message,
      retryable: false,
    };
  }

  if (lower.includes("library full")) {
    return { title: "Library is full", detail: message, retryable: false };
  }

  if (message.length > 160) {
    return { title: "Something went wrong", detail: message, retryable: true };
  }

  return { title: message, retryable: true };
}

export function relevancePercent(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}
