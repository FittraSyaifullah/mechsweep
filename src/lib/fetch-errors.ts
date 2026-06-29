import { MAX_FETCH_BYTES } from "@/lib/constants";
import { URL_EXTENSION_PATTERN } from "@/lib/file-types";

export { MAX_FETCH_BYTES };

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function oversizedDocumentMessage(bytes: number): string {
  return `Document is too large (${formatMegabytes(bytes)}). The local limit is ${formatMegabytes(
    MAX_FETCH_BYTES
  )}; try a smaller file or split the source.`;
}

export function failedStatusMessage(status: number, statusText: string, url: string): string {
  if (status === 404) return `URL not found (404): ${url}`;
  if (status === 403) return `Access denied by the source (403): ${url}`;
  if (status >= 500) return `Source server failed (${status} ${statusText || "error"}): ${url}`;
  return `Could not fetch URL (${status} ${statusText || "error"}): ${url}`;
}

export function unsupportedContentTypeMessage(contentType: string | null, url: string): string {
  return `Unsupported document type${
    contentType ? ` (${contentType})` : ""
  }: ${url}. Supported formats: PDF, JSON, CSV, STL, STEP, TXT, DWG, MD, ZIP, or readable HTML.`;
}

export function fetchExceptionMessage(error: unknown, url?: string): {
  message: string;
  status: number;
} {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      message: `Fetch timed out${url ? `: ${url}` : ""}. Try a smaller or faster source.`,
      status: 504,
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      message: `Fetch was aborted${url ? `: ${url}` : ""}. Try again.`,
      status: 504,
    };
  }

  if (error instanceof TypeError) {
    const detail = error.message.toLowerCase();
    if (detail.includes("certificate") || detail.includes("ssl") || detail.includes("tls")) {
      return {
        message: `Secure connection failed${url ? `: ${url}` : ""}. The source may have an invalid certificate.`,
        status: 502,
      };
    }
    return {
      message: `URL could not be reached${url ? `: ${url}` : ""}. Check that it is public and online.`,
      status: 502,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Fetch failed",
    status: 500,
  };
}

export function isSupportedContentType(contentType: string | null, url?: string): boolean {
  if (!contentType) return true;
  const lower = contentType.toLowerCase();
  if (lower.includes("application/octet-stream")) {
    if (!url) return true;
    return URL_EXTENSION_PATTERN.test(url);
  }
  if (lower.includes("application/download")) return true;
  return (
    lower.includes("application/pdf") ||
    lower.includes("text/csv") ||
    lower.includes("application/csv") ||
    lower.includes("application/json") ||
    lower.includes("+json") ||
    lower.includes("text/markdown") ||
    lower.includes("application/zip") ||
    lower.includes("application/x-zip-compressed") ||
    lower.includes("model/stl") ||
    lower.includes("application/sla") ||
    lower.includes("model/step") ||
    lower.includes("application/step") ||
    lower.includes("application/acad") ||
    lower.includes("image/vnd.dwg") ||
    lower.includes("text/plain") ||
    lower.includes("text/html") ||
    lower.includes("application/xhtml+xml") ||
    (url ? URL_EXTENSION_PATTERN.test(url) : false)
  );
}
