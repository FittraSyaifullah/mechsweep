import { callMistral, callMistralEmbedding } from "@/lib/mistral";
import { callOpenRouter, callOpenRouterEmbedding } from "@/lib/openrouter";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatAIOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
  mistralModel?: string;
  openRouterModel?: string;
}

function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function callChatAI(options: ChatAIOptions): Promise<string> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  let mistralError: Error | null = null;

  if (mistralKey) {
    try {
      return await callMistral({
        model: options.mistralModel,
        messages: options.messages,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        responseFormat: options.responseFormat,
        timeoutMs: options.timeoutMs,
      });
    } catch (error) {
      mistralError = error instanceof Error ? error : new Error("Unknown Mistral error");
      console.warn(`Mistral request failed: ${mistralError.message}`);
    }
  }

  if (hasOpenRouterKey()) {
    console.warn("Falling back to OpenRouter");
    return callOpenRouter({
      model: options.openRouterModel,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      responseFormat: options.responseFormat,
      timeoutMs: options.timeoutMs,
    });
  }

  if (mistralError) throw mistralError;
  throw new Error("MISTRAL_API_KEY is not configured");
}

export async function callEmbeddingAI(input: string): Promise<number[]> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  let mistralError: Error | null = null;

  if (mistralKey) {
    try {
      return await callMistralEmbedding(input);
    } catch (error) {
      mistralError = error instanceof Error ? error : new Error("Unknown Mistral error");
      console.warn(`Mistral embedding failed: ${mistralError.message}`);
    }
  }

  if (hasOpenRouterKey()) {
    console.warn("Falling back to OpenRouter for embeddings");
    return callOpenRouterEmbedding(input);
  }

  if (mistralError) throw mistralError;
  throw new Error("MISTRAL_API_KEY is not configured");
}
