import OpenAI from "openai";
import type { OrquestaConfig } from "../config.js";

export function createLlmClient(cfg: OrquestaConfig): OpenAI {
  if (!cfg.baseUrl) {
    throw new Error("No hay servidor de modelo configurado.");
  }
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseUrl,
    timeout: 10 * 60 * 1000,
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
    temperature: opts?.temperature ?? 0.35,
    max_tokens: opts?.maxTokens ?? cfg.maxTokens ?? 4096,
  });
  return res.choices[0]?.message?.content ?? "";
}
