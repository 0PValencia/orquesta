import fs from "node:fs";
import {
  ensureConfigDir,
  formatServerLine,
  loadConfig,
  loadMcpFile,
  saveMcpFile,
  type McpLocalServer,
  type McpRemoteServer,
  type McpServerConfig,
} from "../config.js";
import { ask, choose, confirm } from "../ui/prompt.js";

export function mcpListCommand(): void {
  const cfg = loadConfig();
  const mcp = loadMcpFile(cfg.mcpPath);
  const names = Object.keys(mcp.mcpServers);
  if (!names.length) {
    console.log(`Sin servidores en ${cfg.mcpPath}`);
    console.log(`Añade uno con: orquesta mcp add`);
    return;
  }
  console.log(`MCP config: ${cfg.mcpPath}\n`);
  for (const name of names) {
    console.log(formatServerLine(name, mcp.mcpServers[name]));
  }
}

export function mcpShowCommand(name: string): void {
  const cfg = loadConfig();
  const mcp = loadMcpFile(cfg.mcpPath);
  const s = mcp.mcpServers[name];
  if (!s) {
    console.error(`No existe el servidor "${name}".`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ [name]: s }, null, 2));
}

export async function mcpRemoveCommand(nameArg?: string): Promise<void> {
  const cfg = loadConfig();
  const mcp = loadMcpFile(cfg.mcpPath);
  const names = Object.keys(mcp.mcpServers);
  if (!names.length) {
    console.log("No hay servidores para eliminar.");
    return;
  }
  let name = nameArg?.trim();
  if (!name) {
    name = await choose(
      "¿Qué servidor MCP eliminar?",
      names.map((n) => ({ label: n, value: n, hint: formatServerLine(n, mcp.mcpServers[n]) }))
    );
  }
  if (!mcp.mcpServers[name]) {
    console.error(`No existe "${name}".`);
    process.exitCode = 1;
    return;
  }
  if (!(await confirm(`Eliminar "${name}"`, false))) {
    console.log("Cancelado.");
    return;
  }
  delete mcp.mcpServers[name];
  saveMcpFile(cfg.mcpPath, mcp);
  console.log(`Eliminado "${name}" de ${cfg.mcpPath}`);
}

export async function mcpAddCommand(opts: {
  name?: string;
  url?: string;
  command?: string;
  env?: string[];
  header?: string[];
}): Promise<void> {
  console.log("\n══ Orquesta · Add MCP server ══\n");

  const cfg = loadConfig();
  ensureConfigDir(cfg.configDir);
  const mcp = loadMcpFile(cfg.mcpPath);

  let name =
    opts.name?.trim() ||
    (await ask("Nombre del servidor", { default: "" }));
  name = name.trim().replace(/\s+/g, "-");
  if (!name) {
    console.error("El nombre es obligatorio.");
    process.exitCode = 1;
    return;
  }
  if (mcp.mcpServers[name]) {
    const overwrite = await confirm(`Ya existe "${name}". ¿Sobrescribir?`, false);
    if (!overwrite) {
      console.log("Cancelado.");
      return;
    }
  }

  let type: "local" | "remote";
  if (opts.url) type = "remote";
  else if (opts.command) type = "local";
  else {
    type = (await choose("Tipo de servidor MCP", [
      { label: "Local", value: "local", hint: "comando stdio (npx, node, python…)" },
      { label: "Remoto", value: "remote", hint: "URL HTTP/SSE" },
    ])) as "local" | "remote";
  }

  let server: McpServerConfig;

  if (type === "local") {
    const cmdLine =
      opts.command?.trim() ||
      (await ask("Comando completo", {
        default: "npx -y @modelcontextprotocol/server-filesystem /tmp",
      }));
    if (!cmdLine.trim()) {
      console.error("Comando obligatorio.");
      process.exitCode = 1;
      return;
    }
    const parts = splitCommand(cmdLine);
    // Env solo vía --env (no se pregunta en el asistente interactivo)
    const env = parseKvList(opts.env);
    const local: McpLocalServer = {
      type: "local",
      command: parts[0],
      args: parts.slice(1),
      ...(Object.keys(env).length ? { env } : {}),
    };
    server = local;
  } else {
    const url =
      opts.url?.trim() ||
      (await ask("URL del servidor MCP", {
        default: "https://example.com/mcp",
      }));
    if (!url || !URL.canParse(url)) {
      console.error("URL inválida.");
      process.exitCode = 1;
      return;
    }
    // Headers solo vía --header
    const headers = parseKvList(opts.header);
    const remote: McpRemoteServer = {
      type: "remote",
      url,
      ...(Object.keys(headers).length ? { headers } : {}),
    };
    server = remote;
  }

  mcp.mcpServers[name] = server;
  saveMcpFile(cfg.mcpPath, mcp);
  console.log(`\n✓ MCP "${name}" añadido en ${cfg.mcpPath}`);
  console.log(formatServerLine(name, server));
  console.log(`\nPrueba: orquesta mcp list`);
  console.log(`Chat:   orquesta\n`);
}

export function mcpInitCommand(): void {
  const cfg = loadConfig();
  ensureConfigDir(cfg.configDir);
  if (fs.existsSync(cfg.mcpPath)) {
    console.log(`Ya existe ${cfg.mcpPath}`);
    console.log(`Usa: orquesta mcp add`);
    return;
  }
  saveMcpFile(cfg.mcpPath, { mcpServers: {} });
  console.log(`Creado ${cfg.mcpPath} vacío.`);
  console.log(`Añade servidores con: orquesta mcp add`);
}

export function mcpPathCommand(): void {
  const cfg = loadConfig();
  console.log(cfg.mcpPath);
}

function splitCommand(line: string): string[] {
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

function parseKvList(items?: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items || []) {
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    out[item.slice(0, eq)] = item.slice(eq + 1);
  }
  return out;
}
