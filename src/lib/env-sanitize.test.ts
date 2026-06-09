import { afterEach, describe, expect, it } from "vitest";
import { resolveExaBaseUrl, sanitizeEnvNumber, sanitizeEnvString } from "@/lib/env-sanitize";

describe("env-sanitize", () => {
  afterEach(() => {
    delete process.env.EXA_BASE_URL;
  });

  it("strips PowerShell -NoNewline prefix", () => {
    expect(sanitizeEnvString("-NoNewline https://api.exa.ai")).toBe("https://api.exa.ai");
  });

  it("strips embedded newlines", () => {
    expect(sanitizeEnvString("auto\r\n")).toBe("auto");
  });

  it("parses numeric env values with shell artifacts", () => {
    expect(sanitizeEnvNumber("-NoNewline 50", 20)).toBe(50);
  });

  it("resolves Exa base URL from corrupted env", () => {
    process.env.EXA_BASE_URL = "-NoNewline https://api.exa.ai/search";
    expect(resolveExaBaseUrl()).toBe("https://api.exa.ai");
  });

  it("defaults when env is missing or invalid", () => {
    expect(resolveExaBaseUrl()).toBe("https://api.exa.ai");
    process.env.EXA_BASE_URL = "not-a-url";
    expect(resolveExaBaseUrl()).toBe("https://api.exa.ai");
  });
});
