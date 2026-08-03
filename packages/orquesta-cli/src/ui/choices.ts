import { ask, choose } from "./prompt.js";
import type { OrquestaTui } from "./tui.js";

const CHOICES_RE = /<choices>\s*([\s\S]*?)\s*<\/choices>/i;

export type ParsedChoices = {
  question: string;
  options: string[];
  /** Texto visible del asistente sin el bloque <choices>. */
  preamble: string;
};

/** Extrae un bloque <choices> del modelo (pregunta + opciones). */
export function parseChoices(text: string): ParsedChoices | null {
  const m = text.match(CHOICES_RE);
  if (m) {
    const body = m[1];
    const q =
      body.match(/<question>\s*([\s\S]*?)\s*<\/question>/i)?.[1]?.trim() ||
      "Elige una opción";

    const options: string[] = [];
    const optRe = /<option(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/option>/gi;
    let om: RegExpExecArray | null;
    while ((om = optRe.exec(body))) {
      const label = om[1].replace(/\s+/g, " ").trim();
      if (label && !/^opci[oó]n\s+propia$/i.test(label)) {
        options.push(label);
      }
    }

    if (!options.length) {
      try {
        const json = JSON.parse(body.trim()) as {
          question?: string;
          options?: string[];
        };
        if (Array.isArray(json.options)) {
          for (const o of json.options) {
            const label = String(o).trim();
            if (label && !/^opci[oó]n\s+propia$/i.test(label)) options.push(label);
          }
        }
        if (json.question?.trim() && options.length) {
          return {
            question: json.question.trim(),
            options,
            preamble: text.replace(CHOICES_RE, "").trim(),
          };
        }
      } catch {
        /* ignore */
      }
    }

    if (options.length) {
      return {
        question: q,
        options,
        preamble: text.replace(CHOICES_RE, "").trim(),
      };
    }
  }

  // Fallback: el modelo preguntó con lista numerada (1. 2. 3.)
  return inferChoicesFromNumbered(text);
}

/** Detecta "1. … 2. …" como encuesta cuando no usó <choices>. */
function inferChoicesFromNumbered(text: string): ParsedChoices | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const opts: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:\d+[\).]|[-•])\s+(.+)$/);
    if (!m) continue;
    const label = m[1].replace(/\s+/g, " ").trim();
    // Solo preguntas reales (evita listas de pasos del informe)
    if (!/[¿?]/.test(label)) continue;
    if (label.length < 8 || label.length > 180) continue;
    opts.push(label);
  }
  if (opts.length < 2 || opts.length > 6) return null;
  if (text.length > 2500) return null;
  if (!/\?|necesito|indica|elige|cuál|cuéntame|detalles|orientaci/i.test(text)) return null;

  return {
    question: "Elegí qué completar primero (↑/↓ + enter)",
    options: opts,
    preamble: lines
      .filter((l) => !/^(?:\d+[\).]|[-•])\s+/.test(l))
      .join("\n")
      .trim(),
  };
}

export function stripChoices(text: string): string {
  return text.replace(CHOICES_RE, "").trim();
}

/**
 * Menú ↑/↓ + Enter. Siempre añade "Opción propia" al final.
 * Si hay TUI (alt-screen), usa el picker del TUI.
 */
export async function presentChoices(
  parsed: ParsedChoices,
  tui?: OrquestaTui | null
): Promise<string> {
  const menu = [
    ...parsed.options.map((label) => ({ label, value: label })),
    { label: "Opción propia", value: "__custom__", hint: "escribir libremente" },
  ];

  if (tui) {
    const selected = await tui.pickChoice(parsed.question, menu);
    if (selected === "__custom__") {
      const custom = (await tui.prompt()).trim();
      return custom || "(sin respuesta)";
    }
    return selected;
  }

  const selected = await choose(parsed.question, menu);
  if (selected === "__custom__") {
    const custom = (await ask("Escribe tu opción")).trim();
    return custom || "(sin respuesta)";
  }
  return selected;
}
