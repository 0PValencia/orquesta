import { stdout as output } from "node:process";
import { loadConfig } from "../config.js";
import {
  createSession,
  describeMcpStatus,
  endSession,
  runTurn,
  type AgentEvent,
} from "../agent/loop.js";
import { parseChoices, presentChoices, stripChoices } from "../ui/choices.js";
import { ThinkingUI, readChatLine } from "../ui/thinking.js";
import { assistantBubble, c, userBubble } from "../ui/theme.js";

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

function bindThinking(ui: ThinkingUI): (e: AgentEvent) => void {
  return (e) => {
    if (e.type === "cycle") {
      ui.log("cycle", `ciclo ${e.round}/${e.max} · ~${e.promptTokens} tokens`);
    } else if (e.type === "tool") {
      ui.log("tool", `MCP → ${e.name}`);
    } else if (e.type === "retry_format") {
      ui.log("warn", `reintento: ${e.reason}`);
    } else if (e.type === "info") {
      ui.log("info", e.text);
    }
  };
}

async function handleAgentReply(
  session: Awaited<ReturnType<typeof createSession>>,
  out: string,
  interactive: boolean
): Promise<void> {
  let current = out;
  for (let i = 0; i < 5; i++) {
    const choices = parseChoices(current);
    if (!choices) {
      const text = stripChoices(current);
      if (text) console.log("\n" + assistantBubble(text) + "\n");
      return;
    }

    if (choices.preamble) {
      console.log("\n" + assistantBubble(choices.preamble) + "\n");
    }

    if (!interactive) {
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

    console.log(userBubble(pick));
    const ui = new ThinkingUI();
    ui.begin();
    current = await runTurn(session, pick, { onEvent: bindThinking(ui) });
    await ui.finish(interactive);
  }
  const text = stripChoices(current);
  if (text) console.log("\n" + assistantBubble(text) + "\n");
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

  console.log(`
${c.green}╔══════════════════════════════════════╗
║           ORQUESTA                   ║
║   Agente de informes académicos      ║
╚══════════════════════════════════════╝${c.reset}
`);

  process.stderr.write(`${c.dim}Preparando agente…${c.reset}\n`);
  let session;
  try {
    session = await createSession(cfg);
  } catch (err) {
    if (isAbort(err)) cleanExit(0);
    throw err;
  }

  console.log(describeMcpStatus(session.mcpStatus));
  console.log(`
${c.dim}Comandos: orquesta ayuda · orquesta mcp add · orquesta update
Chat: escribe tu pedido · «proceso» no hace falta (Enter tras Pensando) · salir / Ctrl+C${c.reset}
`);

  try {
    if (opts.message) {
      console.log(userBubble(opts.message));
      const ui = new ThinkingUI();
      ui.begin();
      const out = await runTurn(session, opts.message, { onEvent: bindThinking(ui) });
      await ui.finish(false);
      await handleAgentReply(session, out, false);
      return;
    }

    console.log(`${c.dim}¿Qué informe o sección necesitas?${c.reset}`);
    while (true) {
      let line: string;
      try {
        line = await readChatLine();
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
            "  • Crea el informe en Google Docs / Documents (usa MCP)\n" +
            "  • Tras «Pensando ✓», Enter muestra el proceso (ciclos/tools)\n"
        );
        continue;
      }

      try {
        console.log(userBubble(line));
        const ui = new ThinkingUI();
        ui.begin();
        const out = await runTurn(session, line, { onEvent: bindThinking(ui) });
        await ui.finish(true);
        await handleAgentReply(session, out, true);
      } catch (err) {
        if (isAbort(err)) cleanExit(0);
        const msg = err instanceof Error ? err.message : String(err);
        if (/503|ECONNREFUSED|fetch failed|timeout/i.test(msg)) {
          console.error(
            `${c.yellow}El modelo está arrancando (1–2 min). Vuelve a intentarlo.${c.reset}`
          );
        } else if (/maximum context length|demasiado largo/i.test(msg)) {
          console.error(
            `${c.yellow}Contexto lleno. Prueba un pedido más corto o «salir» y vuelve a entrar.${c.reset}`
          );
          console.error(c.dim + msg + c.reset);
        } else {
          console.error(`${c.yellow}No pude completar eso:${c.reset}`, msg);
        }
      }
    }
    output.write("\n");
  } finally {
    process.off("SIGINT", onSigInt);
    await endSession(session);
  }
}
