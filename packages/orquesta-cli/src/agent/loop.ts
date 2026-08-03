import type OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type OrquestaConfig, loadMcpFile } from "../config.js";
import { approxTokens, chatCompletion, createLlmClient, CONTEXT_LIMIT } from "../llm/client.js";
import {
  callTool,
  closeServers,
  connectServers,
  type ConnectedServer,
  type OrquestaTool,
} from "../mcp/client.js";
import { toolsCatalog } from "../mcp/catalog.js";
import {
  auditDocumentStructure,
  formatLessonsForPrompt,
  loadLessons,
  recordLesson,
  recordTrajectory,
} from "./memory.js";

/** Pedido explícito de Google Docs / Documents / documento remoto. */
const DOCS_INTENT =
  /\b(google\s*docs?|documents?|docs\.google|en\s+(un\s+)?(documento|doc|docs?|documents?)(\s+de\s+google)?|crear\s+(un\s+)?(doc|documento)|documentId|insertar\s+en\s+(el\s+)?doc|escribir\s+en\s+(el\s+)?(doc|docs?|documents?)|sube(lo|r)?\s+a\s+(docs?|documents?)|exportar\s+(a\s+)?(pdf|docs?|documents?)|guarda(r|lo)?\s+en\s+(docs?|documents?))\b/i;

const RESEARCH_INTENT =
  /\b(busca(r)?|investig(a|ar)|fuentes?|internet|web\s*search|con\s+fuentes|datos\s+actuales|cita(s|r)?|referencias?\s+reales)\b/i;

const FULL_REPORT_INTENT =
  /\b(informe\s+completo|proyecto\s+completo|todo\s+el\s+informe|documento\s+completo|perfil\s+completo|(genera(r)?|redacta)\s+(el\s+|un\s+)?informe\s+completo)\b/i;

const SEARCH_TOOL_RE = /^(search|web_search|web-search|news_search)$/i;
const FETCH_TOOL_RE = /^(fetch_content|fetch_url|fetch)$/i;
/** Mínimo de caracteres por bloque append para contar como sección. */
const MIN_SECTION_CHARS = 700;

/** Quita # / ## de títulos markdown; en Docs el estilo lo pone apply_heading. */
function stripMarkdownHeadingMarks(text: string): { text: string; stripped: boolean } {
  const cleaned = text.replace(/^[\t ]{0,3}#{1,6}[ \t]+/gm, "");
  return { text: cleaned, stripped: cleaned !== text };
}

const REPORT_SECTIONS: { id: string; title: string; hint: string }[] = [
  { id: "portada", title: "PORTADA", hint: "Universidad, facultad, grupo, título, integrantes, materia, gestión" },
  { id: "intro", title: "1.1 INTRODUCCIÓN", hint: "30-70 líneas, contexto, importancia SI, dominio" },
  { id: "antec", title: "1.2 ANTECEDENTES", hint: "20-40 líneas, trabajos previos / estado del arte" },
  { id: "just", title: "1.3 JUSTIFICACIÓN", hint: "20-40 líneas, beneficios e importancia" },
  { id: "prob", title: "1.4 DESCRIPCIÓN DEL PROBLEMA", hint: "extensa, por áreas, consecuencias" },
  { id: "form", title: "1.5 FORMULACIÓN DEL PROBLEMA", hint: "pregunta(s) de investigación" },
  { id: "obj", title: "1.6 OBJETIVOS", hint: "general + específicos en infinitivo" },
  { id: "alc", title: "1.7 ALCANCE", hint: "módulos funcionales detallados" },
  { id: "elem", title: "2. ELEMENTOS DEL SISTEMA BASADO EN COMPUTADORAS", hint: "hardware, software, datos, procesos, gente" },
  { id: "tec", title: "3. TECNOLOGÍA PARA EL DESARROLLO", hint: "estrategia, PUDS, UML, herramientas" },
  { id: "cost", title: "4–6. COSTOS, BENEFICIOS Y CLIENTES", hint: "costos, beneficios tiempo/esfuerzo, clientes" },
  { id: "marco", title: "7. MARCO TEÓRICO", hint: "fundamentos TGS, SI, metodologías" },
  { id: "ishi", title: "CAPÍTULO ISHIKAWA", hint: "problemas, causas, diagrama textual" },
  { id: "req", title: "CAPÍTULO REQUISITOS", hint: "actores, casos de uso prioritarios, 3–5 CU detallados de ejemplo" },
  { id: "ana", title: "CAPÍTULO ANÁLISIS", hint: "arquitectura, paquetes, comunicación" },
  { id: "dis", title: "CAPÍTULO DISEÑO", hint: "BD, SQL representativo, secuencia" },
  { id: "imp", title: "CAPÍTULO IMPLEMENTACIÓN", hint: "stack, arquitectura de despliegue" },
  { id: "pru", title: "CAPÍTULO PRUEBAS", hint: "plan y casos de prueba" },
  { id: "conc", title: "CONCLUSIONES", hint: "cumplimiento, metodología, impacto" },
  { id: "rec", title: "RECOMENDACIONES", hint: "institución y futuros desarrolladores" },
  { id: "bib", title: "BIBLIOGRAFÍA", hint: "APA, 6–12 referencias plausibles" },
];

const MAX_TOOL_RESULT_CHARS = 3000;
/** Proteger resultados de tools recientes (estilo OpenCode prune). */
const PROTECT_RECENT_TOOL_CHARS = 12000;

function loadSystemPrompt(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../prompts/system.txt"),
    path.join(here, "../../src/prompts/system.txt"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "Eres Orquesta, agente de informes SI I con MCP.";
}

export type McpStatus = {
  configured: string[];
  connected: string[];
  failed: string[];
  toolCount: number;
};

export type AgentSession = {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  servers: ConnectedServer[];
  tools: OrquestaTool[];
  cfg: OrquestaConfig;
  client: ReturnType<typeof createLlmClient>;
  mcpStatus: McpStatus;
  toolsMode: boolean;
  lastUserQuery: string;
  /** true si este turno ejecutó al menos una tool MCP */
  lastTurnUsedTools: boolean;
};

export async function createSession(cfg: OrquestaConfig): Promise<AgentSession> {
  const mcpFile = loadMcpFile(cfg.mcpPath);
  const configured = Object.keys(mcpFile.mcpServers);
  const { servers, tools, failed } = await connectServers(mcpFile);
  const connected = servers.map((s) => s.name);
  const mcpStatus: McpStatus = {
    configured,
    connected,
    failed,
    toolCount: tools.length,
  };

  const client = createLlmClient(cfg);
  const statusBlock = formatMcpStatusForPrompt(mcpStatus);
  const toolsNote = tools.length
    ? `Hay ${tools.length} tools MCP en: ${connected.join(", ") || "—"}. ` +
      "Ciclo: prompt → LLM → tool_call → historial → repetir. " +
      "Activa tools si pide Docs/Documents o investigación/búsqueda web. " +
      "En Docs usa también get_document_structure, apply_heading, append_bibliography (no solo append_text)."
    : "(sin tools MCP)";
  const lessonsBlock = formatLessonsForPrompt(loadLessons(cfg, 10));
  const system =
    `${loadSystemPrompt()}\n\n` +
    (lessonsBlock ? `${lessonsBlock}\n` : "") +
    `## Estado MCP ahora\n${statusBlock}\n\n## Tools MCP\n${toolsNote}`;

  return {
    messages: [{ role: "system", content: system }],
    servers,
    tools,
    cfg,
    client,
    mcpStatus,
    toolsMode: false,
    lastUserQuery: "",
    lastTurnUsedTools: false,
  };
}

function hasSearchTools(tools: OrquestaTool[]): boolean {
  return tools.some((t) => SEARCH_TOOL_RE.test(t.name));
}

function wantsResearch(userText: string, tools: OrquestaTool[]): boolean {
  if (!hasSearchTools(tools)) return false;
  if (RESEARCH_INTENT.test(userText)) return true;
  // Informes en Docs con páginas/secciones → investigar por defecto
  if (DOCS_INTENT.test(userText) && /\b(informe|p[aá]ginas?|secciones?)\b/i.test(userText)) {
    return true;
  }
  return false;
}

function formatMcpStatusForPrompt(s: McpStatus): string {
  if (!s.configured.length) {
    return "NO HAY servidores MCP configurados. El usuario debe ejecutar: orquesta mcp add";
  }
  const lines = [
    `Configurados: ${s.configured.join(", ") || "(ninguno)"}`,
    `Conectados: ${s.connected.join(", ") || "(ninguno)"}`,
    `Fallidos: ${s.failed.join(", ") || "(ninguno)"}`,
    `Tools activas: ${s.toolCount}`,
  ];
  if (!s.connected.length) {
    lines.push(
      "IMPORTANTE: no hay MCP conectado. Si piden Docs/escritura remota, informa el bloqueo y sugiere orquesta mcp add."
    );
  }
  return lines.join("\n");
}

export function describeMcpStatus(s: McpStatus): string {
  if (!s.configured.length) {
    return "○ Sin herramientas extra (MCP). Puedes redactar igual. Para Docs: orquesta mcp add";
  }
  if (!s.connected.length) {
    return `⚠ Herramientas en config (${s.configured.join(", ")}) pero no conectaron${
      s.failed.length ? ` — revisa: ${s.failed.join(", ")}` : ""
    }.`;
  }
  return `✓ Herramientas listas: ${s.connected.join(", ")} (${s.toolCount} funciones)`;
}

export type AgentEvent =
  | { type: "cycle"; round: number; max: number; promptTokens: number }
  | { type: "tool"; name: string }
  | { type: "retry_format"; reason: string }
  | { type: "info"; text: string };

export type RunTurnOpts = {
  onEvent?: (e: AgentEvent) => void;
};

export async function runTurn(
  session: AgentSession,
  userText: string,
  opts?: RunTurnOpts
): Promise<string> {
  if (DOCS_INTENT.test(userText) && session.tools.length === 0) {
    const msg = noMcpMessage(session.mcpStatus, userText);
    session.messages.push({ role: "user", content: userText });
    session.messages.push({ role: "assistant", content: msg });
    return msg;
  }

  if (FULL_REPORT_INTENT.test(userText) && !DOCS_INTENT.test(userText)) {
    return generateLongReport(session, userText, opts);
  }

  const research = wantsResearch(userText, session.tools);
  if ((DOCS_INTENT.test(userText) || research) && session.tools.length > 0) {
    session.toolsMode = true;
  }
  session.lastUserQuery = userText;
  session.lastTurnUsedTools = false;
  session.messages.push({ role: "user", content: userText });
  if (research) {
    session.messages.push({
      role: "user",
      content:
        "[Orquesta] Flujo obligatorio:\n" +
        "1) search 2–3 queries\n" +
        "2) create_document\n" +
        "3) preferible create_academic_structure O append_text densos (≥700 chars/sección)\n" +
        "   Títulos SIN ningún '#': escribe 'Introducción' no '# Introducción'\n" +
        "4) get_document_structure → apply_heading HEADING_1 solo en el renglón del título\n" +
        "5) append_bibliography con URLs reales de search\n" +
        "No inventes cifras; no declares listo si headings=[] o si queda '#' en un título.",
    });
  } else if (DOCS_INTENT.test(userText)) {
    session.messages.push({
      role: "user",
      content:
        "[Orquesta] En Docs no basta append_text: usa get_document_structure, apply_heading y " +
        "append_bibliography cuando haya fuentes. Prohibido títulos con '# ' en texto plano.",
    });
  }
  return agentLoop(session, opts);
}

/**
 * Bucle estilo OpenCode:
 * 1) prompt = system + historial + schemas tools + pedido
 * 2) LLM
 * 3) si hay tool_call (o JSON de tool) → ejecutar → historial
 * 4) si finge tools sin formato válido → corregir y repetir
 * 5) volver a 2
 */
async function agentLoop(session: AgentSession, opts?: RunTurnOpts): Promise<string> {
  const maxRounds = Math.max(session.cfg.maxToolRounds, 1);
  const emit = opts?.onEvent;
  let final = "";
  let formatRetries = 0;
  let usedTools = false;
  let insertCount = 0;
  let searchCount = 0;
  let structureCalls = 0;
  let headingCalls = 0;
  let bibCalls = 0;
  let academicStructureCalls = 0;
  let createdDoc = false;
  let docUrl = "";
  let docId = "";
  let askedToFinish = false;
  let verifiedContent = false;
  let verifiedStructure = false;
  let structureNudges = 0;
  const toolsUsed: string[] = [];
  const turnIssues: string[] = [];
  let lastChars = 0;
  let lastHeadings = 0;
  const minInserts = estimateMinInserts(session.lastUserQuery);
  const minDocChars = estimateMinDocChars(session.lastUserQuery);
  const needResearch = wantsResearch(session.lastUserQuery, session.tools);
  const minSearches = needResearch ? 2 : 0;
  const needDocsFormat = DOCS_INTENT.test(session.lastUserQuery);
  const hasBibTool = session.tools.some((t) => /append_bibliography$/i.test(t.name));
  const hasHeadingTool = session.tools.some((t) => /apply_heading$/i.test(t.name));

  for (let round = 0; round < maxRounds; round++) {
    // Tras volumen OK: auditar estructura; solo entonces cerrar
    if (createdDoc && insertCount >= minInserts && !askedToFinish) {
      if (!verifiedContent && docId) {
        const readTool = session.tools.find((t) => /read_document$/i.test(t.name));
        if (readTool) {
          emit?.({ type: "tool", name: readTool.name });
          toolsUsed.push(readTool.name);
          try {
            const raw = await callTool(session.servers, session.tools, readTool.fullName, {
              documentId: docId,
            });
            const chars = estimateDocChars(raw);
            lastChars = chars;
            const enough = chars >= minDocChars;
            session.messages.push({
              role: "user",
              content:
                `### ${readTool.name}\n${raw.slice(0, Math.min(2000, MAX_TOOL_RESULT_CHARS))}\n\n` +
                `[Orquesta] Caracteres útiles ≈ ${chars} (mínimo ≈ ${minDocChars}). ` +
                (enough
                  ? "Volumen OK. Siguiente: auditoría de estructura (headings reales)."
                  : "Insuficiente. Más append_text densos."),
            });
            verifiedContent = enough;
            if (!verifiedContent) {
              insertCount = Math.max(0, insertCount - 1);
              continue;
            }
          } catch (err) {
            emit?.({
              type: "info",
              text: `verify falló: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        } else {
          verifiedContent = true;
        }
      }

      if (verifiedContent && needDocsFormat && !verifiedStructure && docId && structureNudges < 4) {
        const structTool = session.tools.find((t) => /get_document_structure$/i.test(t.name));
        if (structTool) {
          emit?.({ type: "tool", name: structTool.name });
          toolsUsed.push(structTool.name);
          structureCalls++;
          const raw = await callTool(session.servers, session.tools, structTool.fullName, {
            documentId: docId,
          });
          const audit = auditDocumentStructure(raw);
          lastHeadings = audit.headingCount;
          const formatGaps: string[] = [...audit.issues];
          if (hasHeadingTool && headingCalls < 1 && audit.headingCount < Math.min(3, minInserts)) {
            formatGaps.push(
              "Falta apply_heading: llama get_document_structure y aplica HEADING_1 a cada título de sección."
            );
          }
          if (needResearch && hasBibTool && bibCalls < 1) {
            formatGaps.push(
              "Falta append_bibliography con entries[] (URLs reales de search). No pegues bib solo con append_text."
            );
          }
          if (academicStructureCalls < 1 && audit.headingCount === 0) {
            formatGaps.push(
              "Opcional pero recomendado: create_academic_structure para portada + headings, o apply_heading manual."
            );
          }

          const candidateHint =
            audit.titleCandidates.length > 0
              ? "\nCandidatos a apply_heading (usa estos índices):\n" +
                audit.titleCandidates
                  .slice(0, 8)
                  .map(
                    (c) =>
                      `- startIndex=${c.startIndex} endIndex=${c.endIndex} text="${c.text.replace(/"/g, "'")}" → style=HEADING_1`
                  )
                  .join("\n")
              : "";

          if (formatGaps.length) {
            structureNudges++;
            turnIssues.push(...formatGaps);
            for (const g of formatGaps.slice(0, 3)) {
              recordLesson(session.cfg, {
                kind: "docs_format",
                lesson: g,
                detail: `doc=${docId}`,
                documentId: docId,
              });
            }
            session.messages.push({
              role: "user",
              content:
                `### ${structTool.name}\n${raw.slice(0, MAX_TOOL_RESULT_CHARS)}\n\n` +
                `[Orquesta AUDITORÍA ${structureNudges}/4] El documento NO pasa formato:\n- ` +
                formatGaps.join("\n- ") +
                candidateHint +
                "\n\nCorrige YA con tool_call (apply_heading / append_bibliography / create_academic_structure). " +
                "No des respuesta final todavía.",
            });
            continue;
          }
          verifiedStructure = true;
        } else {
          verifiedStructure = true;
        }
      } else if (verifiedContent && !needDocsFormat) {
        verifiedStructure = true;
      }

      if (verifiedContent && verifiedStructure) {
        askedToFinish = true;
        session.messages.push({
          role: "user",
          content:
            "Auditoría OK (volumen + headings/bib). NO más tool_call. " +
            "FINAL CORTA: qué hiciste, enlace, partes, tools de formato usadas (apply_heading/bib/search).",
        });
      } else if (verifiedContent && structureNudges >= 4) {
        askedToFinish = true;
        turnIssues.push("Cierre con formato incompleto tras 4 auditorías");
        recordLesson(session.cfg, {
          kind: "docs_format",
          lesson:
            "Tras varias auditorías aún faltaban headings/bib: priorizar apply_heading y append_bibliography antes de cerrar.",
          documentId: docId,
        });
        session.messages.push({
          role: "user",
          content:
            "Se agotaron reintentos de formato. FINAL CORTA con enlace y admite qué formato quedó pendiente.",
        });
      }
    }

    const prompt = buildPrompt(session);
    const promptTokens = approxTokens(prompt);
    emit?.({ type: "cycle", round: round + 1, max: maxRounds, promptTokens });

    const reply = await chatCompletion(session.client, session.cfg, prompt);
    session.messages.push({ role: "assistant", content: reply });

    let calls = parseToolCalls(reply);

    if (askedToFinish) {
      final = stripToolNoise(reply).trim() || reply.trim();
      break;
    }

    // En modo tools: NUNCA aceptar respuesta final sin haber ejecutado tools reales
    if (!calls.length && session.toolsMode && !usedTools) {
      formatRetries++;
      if (formatRetries <= 4) {
        const reason = looksLikeDocsHallucination(reply)
          ? "alucinación Docs sin tool_call"
          : looksLikeFakeTools(reply)
            ? "JSON/tools simulados"
            : "cerró sin tools";
        emit?.({ type: "retry_format", reason });
        const startHint = needResearch
          ? '<tool_call>{"name":"search","arguments":{"query":"…","max_results":5}}</tool_call>\n' +
            "Haz 2–3 búsquedas distintas; luego create_document y append_text densos."
          : '<tool_call>{"name":"create_document","arguments":{"title":"…"}}</tool_call>\n' +
            "Luego append_text con el documentId REAL.";
        session.messages.push({
          role: "user",
          content:
            "ERROR: Aún no ejecutaste ninguna tool MCP. Prohibido inventar documentId/URLs.\n" +
            "Prohibido ```json. Empieza YA con:\n" +
            startHint,
        });
        continue;
      }
    }

    // Exigir investigación antes de crear/escribir Doc
    if (
      !calls.length &&
      session.toolsMode &&
      usedTools &&
      needResearch &&
      searchCount < minSearches &&
      !createdDoc
    ) {
      formatRetries++;
      if (formatRetries <= 3) {
        emit?.({
          type: "retry_format",
          reason: `faltan búsquedas (${searchCount}/${minSearches})`,
        });
        session.messages.push({
          role: "user",
          content:
            `ERROR: Solo ${searchCount} search(es); mínimo ${minSearches} queries distintas antes de create_document.\n` +
            '<tool_call>{"name":"search","arguments":{"query":"…","max_results":5}}</tool_call>',
        });
        continue;
      }
    }

    if (!calls.length && session.toolsMode && usedTools && createdDoc && insertCount < minInserts) {
      formatRetries++;
      if (formatRetries <= 3) {
        emit?.({
          type: "retry_format",
          reason: `faltan secciones (${insertCount}/${minInserts})`,
        });
        session.messages.push({
          role: "user",
          content:
            `ERROR: Solo hay ${insertCount} bloque(s); hacen falta ≥${minInserts} con ≥${MIN_SECTION_CHARS} chars c/u.\n` +
            `append_text (documentId=${docId || "el real"}) con párrafos densos anclados a fuentes. No cierres.`,
        });
        continue;
      }
    }

    if (!calls.length && session.toolsMode && looksLikeFakeTools(reply) && usedTools) {
      formatRetries++;
      if (formatRetries <= 2) {
        emit?.({
          type: "retry_format",
          reason: "JSON simulado; pidiendo <tool_call> real",
        });
        session.messages.push({
          role: "user",
          content:
            "ERROR: Formato inválido. Usa solo:\n" +
            '<tool_call>{"name":"append_text","arguments":{"documentId":"…","text":"…"}}</tool_call>',
        });
        continue;
      }
    }

    if (!calls.length) {
      final = stripToolNoise(reply).trim() || reply.trim();
      break;
    }

    if (session.tools.length === 0) {
      final =
        stripToolNoise(reply).trim() +
        "\n\n[Orquesta] No hay MCP. Ejecuta: orquesta mcp add";
      break;
    }

    // Bloquear create/append si aún no investigó
    if (needResearch && searchCount < minSearches) {
      const premature = calls.filter(
        (c) =>
          /create_document|generate_academic|insert_text|append_text|replace_text/i.test(c.name)
      );
      if (premature.length && !calls.some((c) => SEARCH_TOOL_RE.test(c.name))) {
        formatRetries++;
        if (formatRetries <= 3) {
          emit?.({
            type: "retry_format",
            reason: "intentó Docs antes de search",
          });
          session.messages.push({
            role: "user",
            content:
              `ERROR: Primero investiga (search ${searchCount}/${minSearches}). ` +
              "No crees ni escribas el Doc todavía.\n" +
              '<tool_call>{"name":"search","arguments":{"query":"…","max_results":5}}</tool_call>',
          });
          continue;
        }
      }
    }

    session.toolsMode = true;
    formatRetries = 0;
    usedTools = true;
    const resultBlocks: string[] = [];

    const batch = calls.slice(0, 2);
    for (const call of batch) {
      const args = { ...call.arguments };
      if (docId && typeof args.documentId === "string") {
        const claimed = args.documentId;
        if (/^(document_id_here|…|\.{3}|xxx|1234|abcdef)/i.test(claimed) || claimed.length < 20) {
          args.documentId = docId;
        }
      }
      if (SEARCH_TOOL_RE.test(call.name) && args.max_results == null) {
        args.max_results = 5;
      }

      let mdHashStripped = false;
      if (/insert_text|append_text|replace_text/i.test(call.name) && typeof args.text === "string") {
        const cleaned = stripMarkdownHeadingMarks(args.text);
        if (cleaned.stripped) {
          args.text = cleaned.text;
          mdHashStripped = true;
          recordLesson(session.cfg, {
            kind: "docs_format",
            lesson:
              "NUNCA escribas '#' ni '##' en títulos de Google Docs. El título va en texto plano y apply_heading pone el estilo.",
            documentId: docId,
          });
        }
      }

      if (/apply_heading$/i.test(call.name)) {
        const start = Number(args.startIndex);
        const end = Number(args.endIndex);
        const span = Number.isFinite(start) && Number.isFinite(end) ? end - start : 9999;
        if (!(span > 0 && span <= 120)) {
          emit?.({ type: "tool", name: call.name });
          toolsUsed.push(call.name);
          resultBlocks.push(
            `### ${call.name}\n[Orquesta] Rango rechazado (span=${span}). ` +
              `apply_heading solo al renglón del título (≤120 chars). No apliques HEADING al cuerpo ni a URLs.`
          );
          recordLesson(session.cfg, {
            kind: "docs_format",
            lesson:
              "apply_heading solo en el párrafo-título corto (endIndex-startIndex ≤ 120); nunca al cuerpo ni a URLs.",
            documentId: docId,
          });
          continue;
        }
      }

      emit?.({ type: "tool", name: call.name });
      toolsUsed.push(call.name);
      const raw = await callTool(session.servers, session.tools, call.name, args);
      const meta = extractDocMeta(raw);
      if (meta.url) docUrl = meta.url;
      if (meta.id) docId = meta.id;
      if (/create_document|generate_academic/i.test(call.name)) createdDoc = true;
      if (SEARCH_TOOL_RE.test(call.name)) searchCount++;
      if (FETCH_TOOL_RE.test(call.name)) searchCount = Math.max(searchCount, 1);
      if (/get_document_structure$/i.test(call.name)) structureCalls++;
      if (/apply_heading$/i.test(call.name)) {
        headingCalls++;
        verifiedStructure = false;
        structureNudges = Math.min(structureNudges, 2);
      }
      if (/append_bibliography$/i.test(call.name)) {
        bibCalls++;
        verifiedStructure = false;
        structureNudges = Math.min(structureNudges, 2);
      }
      if (/create_academic_structure$/i.test(call.name)) {
        academicStructureCalls++;
        verifiedStructure = false;
      }
      if (/format_academic_document|insert_table_of_contents|apply_format/i.test(call.name)) {
        verifiedStructure = false;
      }

      const clipped =
        raw.length > MAX_TOOL_RESULT_CHARS
          ? raw.slice(0, MAX_TOOL_RESULT_CHARS) + "\n…[resultado truncado]"
          : raw;

      if (/insert_text|append_text|replace_text/i.test(call.name)) {
        const textArg = typeof args.text === "string" ? args.text : "";
        if (textArg.trim().length >= MIN_SECTION_CHARS) {
          insertCount++;
          let note = `### ${call.name}\n${clipped}`;
          if (mdHashStripped) {
            note +=
              "\n\n[Orquesta] Se eliminaron '#' markdown del texto antes de escribir. " +
              "En Docs: título en texto plano + apply_heading (HEADING_1). Nunca escribas '# Introducción'.";
          }
          resultBlocks.push(note);
        } else {
          resultBlocks.push(
            `### ${call.name}\n${clipped}\n\n[Orquesta] Texto corto (${textArg.trim().length} chars; mínimo ${MIN_SECTION_CHARS}). ` +
              `Reescribe la sección completa con ≥3 párrafos densos vía append_text.`
          );
        }
      } else {
        resultBlocks.push(`### ${call.name}\n${clipped}`);
      }
    }

    let nextHint: string;
    if (needResearch && searchCount < minSearches) {
      nextHint = `Sigue investigando: search ${searchCount}/${minSearches}. Luego create_document.`;
    } else if (!createdDoc && DOCS_INTENT.test(session.lastUserQuery)) {
      nextHint =
        searchCount > 0
          ? `Fuentes OK (${searchCount} search). create_document → cuerpo → get_document_structure → apply_heading → append_bibliography.`
          : `Continúa: create_document → append_text densos → apply_heading.`;
    } else if (createdDoc && insertCount >= minInserts && !verifiedStructure) {
      nextHint =
        `Bloques texto ${insertCount}/${minInserts}. Formato: structure=${structureCalls} heading=${headingCalls} bib=${bibCalls}. ` +
        `Obligatorio: get_document_structure + apply_heading` +
        (needResearch && hasBibTool ? " + append_bibliography" : "") +
        ". NO cierres.";
    } else if (createdDoc && insertCount >= minInserts) {
      nextHint = `Volumen y formato en camino. FINAL CORTA si la auditoría pasó; si no, corrige headings/bib.`;
    } else if (createdDoc) {
      nextHint =
        `documentId=${docId || "(mira create_document)"}. Bloques ${insertCount}/${minInserts}. ` +
        `append_text densos (≥${MIN_SECTION_CHARS} chars) SIN '# markdown'. Luego headings.`;
    } else {
      nextHint = `Continúa con tools según el pedido.`;
    }

    session.messages.push({
      role: "user",
      content:
        `Resultados REALES (ciclo ${round + 1}):\n\n` +
        resultBlocks.join("\n\n") +
        `\n\n${nextHint}`,
    });
  }

  if (!final) {
    final =
      docUrl || docId
        ? `Listo.\nDocumento: ${docUrl || docId}\n\nContenido insertado vía MCP.`
        : "Se alcanzó el límite de ciclos sin respuesta final. Reformula o revisa MCP.";
  }

  session.lastTurnUsedTools = usedTools;
  if (usedTools) {
    final = compressDocsFinalReply(final, { url: docUrl, id: docId });
  }

  recordTrajectory(session.cfg, {
    ts: new Date().toISOString(),
    query: session.lastUserQuery.slice(0, 500),
    tools: toolsUsed,
    documentId: docId || undefined,
    url: docUrl || undefined,
    ok: Boolean(docId && verifiedContent && (verifiedStructure || !needDocsFormat)),
    issues: [...new Set(turnIssues)].slice(0, 12),
    charsApprox: lastChars || undefined,
    headings: lastHeadings || undefined,
  });

  return final;
}

function estimateMinInserts(userText: string): number {
  const pages = userText.match(/(\d+)\s*p[aá]ginas?/i)?.[1];
  if (pages) return Math.min(8, Math.max(3, Number(pages)));
  const secs = userText.match(/(\d+)\s*secciones?/i)?.[1];
  if (secs) return Math.min(8, Math.max(3, Number(secs)));
  return 4;
}

function estimateMinDocChars(userText: string): number {
  const pages = Number(userText.match(/(\d+)\s*p[aá]ginas?/i)?.[1] || 0);
  if (pages > 0) return Math.min(20000, Math.max(2500, pages * 1800));
  return 2500;
}

function estimateDocChars(raw: string): number {
  try {
    const parsed = JSON.parse(raw) as { content?: { text?: string }[] };
    const text = parsed.content?.map((c) => c.text || "").join("\n") || raw;
    return text.replace(/\s+/g, " ").trim().length;
  } catch {
    return raw.replace(/[{}\[\]",]/g, " ").replace(/\s+/g, " ").trim().length;
  }
}

function looksLikeDocsHallucination(text: string): boolean {
  return (
    /cre[eé]\s+(un\s+)?documento|documentId\s*es|docs\.google\.com\/document/i.test(text) ||
    /[0-9a-f]{32,}/i.test(text) ||
    /secciones?\s+escritas|contenido\s+insertado/i.test(text)
  );
}

function extractDocMeta(raw: string): { url?: string; id?: string } {
  const url = raw.match(/https:\/\/docs\.google\.com\/[^\s\"'\\]+/)?.[0];
  const id =
    raw.match(/"documentId"\s*:\s*"([^"]+)"/)?.[1] ||
    raw.match(/"id"\s*:\s*"([1-9A-Za-z_-]{20,})"/)?.[1];
  return { url, id };
}

/** Evita volcar el informe entero en el chat tras usar Docs. */
function compressDocsFinalReply(
  text: string,
  meta?: { url?: string; id?: string }
): string {
  const urls = text.match(/https:\/\/docs\.google\.com\/[^\s\)\]\"']+/g) || [];
  const url = meta?.url || urls[0];
  const id = meta?.id;
  if (text.length <= 900 && url && /enlace|document|partes|listo|hecho|cre/i.test(text)) {
    return text;
  }
  const lines = [
    "Listo.",
    url ? `Documento: ${url}` : id ? `documentId: ${id}` : "Revisa el documento en Google Docs.",
    "",
    "Abrí el enlace para ver el contenido. Si falta alguna sección, pedímela.",
  ];
  const bullets = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^([-*]|\d+\.)\s+/.test(l) && l.length < 120)
    .slice(0, 8);
  if (bullets.length) {
    lines.splice(2, 0, "Partes:", ...bullets, "");
  }
  return lines.join("\n");
}

type ParsedCall = { name: string; arguments: Record<string, unknown> };

function tryParseCall(raw: string): ParsedCall | null {
  try {
    const parsed = JSON.parse(raw.trim()) as {
      name?: string;
      tool?: string;
      arguments?: Record<string, unknown>;
      args?: Record<string, unknown>;
      params?: Record<string, unknown>;
    };
    const name = (parsed.name || parsed.tool || "").trim();
    if (!name) return null;
    // Placeholder inventado → inválido
    const args = parsed.arguments || parsed.args || parsed.params || {};
    return { name, arguments: args };
  } catch {
    return null;
  }
}

/** Acepta <tool_call>, fences ```json y objetos sueltos {name, arguments}. */
function parseToolCalls(text: string): ParsedCall[] {
  const out: ParsedCall[] = [];
  const seen = new Set<string>();

  const add = (c: ParsedCall | null) => {
    if (!c) return;
    const key = `${c.name}:${JSON.stringify(c.arguments)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  const tagRe = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text))) add(tryParseCall(m[1]));

  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  while ((m = fenceRe.exec(text))) {
    const body = m[1].trim();
    if (body.startsWith("{")) add(tryParseCall(body));
    else if (body.startsWith("[")) {
      try {
        const arr = JSON.parse(body) as unknown[];
        for (const item of arr) {
          if (item && typeof item === "object") add(tryParseCall(JSON.stringify(item)));
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Objetos JSON sueltos con "name" y "arguments"
  const objRe =
    /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"(?:arguments|args|params)"\s*:\s*\{[\s\S]*?\}\s*\}/g;
  while ((m = objRe.exec(text))) add(tryParseCall(m[0]));

  return out;
}

function looksLikeFakeTools(text: string): boolean {
  return (
    /create_document|insert_text|append_text|get_document_structure|document_id_here|Ejecutando:|web_search|\bsearch\b|fetch_content/i.test(
      text
    ) || /```json[\s\S]*"name"\s*:/i.test(text)
  );
}

function stripToolNoise(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/```(?:json)?\s*\{[\s\S]*?"name"\s*:[\s\S]*?\}\s*```/gi, "")
    .trim();
}

/** system + (schemas si toolsMode) + historial podado */
function buildPrompt(session: AgentSession): OpenAI.Chat.ChatCompletionMessageParam[] {
  const history = pruneHistory(session.messages);
  if (!session.toolsMode || !session.tools.length) {
    return history;
  }

  const schemas = toolsCatalog(session.tools, {
    maxTools: 18,
    query: session.lastUserQuery,
  });

  const toolsMsg: OpenAI.Chat.ChatCompletionMessageParam = {
    role: "system",
    content:
      `## Tools MCP este ciclo\n${schemas}\n\n` +
      `OBLIGATORIO tool_call:\n` +
      `<tool_call>{"name":"NOMBRE","arguments":{...}}</tool_call>\n` +
      `Docs: search → create_document → cuerpo → get_document_structure → apply_heading → append_bibliography.\n` +
      `Prohibido: solo append_text, títulos markdown #, inventar documentId/índices, \`\`\`json.\n` +
      `FINAL: resumen corto + enlace + tools de formato usadas.`,
  };

  if (history[0]?.role === "system") {
    return [history[0], toolsMsg, ...history.slice(1)];
  }
  return [toolsMsg, ...history];
}

function pruneHistory(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (messages.length <= 2) return messages;

  const system = messages[0]?.role === "system" ? [messages[0]] : [];
  let rest = (system.length ? messages.slice(1) : [...messages]).map((m) => {
    if (m.role !== "user" || typeof m.content !== "string") return m;
    if (!/Resultado(s)? (REALES|de (la )?tool)/i.test(m.content)) return m;
    if (m.content.length <= MAX_TOOL_RESULT_CHARS) return m;
    return {
      ...m,
      content: m.content.slice(0, MAX_TOOL_RESULT_CHARS) + "\n…[truncado]",
    };
  });

  // Proteger cola reciente de resultados; compactar los viejos
  let toolBudget = 0;
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    if (m.role !== "user" || typeof m.content !== "string") continue;
    if (!/Resultado(s)? (REALES|de (la )?tool)/i.test(m.content)) continue;
    toolBudget += m.content.length;
    if (toolBudget > PROTECT_RECENT_TOOL_CHARS) {
      rest[i] = {
        ...m,
        content: "[Resultado de tool anterior omitido para liberar contexto]",
      };
    }
  }

  let packed = [...system, ...rest];
  // Si aún excede ~70% del contexto, soltar mensajes viejos
  const softCap = Math.floor(CONTEXT_LIMIT * 0.7 * 3); // chars aprox
  while (packed.length > 4 && JSON.stringify(packed).length > softCap) {
    packed.splice(system.length, 1);
  }
  return packed;
}

async function generateLongReport(
  session: AgentSession,
  userText: string,
  opts?: RunTurnOpts
): Promise<string> {
  opts?.onEvent?.({
    type: "info",
    text: `Informe largo → ${REPORT_SECTIONS.length} secciones`,
  });

  const parts: string[] = [];
  const context = `Pedido del usuario:\n${userText}\n\nRedacta SOLO la sección indicada, extensa y formal (tercera persona), lista para un informe SI I de ~100–120 páginas en total. No resumas de más. No uses tool_call.`;

  for (let i = 0; i < REPORT_SECTIONS.length; i++) {
    const sec = REPORT_SECTIONS[i];
    opts?.onEvent?.({
      type: "info",
      text: `Sección ${i + 1}/${REPORT_SECTIONS.length}: ${sec.title}`,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      session.messages[0],
      {
        role: "user",
        content: `${context}\n\nSección a redactar: ${sec.title}\nGuía: ${sec.hint}\n\nSecciones ya escritas (resumen de continuidad):\n${
          parts.length ? parts.map((p) => p.slice(0, 400)).join("\n---\n").slice(0, 6000) : "(ninguna aún)"
        }`,
      },
    ];

    const body = await chatCompletion(session.client, session.cfg, messages, {
      maxTokens: session.cfg.maxTokens,
    });
    parts.push(`\n\n# ${sec.title}\n\n${body.trim()}\n`);
  }

  const full = parts.join("");
  session.messages.push({ role: "user", content: userText });
  session.messages.push({
    role: "assistant",
    content: `Informe generado por secciones (${REPORT_SECTIONS.length}). Extensión aprox. ${full.length} caracteres.`,
  });
  return full.trim();
}

function noMcpMessage(status: McpStatus, userText: string): string {
  const wantsDocs = DOCS_INTENT.test(userText);
  const lines = ["No puedo completar la parte de Google Docs / MCP ahora.", ""];
  if (!status.configured.length) {
    lines.push("No detecto ningún servidor MCP configurado.");
    lines.push("Para añadir uno:");
    lines.push("  orquesta mcp add");
  } else if (!status.connected.length) {
    lines.push(`Hay herramientas en config (${status.configured.join(", ")}) pero no conectaron.`);
    if (status.failed.length) {
      lines.push(`Fallaron: ${status.failed.join(", ")}`);
    }
    lines.push("Revisa con: orquesta mcp show <nombre>");
    lines.push("O vuelve a añadir: orquesta mcp add");
  }
  lines.push("");
  if (wantsDocs) {
    lines.push(
      "Sí puedo redactar aquí el contenido del informe (sin insertarlo en Docs). ¿Quieres que lo genere en el chat?"
    );
  }
  return lines.join("\n");
}

export async function endSession(session: AgentSession): Promise<void> {
  await closeServers(session.servers);
}
