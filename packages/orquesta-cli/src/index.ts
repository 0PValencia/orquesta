import { Command } from "commander";
import { chatCommand } from "./commands/chat.js";
import { configCommand, helpCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import {
  mcpAddCommand,
  mcpInitCommand,
  mcpListCommand,
  mcpPathCommand,
  mcpRemoveCommand,
  mcpShowCommand,
} from "./commands/mcp.js";
import { ensureUserConfig } from "./config.js";

ensureUserConfig();

// Atajos naturales: `orquesta add mcp` → `orquesta mcp add`
{
  const a = process.argv[2];
  const b = process.argv[3];
  if (a === "add" && b === "mcp") {
    process.argv.splice(2, 2, "mcp", "add");
  } else if (a === "add-mcp") {
    process.argv.splice(2, 1, "mcp", "add");
  }
}

const program = new Command();

program
  .name("orquesta")
  .description("Agente de informes académicos. Escribe «orquesta ayuda» para ver los comandos.")
  .version("0.1.0");

program
  .command("chat", { isDefault: true })
  .description("Hablar con el agente (comando principal)")
  .option("-m, --message <text>", "Un solo mensaje y salir")
  .action(async (opts) => {
    await chatCommand(opts);
  });

program
  .command("ayuda")
  .alias("help-es")
  .description("Guía de comandos en español")
  .action(() => {
    helpCommand();
  });

program
  .command("estado")
  .alias("doctor")
  .description("Comprobar si el modelo y las herramientas están listos")
  .action(() => {
    doctorCommand();
  });

program
  .command("config")
  .description("Ver configuración guardada")
  .action(() => {
    configCommand();
  });

const mcp = program.command("mcp").description("Conectar herramientas (Google Docs, etc.)");

mcp
  .command("add")
  .description("Añadir una herramienta (nombre → local o remoto → comando/URL)")
  .argument("[name]", "Nombre")
  .option("--url <url>", "Servidor remoto")
  .option("--command <cmd>", "Comando local")
  .option("--env <KEY=VALUE>", "Variable de entorno", collect, [])
  .option("--header <KEY=VALUE>", "Header HTTP", collect, [])
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
  .description("Listar herramientas conectadas")
  .action(() => {
    mcpListCommand();
  });

mcp
  .command("show")
  .description("Ver detalle de una herramienta")
  .argument("<name>", "Nombre")
  .action((name: string) => {
    mcpShowCommand(name);
  });

mcp
  .command("remove")
  .alias("rm")
  .description("Quitar una herramienta")
  .argument("[name]", "Nombre")
  .action(async (name?: string) => {
    await mcpRemoveCommand(name);
  });

mcp
  .command("init")
  .description("Crear archivo de herramientas vacío")
  .action(() => {
    mcpInitCommand();
  });

mcp
  .command("path")
  .description("Ruta del archivo de herramientas")
  .action(() => {
    mcpPathCommand();
  });

function collect(value: string, prev: string[]): string[] {
  prev.push(value);
  return prev;
}

await program.parseAsync(process.argv);
