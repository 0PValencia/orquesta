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

function loadSystemPrompt(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../prompts/system.txt"), // dist/prompts when built
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
  const catalog = toolsCatalog(tools);
  const statusBlock = formatMcpStatusForPrompt(mcpStatus);
  const system = `${loadSystemPrompt()}\n\n## Estado MCP ahora\n${statusBlock}\n\n## Tools MCP disponibles\n${catalog}`;

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
      "IMPORTANTE: no hay MCP conectado. Si piden Docs/escritura remota, informa el bloqueo y sugiere orquesta mcp add / revisar comando."
    );
  }
  return lines.join("\n");
}

export function describeMcpStatus(s: McpStatus): string {
  if (!s.configured.length) {
    return "⚠ No hay MCP configurados. Añade uno con: orquesta mcp add";
  }
  if (!s.connected.length) {
    return `⚠ MCP configurados (${s.configured.join(", ")}) pero ninguno conectó${
      s.failed.length ? ` — fallaron: ${s.failed.join(", ")}` : ""
    }.`;
  }
  return `✓ MCP: ${s.connected.join(", ")} (${s.toolCount} tools)`;
}

export async function runTurn(session: AgentSession, userText: string): Promise<string> {
  // Decisión local antes del LLM: tarea Docs sin MCP
  if (DOCS_INTENT.test(userText) && session.tools.length === 0) {
    const msg = noMcpMessage(session.mcpStatus, userText);
    session.messages.push({ role: "user", content: userText });
    session.messages.push({ role: "assistant", content: msg });
    return msg;
  }

  session.messages.push({ role: "user", content: userText });

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
    final = "Se alcanzó el límite de rondas de tools sin respuesta final. Reformula el pedido o revisa los MCP.";
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
    lines.push("Para añadir uno (como OpenCode):");
    lines.push("  orquesta mcp add");
  } else if (!status.connected.length) {
    lines.push(`Hay MCP en config (${status.configured.join(", ")}) pero no conectaron.`);
    if (status.failed.length) {
      lines.push(`Fallaron: ${status.failed.join(", ")}`);
    }
    lines.push("Revisa el comando/URL con: orquesta mcp show <nombre>");
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
