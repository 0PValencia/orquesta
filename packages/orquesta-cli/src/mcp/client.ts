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
  failed: string[];
}> {
  const servers: ConnectedServer[] = [];
  const tools: OrquestaTool[] = [];
  const failed: string[] = [];

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
      // Silencioso: el estado se muestra en describeMcpStatus
    } catch (err) {
      failed.push(name);
      console.error(`[mcp] falló ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  return { servers, tools, failed };
}

async function connectOne(name: string, cfg: McpServerConfig): Promise<ConnectedServer> {
  let transport: Transport;
  if (cfg.type === "remote") {
    transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
    });
  } else {
    // stderr ignore: oculta "npm notice", banners del server MCP, etc.
    transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args ?? [],
      env: {
        ...process.env,
        npm_config_loglevel: "error",
        NPM_CONFIG_UPDATE_NOTIFIER: "false",
        ...cfg.env,
      } as Record<string, string>,
      cwd: cfg.cwd,
      stderr: "ignore",
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

export { selectTools, toolsCatalog } from "./catalog.js";

