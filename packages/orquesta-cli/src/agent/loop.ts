import type OpenAI from "openai";
import { SYSTEM_PROMPT, type OrquestaConfig } from "../config.js";
import { chatCompletion, createLlmClient } from "../llm/client.js";
import {
  callTool,
  closeServers,
  connectServers,
  toolsCatalog,
  type ConnectedServer,
  type OrquestaTool,
} from "../mcp/client.js";
import { loadMcpFile } from "../config.js";

const TOOL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i;

export type AgentSession = {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  servers: ConnectedServer[];
  tools: OrquestaTool[];
  cfg: OrquestaConfig;
  client: ReturnType<typeof createLlmClient>;
};

export async function createSession(cfg: OrquestaConfig): Promise<AgentSession> {
  const mcp = loadMcpFile(cfg.mcpPath);
  const { servers, tools } = await connectServers(mcp);
  const client = createLlmClient(cfg);
  const catalog = toolsCatalog(tools);
  const system = `${SYSTEM_PROMPT}\n\n## Tools MCP disponibles\n${catalog}`;
  return {
    messages: [{ role: "system", content: system }],
    servers,
    tools,
    cfg,
    client,
  };
}

export async function runTurn(session: AgentSession, userText: string): Promise<string> {
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

    let parsed: { name?: string; arguments?: Record<string, unknown> };
    try {
      parsed = JSON.parse(match[1].trim()) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    } catch {
      session.messages.push({
        role: "user",
        content: `Resultado tool: JSON inválido en tool_call. Corrige el formato.`,
      });
      continue;
    }

    const name = parsed.name || "";
    const args = parsed.arguments || {};
    process.stderr.write(`[orquesta] tool → ${name}\n`);
    const result = await callTool(session.servers, session.tools, name, args);
    session.messages.push({
      role: "user",
      content: `Resultado de la tool ${name}:\n${result}\n\nContinúa: otra tool_call o respuesta final.`,
    });
  }

  if (!final) {
    final = "(Se alcanzó el límite de rondas de tools sin respuesta final.)";
  }
  return final;
}

export async function endSession(session: AgentSession): Promise<void> {
  await closeServers(session.servers);
}
