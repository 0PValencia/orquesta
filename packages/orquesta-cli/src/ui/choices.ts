import { ask, choose } from "./prompt.js";

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
  if (!m) return null;

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

  // Fallback: JSON dentro de <choices>
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
      if (json.question?.trim()) {
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

  if (!options.length) return null;

  return {
    question: q,
    options,
    preamble: text.replace(CHOICES_RE, "").trim(),
  };
}

export function stripChoices(text: string): string {
  return text.replace(CHOICES_RE, "").trim();
}

/**
 * Menú ↑/↓ + Enter. Siempre añade "Opción propia" al final.
 * Devuelve el texto que se reinyecta al agente como respuesta del usuario.
 */
export async function presentChoices(parsed: ParsedChoices): Promise<string> {
  const menu = [
    ...parsed.options.map((label) => ({ label, value: label })),
    { label: "Opción propia", value: "__custom__", hint: "escribir libremente" },
  ];
  const selected = await choose(parsed.question, menu);
  if (selected === "__custom__") {
    const custom = (await ask("Escribe tu opción")).trim();
    return custom || "(sin respuesta)";
  }
  return selected;
}
