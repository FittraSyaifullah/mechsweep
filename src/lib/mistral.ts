interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralOptions {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
}

export async function callMistral(options: MistralOptions): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  const baseUrl = process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1";
  const model =
    options.model ??
    process.env.MISTRAL_MODEL ??
    "mistral-small-latest";

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
    throw new Error(`Mistral API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in Mistral response");
  }

  return content;
}

export async function callMistralEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  const baseUrl = process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1";
  const model = process.env.MISTRAL_EMBEDDING_MODEL ?? "mistral-embed";

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model,
      input: [input],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mistral embedding error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) throw new Error("No embedding in Mistral response");
  return embedding;
}
