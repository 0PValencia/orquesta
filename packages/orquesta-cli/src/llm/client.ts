import OpenAI from "openai";
import type { OrquestaConfig } from "../config.js";

/** Debe coincidir con --max-model-len de Modal (vLLM). */
export const CONTEXT_LIMIT = 8192;

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

export function approxTokens(messages: OpenAI.Chat.ChatCompletionMessageParam[]): number {
  // Heurística barata (español ~3–4 chars/token). Mejor pecar de alto.
  const chars = JSON.stringify(messages).length;
  return Math.ceil(chars / 3);
}

function clampMaxTokens(
  requested: number,
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): number {
  const prompt = approxTokens(messages);
  const room = CONTEXT_LIMIT - prompt - 64;
  if (room < 128) {
    throw new Error(
      `El mensaje es demasiado largo para el modelo (${prompt} tokens aprox. de prompt; límite ${CONTEXT_LIMIT}). Acorta el pedido o empieza un chat nuevo con «salir».`
    );
  }
  return Math.max(128, Math.min(requested, room));
}

function formatApiError(err: unknown): Error {
  if (!err || typeof err !== "object") return new Error(String(err));
  const e = err as {
    message?: string;
    status?: number;
    error?: { message?: string };
  };
  const detail = e.error?.message || e.message || String(err);
  return new Error(detail);
}

export async function chatCompletion(
  client: OpenAI,
  cfg: OrquestaConfig,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const requested = opts?.maxTokens ?? cfg.maxTokens ?? 2048;
  const maxTokens = clampMaxTokens(requested, messages);

  try {
    const res = await client.chat.completions.create({
      model: cfg.model,
      messages,
      temperature: opts?.temperature ?? 0.35,
      max_tokens: maxTokens,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw formatApiError(err);
  }
}
