import { describe, expect, it } from "vitest";
import { inferContentKind, isPdfBuffer } from "@/lib/fetch-document";
import {
  failedStatusMessage,
  fetchExceptionMessage,
  isSupportedContentType,
  oversizedDocumentMessage,
} from "@/lib/fetch-errors";

describe("fetch error helpers", () => {
  it("returns clear status messages", () => {
    expect(failedStatusMessage(404, "Not Found", "https://example.com/a")).toContain(
      "URL not found"
    );
    expect(failedStatusMessage(403, "Forbidden", "https://example.com/a")).toContain(
      "Access denied"
    );
  });

  it("classifies timeout and network exceptions", () => {
    expect(fetchExceptionMessage(new DOMException("timeout", "TimeoutError")).status).toBe(504);
    expect(fetchExceptionMessage(new TypeError("fetch failed")).status).toBe(502);
    expect(fetchExceptionMessage(new TypeError("certificate has expired")).message).toContain(
      "Secure connection failed"
    );
  });

  it("detects oversized and unsupported content", () => {
    expect(oversizedDocumentMessage(20 * 1024 * 1024)).toContain("too large");
    expect(isSupportedContentType("image/png")).toBe(false);
    expect(isSupportedContentType("application/pdf")).toBe(true);
    expect(isSupportedContentType("application/octet-stream", "https://x.com/a.pdf")).toBe(true);
    expect(isSupportedContentType("application/octet-stream", "https://x.com/a.bin")).toBe(false);
  });
});

describe("fetch document helpers", () => {
  it("detects pdf buffers and inferred kinds", () => {
    const pdf = Buffer.from("%PDF-1.4 sample");
    expect(isPdfBuffer(pdf)).toBe(true);
    expect(inferContentKind("application/octet-stream", "https://x.com/file", pdf)).toBe("pdf");
    expect(inferContentKind("text/plain", "https://x.com/readme.txt")).toBe("text");
  });
});
