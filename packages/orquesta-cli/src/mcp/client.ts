import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpFile, McpServerConfig } from "../config.js";

export type OrquestaTool = {
  server: string;
  name: string;
  fullName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type ConnectedServer = {
  name: string;
  client: Client;
  transport: Transport;
};

export async function connectServers(mcp: McpFile): Promise<{
  servers: ConnectedServer[];
  tools: OrquestaTool[];
}> {
  const servers: ConnectedServer[] = [];
  const tools: OrquestaTool[] = [];

  for (const [name, cfg] of Object.entries(mcp.mcpServers)) {
    try {
      const connected = await connectOne(name, cfg);
      servers.push(connected);
      const listed = await connected.client.listTools();
      for (const t of listed.tools) {
        tools.push({
          server: name,
          name: t.name,
          fullName: `${name}__${t.name}`,
          description: t.description,
          inputSchema: t.inputSchema as Record<string, unknown> | undefined,
        });
      }
      console.error(`[mcp] conectado: ${name} (${listed.tools.length} tools)`);
    } catch (err) {
      console.error(`[mcp] falló ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  return { servers, tools };
}

async function connectOne(name: string, cfg: McpServerConfig): Promise<ConnectedServer> {
  let transport: Transport;
  if (cfg.type === "remote") {
    transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
    });
  } else {
    transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args ?? [],
      env: { ...process.env, ...cfg.env } as Record<string, string>,
      cwd: cfg.cwd,
    });
  }
  const client = new Client({ name: `orquesta-${name}`, version: "0.1.0" });
  await client.connect(transport);
  return { name, client, transport };
}

export async function callTool(
  servers: ConnectedServer[],
  tools: OrquestaTool[],
  fullNameOrName: string,
  args: Record<string, unknown>
): Promise<string> {
  const tool =
    tools.find((t) => t.fullName === fullNameOrName) ||
    tools.find((t) => t.name === fullNameOrName);
  if (!tool) {
    return JSON.stringify({ error: `Tool no encontrada: ${fullNameOrName}` });
  }
  const server = servers.find((s) => s.name === tool.server);
  if (!server) {
    return JSON.stringify({ error: `Servidor MCP no conectado: ${tool.server}` });
  }
  const result = await server.client.callTool({
    name: tool.name,
    arguments: args,
  });
  return JSON.stringify(result, null, 2);
}

export async function closeServers(servers: ConnectedServer[]): Promise<void> {
  for (const s of servers) {
    try {
      await s.client.close();
    } catch {
      /* ignore */
    }
  }
}

export function toolsCatalog(tools: OrquestaTool[]): string {
  if (!tools.length) return "(No hay servidores MCP configurados o conectados.)";
  return tools
    .map((t) => {
      const schema = t.inputSchema ? JSON.stringify(t.inputSchema) : "{}";
      return `- ${t.fullName}: ${t.description || ""}\n  schema: ${schema}`;
    })
    .join("\n");
}
