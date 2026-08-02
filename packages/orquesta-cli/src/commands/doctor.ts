import { loadConfig, loadMcpFile } from "../config.js";

export function doctorCommand(): void {
  const cfg = loadConfig();
  const mcp = loadMcpFile(cfg.mcpPath);
  const checks: { ok: boolean; msg: string }[] = [];

  checks.push({
    ok: Boolean(cfg.baseUrl),
    msg: cfg.baseUrl
      ? `ORQUESTA_BASE_URL = ${cfg.baseUrl}`
      : "Falta ORQUESTA_BASE_URL (debe terminar en /v1, no la URL del dashboard)",
  });
  checks.push({
    ok: cfg.baseUrl.includes("/v1") || !cfg.baseUrl,
    msg: cfg.baseUrl.includes("/v1")
      ? "BASE_URL incluye /v1"
      : cfg.baseUrl
        ? "BASE_URL no termina en /v1 — añade /v1"
        : "BASE_URL vacío",
  });
  checks.push({
    ok: !cfg.baseUrl.includes("modal.com/apps"),
    msg: cfg.baseUrl.includes("modal.com/apps")
      ? "Estás usando la URL del dashboard; usa ...modal.run/v1"
      : "BASE_URL no es dashboard (ok)",
  });
  checks.push({
    ok: true,
    msg: `Modelo: ${cfg.model}`,
  });
  checks.push({
    ok: true,
    msg: `MCP file: ${cfg.mcpPath} (${Object.keys(mcp.mcpServers).length} servidores)`,
  });

  console.log("Orquesta doctor\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.msg}`);
  }
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
}
