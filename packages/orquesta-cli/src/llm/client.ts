import OpenAI from "openai";
import type { OrquestaConfig } from "../config.js";

export function createLlmClient(cfg: OrquestaConfig): OpenAI {
  if (!cfg.baseUrl) {
    throw new Error(
      "Falta ORQUESTA_BASE_URL. Ejemplo: https://<workspace>--orquesta-informes-serve.modal.run/v1"
    );
  }
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseUrl,
  });
}

export async function chatCompletion(
  client: OpenAI,
  cfg: OrquestaConfig,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await client.chat.completions.create({
    model: cfg.model,
    messages,
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 2048,
  });
  return res.choices[0]?.message?.content ?? "";
}
