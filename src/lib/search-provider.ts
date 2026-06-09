import { describeExaSearchProfile } from "@/lib/exa-config";

export type WebSearchProvider = "exa" | "mistral";

/** Primary web search provider. Exa when key is set (default). */
export function resolveWebSearchProvider(): WebSearchProvider {
  const configured = process.env.SEARCH_PROVIDER?.trim().toLowerCase();

  if (configured === "mistral") return "mistral";
  if (configured === "exa" || !configured) {
    return process.env.EXA_API_KEY?.trim() ? "exa" : "mistral";
  }

  return process.env.EXA_API_KEY?.trim() ? "exa" : "mistral";
}

export function exaSearchEnabled(): boolean {
  return resolveWebSearchProvider() === "exa";
}

/** Opt-in only — Exa is primary; Mistral web search is not used unless this is true. */
export function sweepMistralFallbackEnabled(): boolean {
  return process.env.SWEEP_MISTRAL_FALLBACK?.trim().toLowerCase() === "true";
}

export function requireExaApiKey(): string {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "EXA_API_KEY is not configured. Set EXA_API_KEY and SEARCH_PROVIDER=exa for web search."
    );
  }
  return apiKey;
}

export function describeWebSearchSetup() {
  const provider = resolveWebSearchProvider();
  const exaKeyConfigured = Boolean(process.env.EXA_API_KEY?.trim());

  return {
    primaryProvider: provider,
    exaConfigured: exaKeyConfigured,
    exaProfile: provider === "exa" ? describeExaSearchProfile() : null,
    mistralFallbackEnabled: sweepMistralFallbackEnabled(),
    analyzeProvider: "mistral",
  };
}
