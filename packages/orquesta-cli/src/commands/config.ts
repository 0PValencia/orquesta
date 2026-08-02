import { HELP_TEXT, loadConfig } from "../config.js";

export function configCommand(): void {
  const cfg = loadConfig();
  console.log("Configuración de Orquesta\n");
  console.log(`  Modelo:     ${cfg.model}`);
  console.log(`  Servidor:   ${cfg.baseUrl}`);
  console.log(`  Carpeta:    ${cfg.configDir}`);
  console.log(`  Herramientas (MCP): ${cfg.mcpPath}`);
  console.log(`\nArchivo: ${cfg.configPath}`);
  console.log("\nTip: usa «orquesta ayuda» para ver los comandos.");
}

export function helpCommand(): void {
  console.log(HELP_TEXT);
}
