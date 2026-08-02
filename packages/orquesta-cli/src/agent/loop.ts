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

/** Pedido explícito de Google Docs / Documents / documento remoto. */
const DOCS_INTENT =
  /\b(google\s*docs?|documents?|docs\.google|en\s+(un\s+)?(documento|doc|docs?|documents?)(\s+de\s+google)?|crear\s+(un\s+)?(doc|documento)|documentId|insertar\s+en\s+(el\s+)?doc|escribir\s+en\s+(el\s+)?(doc|docs?|documents?)|sube(lo|r)?\s+a\s+(docs?|documents?)|exportar\s+(a\s+)?(pdf|docs?|documents?)|guarda(r|lo)?\s+en\s+(docs?|documents?))\b/i;

const FULL_REPORT_INTENT =
  /\b(informe\s+completo|proyecto\s+completo|todo\s+el\s+informe|documento\s+completo|perfil\s+completo|(genera(r)?|redacta)\s+(el\s+|un\s+)?informe\s+completo)\b/i;

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
      "En modo tools el ciclo es: prompt(system+historial+schemas)+LLM → ejecutar tool_call → historial → repetir. " +
      "Activa tools solo si el usuario pide Docs/Documents/documento remoto."
    : "(sin tools MCP)";
  const system = `${loadSystemPrompt()}\n\n## Estado MCP ahora\n${statusBlock}\n\n## Tools MCP\n${toolsNote}`;

  return {
    messages: [{ role: "system", content: system }],
    servers,
    tools,
    cfg,
    client,
    mcpStatus,
    toolsMode: false,
    lastUserQuery: "",
  };
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

  if (DOCS_INTENT.test(userText) && session.tools.length > 0) {
    session.toolsMode = true;
  }
  session.lastUserQuery = userText;
  session.messages.push({ role: "user", content: userText });
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

  for (let round = 0; round < maxRounds; round++) {
    const prompt = buildPrompt(session);
    const promptTokens = approxTokens(prompt);
    emit?.({ type: "cycle", round: round + 1, max: maxRounds, promptTokens });

    const reply = await chatCompletion(session.client, session.cfg, prompt);
    session.messages.push({ role: "assistant", content: reply });

    let calls = parseToolCalls(reply);

    // El modelo a menudo pone JSON en ``` sin <tool_call> — ya lo parseamos;
    // si aún finge usar MCP, forzar reintento.
    if (!calls.length && session.toolsMode && looksLikeFakeTools(reply)) {
      formatRetries++;
      if (formatRetries <= 3) {
        emit?.({
          type: "retry_format",
          reason: "respondió con JSON simulado; pidiendo <tool_call> real",
        });
        session.messages.push({
          role: "user",
          content:
            "ERROR: No ejecutaste ninguna tool. Prohibido simular ni usar ```json. " +
            "Responde AHORA solo con una o más llamadas en este formato exacto (nada más):\n" +
            '<tool_call>{"name":"create_document","arguments":{"title":"Consecuencias de la Guerra"}}</tool_call>\n' +
            "Empieza por create_document. No inventes documentId.",
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
        "\n\n[Orquesta] Intenté usar tools pero no hay MCP. Ejecuta: orquesta mcp add";
      break;
    }

    session.toolsMode = true;
    formatRetries = 0;
    const resultBlocks: string[] = [];

    // Máx 3 tools por ciclo para no inflar contexto
    const batch = calls.slice(0, 3);
    for (const call of batch) {
      emit?.({ type: "tool", name: call.name });
      const raw = await callTool(session.servers, session.tools, call.name, call.arguments);
      const clipped =
        raw.length > MAX_TOOL_RESULT_CHARS
          ? raw.slice(0, MAX_TOOL_RESULT_CHARS) + "\n…[resultado truncado]"
          : raw;
      resultBlocks.push(`### ${call.name}\n${clipped}`);
    }

    session.messages.push({
      role: "user",
      content:
        `Resultados REALES de tools (ciclo ${round + 1}):\n\n` +
        resultBlocks.join("\n\n") +
        `\n\nUsa documentId/índices de estos resultados. ` +
        `Siguiente: más <tool_call> o respuesta final breve con el link/id del documento.`,
    });
  }

  if (!final) {
    final =
      "Se alcanzó el límite de ciclos de tools sin respuesta final. Reformula el pedido o revisa los MCP.";
  }
  return final;
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
    /create_document|insert_text|append_text|get_document_structure|document_id_here|Ejecutando:/i.test(
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
      `OBLIGATORIO: para usar una tool emite EXACTAMENTE:\n` +
      `<tool_call>{"name":"NOMBRE","arguments":{...}}</tool_call>\n` +
      `Prohibido: markdown \`\`\`json, inventar documentId, decir que ya ejecutaste sin tool_call.\n` +
      `Flujo típico Docs: create_document → (opcional structure) → get_document_structure → insert_text por sección.`,
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
    if (!/Resultado(s)? de (la )?tool/i.test(m.content)) return m;
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
    if (!/Resultado(s)? de (la )?tool/i.test(m.content)) continue;
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
