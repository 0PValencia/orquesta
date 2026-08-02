import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type OrquestaConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  configDir: string;
  mcpPath: string;
  maxToolRounds: number;
};

/** Local stdio MCP (como opencode type=local) */
export type McpLocalServer = {
  type: "local";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

/** Remote HTTP/SSE MCP (como opencode type=remote) */
export type McpRemoteServer = {
  type: "remote";
  url: string;
  headers?: Record<string, string>;
};

export type McpServerConfig = McpLocalServer | McpRemoteServer;

export type McpFile = {
  mcpServers: Record<string, McpServerConfig>;
};

export function configDir(): string {
  return process.env.ORQUESTA_HOME?.trim() || path.join(os.homedir(), ".orquesta");
}

export function loadConfig(): OrquestaConfig {
  const dir = configDir();
  return {
    baseUrl: (process.env.ORQUESTA_BASE_URL || "").replace(/\/$/, ""),
    apiKey: process.env.ORQUESTA_API_KEY || "not-needed",
    model: process.env.ORQUESTA_MODEL || "informes",
    configDir: dir,
    mcpPath: path.join(dir, "mcp.json"),
    maxToolRounds: Number(process.env.ORQUESTA_MAX_TOOL_ROUNDS || 8),
  };
}

function normalizeServer(raw: Record<string, unknown>): McpServerConfig | null {
  const type = (raw.type as string) || (raw.url ? "remote" : "local");
  if (type === "remote") {
    if (!raw.url || typeof raw.url !== "string") return null;
    return {
      type: "remote",
      url: raw.url,
      headers: (raw.headers as Record<string, string>) || undefined,
    };
  }
  // legacy: { command, args } sin type
  if (!raw.command || typeof raw.command !== "string") return null;
  return {
    type: "local",
    command: raw.command,
    args: (raw.args as string[]) || undefined,
    env: (raw.env as Record<string, string>) || undefined,
    cwd: (raw.cwd as string) || undefined,
  };
}

export function loadMcpFile(mcpPath: string): McpFile {
  if (!fs.existsSync(mcpPath)) {
    return { mcpServers: {} };
  }
  const raw = JSON.parse(fs.readFileSync(mcpPath, "utf8")) as {
    mcpServers?: Record<string, Record<string, unknown>>;
  };
  const out: McpFile = { mcpServers: {} };
  for (const [name, cfg] of Object.entries(raw.mcpServers || {})) {
    const n = normalizeServer(cfg);
    if (n) out.mcpServers[name] = n;
  }
  return out;
}

export function saveMcpFile(mcpPath: string, data: McpFile): void {
  ensureConfigDir(path.dirname(mcpPath));
  fs.writeFileSync(mcpPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function ensureConfigDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function formatServerLine(name: string, s: McpServerConfig): string {
  if (s.type === "remote") {
    return `- ${name} [remote] ${s.url}`;
  }
  return `- ${name} [local] ${s.command} ${(s.args || []).join(" ")}`.trimEnd();
}
