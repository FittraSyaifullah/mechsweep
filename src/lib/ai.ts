import { callMistral } from "@/lib/mistral";
import { callOpenRouter } from "@/lib/openrouter";

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

export async function callChatAI(options: ChatAIOptions): Promise<string> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();

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
      const reason = error instanceof Error ? error.message : "Unknown Mistral error";
      console.warn(`Mistral request failed, falling back to OpenRouter: ${reason}`);
    }
  }

  return callOpenRouter({
    model: options.openRouterModel,
    messages: options.messages,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    responseFormat: options.responseFormat,
    timeoutMs: options.timeoutMs,
  });
}
