import { loadConfig, loadMcpFile } from "../config.js";

/** Diagnóstico en lenguaje simple (alias: orquesta estado). */
export function doctorCommand(): void {
  const cfg = loadConfig();
  const mcp = loadMcpFile(cfg.mcpPath);
  const n = Object.keys(mcp.mcpServers).length;

  console.log("Estado de Orquesta\n");

  const okModel = Boolean(cfg.baseUrl && cfg.model);
  console.log(`${okModel ? "✓" : "✗"} Modelo listo (${cfg.model})`);

  if (n === 0) {
    console.log("○ Herramientas MCP: ninguna todavía");
    console.log("  → Conecta una con: orquesta mcp add");
  } else {
    console.log(`✓ Herramientas MCP configuradas: ${n}`);
    console.log("  → Ver lista: orquesta mcp list");
  }

  console.log("\nPara empezar: orquesta");
  console.log("Guía de comandos: orquesta ayuda");
}
