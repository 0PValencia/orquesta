import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "../config.js";
import { createSession, describeMcpStatus, endSession, runTurn } from "../agent/loop.js";

function isAbort(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  return (
    e.name === "AbortError" ||
    e.code === "ABORT_ERR" ||
    /aborted|SIGINT/i.test(e.message || "")
  );
}

function cleanExit(code = 0): never {
  // Deja espacio limpio en la terminal (estilo OpenCode)
  output.write("\n");
  process.exit(code);
}

export async function chatCommand(opts: { message?: string }): Promise<void> {
  const cfg = loadConfig();

  const onSigInt = () => {
    try {
      output.write("\n");
    } catch {
      /* ignore */
    }
    cleanExit(0);
  };
  process.on("SIGINT", onSigInt);

  console.error(`
╔══════════════════════════════════════╗
║           ORQUESTA                   ║
║   Agente de informes académicos      ║
╚══════════════════════════════════════╝
`);

  process.stderr.write("Preparando agente…\n");
  let session;
  try {
    session = await createSession(cfg);
  } catch (err) {
    if (isAbort(err)) cleanExit(0);
    throw err;
  }

  console.error(describeMcpStatus(session.mcpStatus));
  console.error(`
Comandos útiles (fuera del chat):
  orquesta ayuda       — guía de uso
  orquesta mcp add     — conectar Google Docs u otra herramienta
  orquesta estado      — comprobar que todo esté listo

Dentro del chat: escribe tu pedido, «ayuda» o Ctrl+C / «salir» para salir.
`);

  try {
    if (opts.message) {
      const out = await runTurn(session, opts.message);
      console.log(out);
      return;
    }

    const rl = readline.createInterface({ input, output, terminal: true });
    rl.on("SIGINT", () => {
      rl.close();
      cleanExit(0);
    });

    console.log("¿Qué informe o sección necesitas?\n");
    while (true) {
      let line: string;
      try {
        line = (await rl.question("tú> ")).trim();
      } catch (err) {
        if (isAbort(err)) {
          rl.close();
          cleanExit(0);
        }
        throw err;
      }
      if (!line) continue;
      if (line === "exit" || line === "salir" || line === "quit") break;
      if (line === "ayuda" || line === "help") {
        console.log(
          "\nEjemplos:\n" +
            "  • Redacta la introducción de un SI para taller de motos\n" +
            "  • Genera el informe completo de un sistema escolar\n" +
            "  • Escribe conclusiones de un proyecto de condominio\n" +
            "  • Crea el documento en Google Docs  (necesita: orquesta mcp add)\n"
        );
        continue;
      }
      try {
        process.stderr.write("… generando (informes largos van por secciones)\n");
        const out = await runTurn(session, line);
        console.log("\norquesta>\n" + out + "\n");
      } catch (err) {
        if (isAbort(err)) {
          rl.close();
          cleanExit(0);
        }
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
    output.write("\n");
  } finally {
    process.off("SIGINT", onSigInt);
    await endSession(session);
  }
}
