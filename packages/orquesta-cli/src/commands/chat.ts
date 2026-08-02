import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "../config.js";
import { createSession, describeMcpStatus, endSession, runTurn } from "../agent/loop.js";

export async function chatCommand(opts: { message?: string }): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.baseUrl) {
    console.error(
      "Configura ORQUESTA_BASE_URL (URL Modal .../v1).\nEjemplo:\n  export ORQUESTA_BASE_URL='https://pvalencia--orquesta-informes-serve.modal.run/v1'"
    );
    process.exitCode = 1;
    return;
  }

  console.error(`
╔══════════════════════════════════════╗
║           ORQUESTA  v0.1             ║
║   Agente · Informes · Modal · MCP    ║
╚══════════════════════════════════════╝
`);
  console.error(`LLM → ${cfg.baseUrl} | model=${cfg.model}`);
  console.error(`MCP file → ${cfg.mcpPath}`);

  const session = await createSession(cfg);
  console.error(describeMcpStatus(session.mcpStatus));
  console.error(`Comandos: orquesta mcp add | doctor | config | --help\n`);

  try {
    if (opts.message) {
      const out = await runTurn(session, opts.message);
      console.log(out);
      return;
    }

    const rl = readline.createInterface({ input, output });
    console.log('Orquesta listo. Escribe tu pedido (o "exit"/"salir").\n');
    while (true) {
      const line = (await rl.question("tú> ")).trim();
      if (!line) continue;
      if (line === "exit" || line === "salir" || line === "quit") break;
      try {
        const out = await runTurn(session, line);
        console.log("\norquesta>\n" + out + "\n");
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
      }
    }
    rl.close();
  } finally {
    await endSession(session);
  }
}
