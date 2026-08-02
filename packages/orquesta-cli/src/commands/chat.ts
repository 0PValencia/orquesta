import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "../config.js";
import { createSession, describeMcpStatus, endSession, runTurn } from "../agent/loop.js";
import { parseChoices, presentChoices, stripChoices } from "../ui/choices.js";

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
  output.write("\n");
  process.exit(code);
}

async function readUserLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input, output, terminal: true });
  const onSig = () => {
    rl.close();
    cleanExit(0);
  };
  rl.on("SIGINT", onSig);
  try {
    return (await rl.question(prompt)).trim();
  } catch (err) {
    if (isAbort(err)) cleanExit(0);
    throw err;
  } finally {
    rl.close();
  }
}

async function handleAgentReply(
  session: Awaited<ReturnType<typeof createSession>>,
  out: string,
  interactive: boolean
): Promise<void> {
  let current = out;
  // Hasta 5 rondas de aclaración por menú
  for (let i = 0; i < 5; i++) {
    const choices = parseChoices(current);
    if (!choices) {
      const text = stripChoices(current);
      if (text) console.log("\norquesta>\n" + text + "\n");
      return;
    }

    if (choices.preamble) {
      console.log("\norquesta>\n" + choices.preamble + "\n");
    }

    if (!interactive) {
      // Modo -m: mostrar opciones en texto plano
      console.log(choices.question);
      choices.options.forEach((o, idx) => console.log(`  ${idx + 1}) ${o}`));
      console.log("  *) Opción propia");
      return;
    }

    let pick: string;
    try {
      pick = await presentChoices(choices);
    } catch (err) {
      if (isAbort(err)) cleanExit(0);
      throw err;
    }

    console.log(`→ ${pick}\n`);
    process.stderr.write("… generando\n");
    current = await runTurn(session, pick);
  }
  const text = stripChoices(current);
  if (text) console.log("\norquesta>\n" + text + "\n");
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
      process.stderr.write("… generando\n");
      const out = await runTurn(session, opts.message);
      await handleAgentReply(session, out, false);
      return;
    }

    console.log("¿Qué informe o sección necesitas?\n");
    while (true) {
      let line: string;
      try {
        line = await readUserLine("tú> ");
      } catch (err) {
        if (isAbort(err)) cleanExit(0);
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
            "  • Crea el informe en Google Docs / Documents  (usa el MCP de Docs)\n"
        );
        continue;
      }
      try {
        process.stderr.write("… generando\n");
        const out = await runTurn(session, line);
        await handleAgentReply(session, out, true);
      } catch (err) {
        if (isAbort(err)) cleanExit(0);
        const msg = err instanceof Error ? err.message : String(err);
        if (/503|ECONNREFUSED|fetch failed|timeout/i.test(msg)) {
          console.error(
            "El modelo está arrancando (1–2 min la primera vez). Vuelve a intentarlo."
          );
        } else if (/maximum context length|demasiado largo/i.test(msg)) {
          console.error(
            "El pedido (o las tools MCP) ocupan demasiado contexto. Prueba un mensaje más corto."
          );
          console.error(msg);
        } else {
          console.error("No pude completar eso:", msg);
        }
      }
    }
    output.write("\n");
  } finally {
    process.off("SIGINT", onSigInt);
    await endSession(session);
  }
}
