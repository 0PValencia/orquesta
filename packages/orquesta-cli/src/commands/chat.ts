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
import { c, printAssistant, printHome, sanitizeUserInput } from "../ui/theme.js";

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
      ui.log("cycle", `ciclo ${e.round}/${e.max} · ~${e.promptTokens} tok`);
    } else if (e.type === "tool") {
      ui.log("tool", `MCP → ${e.name}`);
    } else if (e.type === "retry_format") {
      ui.log("warn", e.reason);
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
      if (text) printAssistant(text);
      return;
    }

    if (choices.preamble) printAssistant(choices.preamble);

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

    const ui = new ThinkingUI();
    ui.begin();
    current = await runTurn(session, pick, { onEvent: bindThinking(ui) });
    await ui.finish(interactive);
  }
  const text = stripChoices(current);
  if (text) printAssistant(text);
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

  let session;
  try {
    session = await createSession(cfg);
  } catch (err) {
    if (isAbort(err)) cleanExit(0);
    throw err;
  }

  printHome({
    mcpCount: session.mcpStatus.connected.length,
    model: cfg.model,
    version: "0.1.0",
  });
  console.log(`${c.muted}${describeMcpStatus(session.mcpStatus)}${c.reset}`);
  console.log("");

  try {
    if (opts.message) {
      const line = sanitizeUserInput(opts.message);
      const ui = new ThinkingUI();
      ui.begin();
      try {
        const out = await runTurn(session, line, { onEvent: bindThinking(ui) });
        await ui.finish(false);
        await handleAgentReply(session, out, false);
      } catch (err) {
        if (isAbort(err)) {
          ui.abort();
          cleanExit(0);
        }
        await ui.fail(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    while (true) {
      let line: string;
      try {
        line = sanitizeUserInput(await readChatLine());
      } catch (err) {
        if (isAbort(err)) cleanExit(0);
        throw err;
      }
      if (!line) continue;
      if (line === "exit" || line === "salir" || line === "quit") break;
      if (line === "ayuda" || line === "help") {
        console.log(
          `\n${c.orange}● Tip${c.reset} ${c.gray}Ejemplos:${c.reset}\n` +
            `${c.muted}  · crea un informe en Google Docs de 4 páginas sobre …\n` +
            `  · redacta la introducción (solo chat)\n` +
            `  · clic en Pensando / Thought → ver proceso del agente${c.reset}\n`
        );
        continue;
      }

      try {
        const ui = new ThinkingUI();
        ui.begin();
        try {
          const out = await runTurn(session, line, { onEvent: bindThinking(ui) });
          await ui.finish(true);
          await handleAgentReply(session, out, true);
        } catch (err) {
          if (isAbort(err)) {
            ui.abort();
            cleanExit(0);
          }
          const msg = err instanceof Error ? err.message : String(err);
          await ui.fail(msg);
          if (/503|ECONNREFUSED|fetch failed|timeout/i.test(msg)) {
            console.error(`${c.muted}Modelo arrancando (1–2 min). Reintentá.${c.reset}`);
          } else if (/demasiado largo|context length|400/i.test(msg)) {
            console.error(
              `${c.muted}Tip: «salir» y pedí menos páginas, o redactá sin Docs primero.${c.reset}`
            );
          }
        }
      } catch (err) {
        if (isAbort(err)) cleanExit(0);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n${c.orange}Error:${c.reset} ${msg}`);
      }
    }
    output.write("\n");
  } finally {
    process.off("SIGINT", onSigInt);
    await endSession(session);
  }
}
