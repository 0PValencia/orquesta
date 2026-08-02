import type OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type OrquestaConfig, loadMcpFile } from "../config.js";
import { chatCompletion, createLlmClient } from "../llm/client.js";
import {
  callTool,
  closeServers,
  connectServers,
  toolsCatalog,
  type ConnectedServer,
  type OrquestaTool,
} from "../mcp/client.js";

const TOOL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i;

const DOCS_INTENT =
  /\b(google\s*docs?|documento|documentId|crear doc|insertar|escribir en docs|sube(lo|r)? a docs|exportar (a )?pdf|mcp)\b/i;

/** Pedido de informe largo / completo → generar por secciones (≈120 págs no caben en 1 respuesta). */
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
    ? `Hay ${tools.length} tools MCP listas (${connected.join(", ") || "—"}). ` +
      "El listado detallado se añade solo cuando el usuario pide Google Docs / documentos. " +
      "Para redactar texto en el chat NO uses tools."
    : "(sin tools MCP)";
  const system = `${loadSystemPrompt()}\n\n## Estado MCP ahora\n${statusBlock}\n\n## Tools MCP\n${toolsNote}`;

  return {
    messages: [{ role: "system", content: system }],
    servers,
    tools,
    cfg,
    client,
    mcpStatus,
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

export async function runTurn(session: AgentSession, userText: string): Promise<string> {
  if (DOCS_INTENT.test(userText) && session.tools.length === 0) {
    const msg = noMcpMessage(session.mcpStatus, userText);
    session.messages.push({ role: "user", content: userText });
    session.messages.push({ role: "assistant", content: msg });
    return msg;
  }

  // Informe largo: una sección por llamada (capaz de acercarse a decenas/centenas de páginas)
  if (FULL_REPORT_INTENT.test(userText) && !DOCS_INTENT.test(userText)) {
    return generateLongReport(session, userText);
  }

  let content = userText;
  if (DOCS_INTENT.test(userText) && session.tools.length > 0) {
    content =
      `${userText}\n\n## Catálogo MCP (usa tool_call si hace falta)\n` +
      toolsCatalog(session.tools, { maxChars: 2800 });
  }
  session.messages.push({ role: "user", content });
  return agentLoop(session);
}

async function generateLongReport(session: AgentSession, userText: string): Promise<string> {
  process.stderr.write(
    `[orquesta] Informe largo → ${REPORT_SECTIONS.length} secciones (así se alcanzan informes extensos).\n`
  );

  const parts: string[] = [];
  const context = `Pedido del usuario:\n${userText}\n\nRedacta SOLO la sección indicada, extensa y formal (tercera persona), lista para un informe SI I de ~100–120 páginas en total. No resumas de más. No uses tool_call.`;

  for (let i = 0; i < REPORT_SECTIONS.length; i++) {
    const sec = REPORT_SECTIONS[i];
    process.stderr.write(`[orquesta] Sección ${i + 1}/${REPORT_SECTIONS.length}: ${sec.title}\n`);

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

async function agentLoop(session: AgentSession): Promise<string> {
  let final = "";
  for (let round = 0; round < session.cfg.maxToolRounds; round++) {
    const reply = await chatCompletion(session.client, session.cfg, session.messages);
    session.messages.push({ role: "assistant", content: reply });

    const match = reply.match(TOOL_RE);
    if (!match) {
      final = reply;
      break;
    }

    if (session.tools.length === 0) {
      final =
        reply.replace(TOOL_RE, "").trim() +
        "\n\n[Orquesta] Intenté usar una tool pero no hay MCP conectado. Ejecuta: orquesta mcp add";
      break;
    }

    let parsed: { name?: string; arguments?: Record<string, unknown> };
    try {
      parsed = JSON.parse(match[1].trim()) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    } catch {
      session.messages.push({
        role: "user",
        content: "Resultado tool: JSON inválido en tool_call. Corrige el formato.",
      });
      continue;
    }

    const name = parsed.name || "";
    const args = parsed.arguments || {};
    process.stderr.write(`[orquesta] tool → ${name}\n`);
    const result = await callTool(session.servers, session.tools, name, args);
    session.messages.push({
      role: "user",
      content: `Resultado de la tool ${name}:\n${result}\n\nContinúa: otra tool_call o respuesta final al usuario.`,
    });
  }

  if (!final) {
    final =
      "Se alcanzó el límite de rondas de tools sin respuesta final. Reformula el pedido o revisa los MCP.";
  }
  return final;
}

function noMcpMessage(status: McpStatus, userText: string): string {
  const wantsDocs = DOCS_INTENT.test(userText);
  const lines = [
    "No puedo completar la parte de Google Docs / MCP ahora.",
    "",
  ];
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
