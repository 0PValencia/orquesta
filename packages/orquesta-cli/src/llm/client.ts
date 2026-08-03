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
    /** No dejar la UI en “Pensando…” para siempre si Modal no responde. */
    timeout: 90 * 1000,
    maxRetries: 1,
  });
}

export function approxTokens(messages: OpenAI.Chat.ChatCompletionMessageParam[]): number {
  // Heurística conservadora (español + JSON tools). Mejor sobrestimar → evita 400 de vLLM.
  const chars = JSON.stringify(messages).length;
  return Math.ceil(chars / 2.5);
}

function clampMaxTokens(
  requested: number,
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): number {
  const prompt = approxTokens(messages);
  const room = CONTEXT_LIMIT - prompt - 128;
  if (room < 64) {
    // Último intento: el caller debería haber podado; mensaje más claro
    throw new Error(
      `Contexto lleno (~${prompt}/${CONTEXT_LIMIT} tok). Escribí «salir» y arrancá de nuevo, o pedí menos páginas.`
    );
  }
  return Math.max(64, Math.min(requested, room));
}

function formatApiError(err: unknown): Error {
  if (!err || typeof err !== "object") return new Error(String(err));
  const e = err as {
    message?: string;
    status?: number;
    error?: { message?: string; type?: string };
    code?: string;
  };
  const status = e.status;
  const detail = e.error?.message || e.message || String(err);
  if (status === 400 || /400/.test(detail)) {
    return new Error(
      `El servidor del modelo rechazó el pedido (400). ` +
        `Suele ser contexto lleno o max_tokens inválido. Probá «salir» y un pedido más corto. ` +
        `(${detail.slice(0, 180)})`
    );
  }
  if (status) return new Error(`HTTP ${status}: ${detail}`);
  if (/timeout|ETIMEDOUT|AbortError/i.test(detail)) {
    return new Error(
      "El modelo no respondió a tiempo (timeout 90s). Puede estar arrancando en Modal: esperá 1–2 min y reintentá."
    );
  }
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
