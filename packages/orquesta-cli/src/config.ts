import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Valores de fábrica — el usuario no necesita exportar variables técnicas. */
export const DEFAULTS = {
  baseUrl: "https://pvalencia--orquesta-informes-serve.modal.run/v1",
  model: "informes",
  apiKey: "not-needed",
  maxToolRounds: 24,
  /**
   * Tokens de salida por ciclo LLM.
   * Contexto Modal ≈ 8192 (prompt + completion).
   */
  maxTokens: 2048,
} as const;

export type StoredConfig = {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  maxToolRounds?: number;
  maxTokens?: number;
};

export type OrquestaConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  configDir: string;
  configPath: string;
  mcpPath: string;
  maxToolRounds: number;
  maxTokens: number;
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

export function configPath(): string {
  return path.join(configDir(), "config.json");
}

export function ensureConfigDir(dir: string = configDir()): void {
  fs.mkdirSync(dir, { recursive: true });
}

/** Crea ~/.orquesta/config.json con defaults si no existe. */
export function ensureUserConfig(): string {
  ensureConfigDir();
  const p = configPath();
  if (!fs.existsSync(p)) {
    const initial: StoredConfig = {
      baseUrl: DEFAULTS.baseUrl,
      model: DEFAULTS.model,
      apiKey: DEFAULTS.apiKey,
      maxToolRounds: DEFAULTS.maxToolRounds,
      maxTokens: DEFAULTS.maxTokens,
    };
    fs.writeFileSync(p, JSON.stringify(initial, null, 2) + "\n", "utf8");
  }
  if (!fs.existsSync(path.join(configDir(), "mcp.json"))) {
    fs.writeFileSync(
      path.join(configDir(), "mcp.json"),
      JSON.stringify({ mcpServers: {} }, null, 2) + "\n",
      "utf8"
    );
  }
  return p;
}

function readStored(): StoredConfig {
  const p = configPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as StoredConfig;
  } catch {
    return {};
  }
}

export function saveStoredConfig(partial: StoredConfig): void {
  ensureConfigDir();
  const current = readStored();
  const next = { ...current, ...partial };
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2) + "\n", "utf8");
}

/**
 * Prioridad: variable de entorno (avanzado) → config.json → defaults.
 * El usuario normal solo usa defaults / config.json (sin exports).
 */
export function loadConfig(): OrquestaConfig {
  ensureUserConfig();
  const dir = configDir();
  const stored = readStored();
  const baseUrl = (
    process.env.ORQUESTA_BASE_URL ||
    stored.baseUrl ||
    DEFAULTS.baseUrl
  ).replace(/\/$/, "");

  // Contexto Modal ≈ 8192; dejar margen para system + historial + tools.
  let maxTokens = Number(
    process.env.ORQUESTA_MAX_TOKENS || stored.maxTokens || DEFAULTS.maxTokens
  );
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = DEFAULTS.maxTokens;
  if (maxTokens > 4096) {
    maxTokens = DEFAULTS.maxTokens;
    if (stored.maxTokens && stored.maxTokens > 4096) {
      saveStoredConfig({ maxTokens });
    }
  }

  return {
    baseUrl,
    apiKey: process.env.ORQUESTA_API_KEY || stored.apiKey || DEFAULTS.apiKey,
    model: process.env.ORQUESTA_MODEL || stored.model || DEFAULTS.model,
    configDir: dir,
    configPath: configPath(),
    mcpPath: path.join(dir, "mcp.json"),
    maxToolRounds: Number(
      process.env.ORQUESTA_MAX_TOOL_ROUNDS ||
        stored.maxToolRounds ||
        DEFAULTS.maxToolRounds
    ),
    maxTokens,
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

export function formatServerLine(name: string, s: McpServerConfig): string {
  if (s.type === "remote") {
    return `- ${name} [remoto] ${s.url}`;
  }
  return `- ${name} [local] ${s.command} ${(s.args || []).join(" ")}`.trimEnd();
}

/** Texto de ayuda amigable (sin jerga de env vars). */
export const HELP_TEXT = `
Orquesta — agente de informes académicos (SI I)

Comandos principales:
  orquesta              Hablar con el agente (empezar aquí)
  orquesta ayuda        Ver esta guía
  orquesta estado       Ver si el modelo y los MCP están listos
  orquesta update       Actualizar desde GitHub (tras un push)
  orquesta mcp add      Conectar una herramienta (Google Docs, etc.)
  orquesta mcp list     Ver herramientas conectadas
  orquesta mcp remove   Quitar una herramienta

Ejemplos:
  orquesta
  > Redacta la justificación de un SI para biblioteca municipal

  orquesta update
  orquesta update --reinstall

  orquesta mcp add
  > (te pregunta nombre, si es local o remoto, y el comando)

Notas:
  • El modelo ya viene configurado; no hace falta exportar URLs.
  • Sin MCP puedes redactar informes en el chat.
  • Con MCP (Docs) el agente puede crear/editar documentos.
  • Tras subir cambios a GitHub: orquesta update
`.trim();
