import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI provider routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.MISTRAL_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_FALLBACK_ENABLED;
  });

  it("uses Mistral when configured and does not fall back by default", async () => {
    process.env.MISTRAL_API_KEY = "test-mistral-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("mistral.ai")) {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"results":[]}' } }],
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const { callChatAI } = await import("@/lib/ai");
    const result = await callChatAI({
      messages: [{ role: "user", content: "test" }],
      responseFormat: { type: "json_object" },
    });

    expect(result.provider).toBe("mistral");
    expect(result.text).toContain("results");
  });

  it("falls back to OpenRouter only when explicitly enabled", async () => {
    process.env.MISTRAL_API_KEY = "test-mistral-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.OPENROUTER_FALLBACK_ENABLED = "true";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("mistral.ai")) {
          return new Response(JSON.stringify({ detail: "Internal Server Error" }), {
            status: 500,
          });
        }
        if (url.includes("openrouter.ai")) {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"results":[]}' } }],
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const { callChatAI } = await import("@/lib/ai");
    const result = await callChatAI({
      messages: [{ role: "user", content: "test" }],
      responseFormat: { type: "json_object" },
    });

    expect(result.provider).toBe("openrouter");
  });
});
