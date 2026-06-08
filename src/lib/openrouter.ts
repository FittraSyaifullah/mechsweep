interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterOptions {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
}

export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const model =
    options.model ??
    process.env.OPENROUTER_MODEL ??
    "google/gemini-2.5-flash-lite";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "MechSweep",
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.3,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenRouter response");
  }

  return content;
}

export async function callOpenRouterEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const model = process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "MechSweep",
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter embedding error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) throw new Error("No embedding in OpenRouter response");
  return embedding;
}
