import fs from "node:fs";
import path from "node:path";
import type { OrquestaConfig } from "../config.js";

export type Lesson = {
  ts: string;
  kind: string;
  lesson: string;
  detail?: string;
  documentId?: string;
};

export type TrajectorySummary = {
  ts: string;
  query: string;
  tools: string[];
  documentId?: string;
  url?: string;
  ok: boolean;
  issues: string[];
  charsApprox?: number;
  headings?: number;
};

function memoryDir(cfg: OrquestaConfig): string {
  const dir = path.join(cfg.configDir, "memory");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function lessonsPath(cfg: OrquestaConfig): string {
  return path.join(memoryDir(cfg), "lessons.jsonl");
}

/** Lecciones recientes para inyectar en el system prompt. */
export function loadLessons(cfg: OrquestaConfig, limit = 10): Lesson[] {
  const p = lessonsPath(cfg);
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
  const out: Lesson[] = [];
  for (const line of lines.slice(-Math.max(limit * 3, 30))) {
    try {
      out.push(JSON.parse(line) as Lesson);
    } catch {
      /* ignore */
    }
  }
  // Deduplicar por texto de lección (últimas ganan)
  const seen = new Set<string>();
  const dedup: Lesson[] = [];
  for (let i = out.length - 1; i >= 0; i--) {
    const key = out[i].lesson.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(out[i]);
    if (dedup.length >= limit) break;
  }
  return dedup.reverse();
}

export function formatLessonsForPrompt(lessons: Lesson[]): string {
  if (!lessons.length) return "";
  const bullets = lessons.map((l, i) => `${i + 1}. [${l.kind}] ${l.lesson}`).join("\n");
  return (
    "## Lecciones aprendidas (de auditorías previas — obedécelas)\n" +
    bullets +
    "\n"
  );
}

export function recordLesson(cfg: OrquestaConfig, lesson: Omit<Lesson, "ts">): void {
  const entry: Lesson = { ts: new Date().toISOString(), ...lesson };
  fs.appendFileSync(lessonsPath(cfg), JSON.stringify(entry) + "\n", "utf8");
}

export function recordTrajectory(cfg: OrquestaConfig, summary: TrajectorySummary): void {
  const dir = path.join(memoryDir(cfg), "trajectories");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = summary.ts.replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(summary, null, 2) + "\n", "utf8");
  // Índice append-only para futuro SFT / revisión
  fs.appendFileSync(
    path.join(memoryDir(cfg), "trajectories.jsonl"),
    JSON.stringify(summary) + "\n",
    "utf8"
  );
}

export type StructureAudit = {
  headingCount: number;
  markdownHashTitles: number;
  issues: string[];
  titleCandidates: { startIndex: number; endIndex: number; text: string }[];
};

/** Interpreta get_document_structure (JSON MCP) y lista fallos de formato. */
export function auditDocumentStructure(raw: string): StructureAudit {
  const issues: string[] = [];
  let headingCount = 0;
  let markdownHashTitles = 0;
  const titleCandidates: StructureAudit["titleCandidates"] = [];

  try {
    const parsed = JSON.parse(raw) as {
      content?: { text?: string }[];
      structuredContent?: {
        headings?: unknown[];
        blocks?: {
          type?: string;
          startIndex?: number;
          endIndex?: number;
          text?: string;
          headingLevel?: number | null;
          namedStyleType?: string;
        }[];
      };
    };
    const sc = parsed.structuredContent;
    const textBlob =
      parsed.content?.map((c) => c.text || "").join("\n") ||
      (typeof parsed === "object" ? raw : "");

    // structuredContent puede venir anidado en content[0].text como JSON string
    let blocks = sc?.blocks;
    if (!blocks && parsed.content?.[0]?.text) {
      try {
        const inner = JSON.parse(parsed.content[0].text) as {
          blocks?: typeof blocks;
        };
        blocks = inner.blocks;
      } catch {
        /* ignore */
      }
    }

    headingCount = 0;
    if (blocks) {
      for (const b of blocks) {
        if (b.type !== "paragraph") continue;
        const t = (b.text || "").trim();
        const style = b.namedStyleType || "";
        const isHeadingStyle =
          /^HEADING_|TITLE$/i.test(style) || (b.headingLevel != null && b.headingLevel > 0);
        const looksLikeTitle =
          t.length > 0 &&
          t.length <= 120 &&
          !/^https?:\/\//i.test(t) &&
          !/^[a-z]/.test(t); // títulos suelen Capitalizar / empezar con #
        if (isHeadingStyle && looksLikeTitle) {
          headingCount++;
          if (/^#{1,6}\s/.test(t)) {
            issues.push(
              `El heading todavía tiene "#" literal ("${t.slice(0, 50)}"). ` +
                "Bórralo con replace_text/delete_text; el estilo HEADING_1 no necesita numeral markdown."
            );
          }
        } else if (isHeadingStyle && !looksLikeTitle) {
          issues.push(
            `apply_heading mal usado en párrafo largo/URL ("${t.slice(0, 60)}…"). Solo títulos cortos (≤120 chars).`
          );
        }
        if (/^#{1,3}\s+\S/.test(t) && (!isHeadingStyle || style === "NORMAL_TEXT")) {
          markdownHashTitles++;
          if (typeof b.startIndex === "number" && typeof b.endIndex === "number") {
            titleCandidates.push({
              startIndex: b.startIndex,
              endIndex: b.endIndex,
              text: t.slice(0, 80),
            });
          }
        } else if (
          !isHeadingStyle &&
          t.length > 0 &&
          t.length <= 80 &&
          /^(origen|cultivo|nutrici|conclus|introducci|desaf|bibliograf|recurso|industria)/i.test(
            t.replace(/^#+\s*/, "")
          )
        ) {
          if (typeof b.startIndex === "number" && typeof b.endIndex === "number") {
            titleCandidates.push({
              startIndex: b.startIndex,
              endIndex: b.endIndex,
              text: t.slice(0, 80),
            });
          }
        }
      }
    }

    // También detectar # en texto plano del resultado
    if (!markdownHashTitles) {
      const hashes = (textBlob.match(/(^|\n)#{1,3}\s+\S[^\n]*/g) || []).length;
      markdownHashTitles = hashes;
    }

    // Dedup issues
    const uniq = [...new Set(issues)];
    issues.length = 0;
    issues.push(...uniq.slice(0, 6));

    if (headingCount === 0) {
      issues.push(
        "Sin títulos reales (HEADING_1 cortos). Prohibido '# …' en NORMAL_TEXT; usa apply_heading solo en el renglón del título."
      );
    }
    if (markdownHashTitles > 0) {
      issues.push(
        `Hay ${markdownHashTitles} título(s) markdown (#). Conviértelos con apply_heading (HEADING_1) usando índices de get_document_structure.`
      );
    }
  } catch {
    issues.push("No se pudo parsear get_document_structure; vuelve a llamarla.");
  }

  return { headingCount, markdownHashTitles, issues, titleCandidates };
}
