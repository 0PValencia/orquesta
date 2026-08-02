import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "../config.js";
import { createSession, describeMcpStatus, endSession, runTurn } from "../agent/loop.js";

export async function chatCommand(opts: { message?: string }): Promise<void> {
  const cfg = loadConfig();

  console.error(`
╔══════════════════════════════════════╗
║           ORQUESTA                   ║
║   Agente de informes académicos      ║
╚══════════════════════════════════════╝
`);

  process.stderr.write("Preparando agente…\n");
  const session = await createSession(cfg);
  console.error(describeMcpStatus(session.mcpStatus));
  console.error(`
Comandos útiles (fuera del chat):
  orquesta ayuda       — guía de uso
  orquesta mcp add     — conectar Google Docs u otra herramienta
  orquesta estado      — comprobar que todo esté listo

Dentro del chat: escribe tu pedido, o «ayuda» / «salir».
`);

  try {
    if (opts.message) {
      const out = await runTurn(session, opts.message);
      console.log(out);
      return;
    }

    const rl = readline.createInterface({ input, output });
    console.log("¿Qué informe o sección necesitas?\n");
    while (true) {
      const line = (await rl.question("tú> ")).trim();
      if (!line) continue;
      if (line === "exit" || line === "salir" || line === "quit") break;
      if (line === "ayuda" || line === "help") {
        console.log(
          "\nEjemplos:\n" +
            "  • Redacta la introducción de un SI para taller de motos\n" +
            "  • Genera objetivos para un sistema escolar\n" +
            "  • Escribe conclusiones de un proyecto de condominio\n" +
            "  • Crea el documento en Google Docs  (necesita: orquesta mcp add)\n"
        );
        continue;
      }
      try {
        process.stderr.write("…\n");
        const out = await runTurn(session, line);
        console.log("\norquesta>\n" + out + "\n");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/503|ECONNREFUSED|fetch failed|timeout/i.test(msg)) {
          console.error(
            "El modelo está arrancando (1–2 min la primera vez). Vuelve a intentarlo."
          );
        } else {
          console.error("No pude completar eso:", msg);
        }
      }
    }
    rl.close();
  } finally {
    await endSession(session);
  }
}
