import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyExaConnection } from "@/lib/exa";
import { exaSearchEnabled } from "@/lib/search-provider";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const runLive = Boolean(process.env.EXA_API_KEY?.trim()) && exaSearchEnabled();

describe.runIf(runLive)("Exa live integration", () => {
  it("verifies the configured Exa API key returns results", async () => {
    const verified = await verifyExaConnection();
    expect(verified.ok).toBe(true);
    expect(verified.resultCount).toBeGreaterThan(0);
  }, 45_000);
});
