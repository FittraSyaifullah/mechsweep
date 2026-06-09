import { callMistral, callMistralEmbedding } from "@/lib/mistral";
import { callOpenRouter, callOpenRouterEmbedding } from "@/lib/openrouter";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AIProvider = "mistral" | "openrouter";

export interface ChatAIOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
  mistralModel?: string;
  openRouterModel?: string;
}

export interface ChatAIResult {
  text: string;
  provider: AIProvider;
}

export interface EmbeddingAIResult {
  embedding: number[];
  provider: AIProvider;
}

function openRouterFallbackEnabled(): boolean {
  return process.env.OPENROUTER_FALLBACK_ENABLED?.trim().toLowerCase() === "true";
}

function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function callChatAI(options: ChatAIOptions): Promise<ChatAIResult> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  let mistralError: Error | null = null;

  if (mistralKey) {
    try {
      const text = await callMistral({
        model: options.mistralModel,
        messages: options.messages,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        responseFormat: options.responseFormat,
        timeoutMs: options.timeoutMs,
      });
      return { text, provider: "mistral" };
    } catch (error) {
      mistralError = error instanceof Error ? error : new Error("Unknown Mistral error");
      console.warn(`Mistral request failed: ${mistralError.message}`);
    }
  }

  if (openRouterFallbackEnabled() && hasOpenRouterKey()) {
    console.warn("Falling back to OpenRouter");
    const text = await callOpenRouter({
      model: options.openRouterModel,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      responseFormat: options.responseFormat,
      timeoutMs: options.timeoutMs,
    });
    return { text, provider: "openrouter" };
  }

  if (mistralError) throw mistralError;
  throw new Error("MISTRAL_API_KEY is not configured");
}

export async function callEmbeddingAI(input: string): Promise<EmbeddingAIResult> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  let mistralError: Error | null = null;

  if (mistralKey) {
    try {
      const embedding = await callMistralEmbedding(input);
      return { embedding, provider: "mistral" };
    } catch (error) {
      mistralError = error instanceof Error ? error : new Error("Unknown Mistral error");
      console.warn(`Mistral embedding failed: ${mistralError.message}`);
    }
  }

  if (openRouterFallbackEnabled() && hasOpenRouterKey()) {
    console.warn("Falling back to OpenRouter for embeddings");
    const embedding = await callOpenRouterEmbedding(input);
    return { embedding, provider: "openrouter" };
  }

  if (mistralError) throw mistralError;
  throw new Error("MISTRAL_API_KEY is not configured");
}
