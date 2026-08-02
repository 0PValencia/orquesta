import { Command } from "commander";
import { chatCommand } from "./commands/chat.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import {
  mcpAddCommand,
  mcpInitCommand,
  mcpListCommand,
  mcpPathCommand,
  mcpRemoveCommand,
  mcpShowCommand,
} from "./commands/mcp.js";

const program = new Command();

program
  .name("orquesta")
  .description(
    "Agente CLI Orquesta — informes vía Modal + MCP\n\n" +
      "  orquesta              Abre el chat del agente\n" +
      "  orquesta mcp add      Añade un MCP (local o remoto)\n" +
      "  orquesta doctor       Verifica configuración"
  )
  .version("0.1.0");

program
  .command("chat", { isDefault: true })
  .description("REPL del agente (LLM Modal + tools MCP) [default]")
  .option("-m, --message <text>", "Un solo mensaje (sin REPL)")
  .action(async (opts) => {
    await chatCommand(opts);
  });

program
  .command("config")
  .description("Muestra la configuración actual (Modal / rutas)")
  .action(() => {
    configCommand();
  });

program
  .command("doctor")
  .description("Comprueba ORQUESTA_BASE_URL, modelo y MCP")
  .action(() => {
    doctorCommand();
  });

const mcp = program.command("mcp").description("Gestión de servidores MCP (estilo OpenCode)");

mcp
  .command("add")
  .description("Añade un servidor MCP (interactivo: nombre, local/remoto, comando o URL)")
  .argument("[name]", "Nombre del servidor")
  .option("--url <url>", "MCP remoto (salta prompt de tipo)")
  .option("--command <cmd>", "Comando local completo entre comillas")
  .option("--env <KEY=VALUE>", "Variable de entorno (repetible)", collect, [])
  .option("--header <KEY=VALUE>", "Header HTTP remoto (repetible)", collect, [])
  .action(async (name: string | undefined, opts) => {
    await mcpAddCommand({
      name,
      url: opts.url,
      command: opts.command,
      env: opts.env,
      header: opts.header,
    });
  });

mcp
  .command("list")
  .description("Lista servidores en ~/.orquesta/mcp.json")
  .action(() => {
    mcpListCommand();
  });

mcp
  .command("show")
  .description("Muestra la config JSON de un servidor")
  .argument("<name>", "Nombre del servidor")
  .action((name: string) => {
    mcpShowCommand(name);
  });

mcp
  .command("remove")
  .alias("rm")
  .description("Elimina un servidor MCP")
  .argument("[name]", "Nombre (si omites, pregunta)")
  .action(async (name?: string) => {
    await mcpRemoveCommand(name);
  });

mcp
  .command("init")
  .description("Crea ~/.orquesta/mcp.json vacío")
  .action(() => {
    mcpInitCommand();
  });

mcp
  .command("path")
  .description("Imprime la ruta de mcp.json")
  .action(() => {
    mcpPathCommand();
  });

function collect(value: string, prev: string[]): string[] {
  prev.push(value);
  return prev;
}

await program.parseAsync(process.argv);
