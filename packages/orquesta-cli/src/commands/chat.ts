import { stdout as output } from "node:process";
import { loadConfig } from "../config.js";
import {
  createSession,
  describeMcpStatus,
  endSession,
  runTurn,
  type AgentEvent,
  type AgentSession,
} from "../agent/loop.js";
import { parseChoices, presentChoices, stripChoices } from "../ui/choices.js";
import { ThinkingUI } from "../ui/thinking.js";
import { OrquestaTui, clearScreen, showCursor } from "../ui/tui.js";
import { c, printAssistant, sanitizeUserInput } from "../ui/theme.js";

function isAbort(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  return (
    e.name === "AbortError" ||
    e.code === "ABORT_ERR" ||
    /aborted|SIGINT/i.test(e.message || "")
  );
}

function cleanExit(tui: OrquestaTui | null, code = 0): never {
  tui?.unmount();
  showCursor();
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
  session: AgentSession,
  out: string,
  tui: OrquestaTui | null,
  interactive: boolean
): Promise<void> {
  let current = out;
  for (let i = 0; i < 5; i++) {
    const choices = parseChoices(current);
    if (!choices) {
      const text = stripChoices(current);
      if (text) {
        if (tui) {
          tui.addAssistant(text);
          tui.render();
        } else {
          printAssistant(text);
        }
      }
      return;
    }

    if (choices.preamble) {
      if (tui) {
        tui.addAssistant(choices.preamble);
        tui.render();
      } else printAssistant(choices.preamble);
    }

    if (!interactive) {
      console.log(choices.question);
      choices.options.forEach((o, idx) => console.log(`  ${idx + 1}) ${o}`));
      return;
    }

    let pick: string;
    try {
      pick = await presentChoices(choices);
    } catch (err) {
      if (isAbort(err)) cleanExit(tui, 0);
      throw err;
    }

    const ui = new ThinkingUI(tui);
    ui.begin();
    try {
      current = await runTurn(session, pick, { onEvent: bindThinking(ui) });
      const thought = await ui.finish();
      if (tui) tui.addThought(thought.summary, thought.details);
    } catch (err) {
      if (isAbort(err)) {
        ui.abort();
        cleanExit(tui, 0);
      }
      await ui.fail(err instanceof Error ? err.message : String(err));
      return;
    }
  }
  const text = stripChoices(current);
  if (text) {
    if (tui) {
      tui.addAssistant(text);
      tui.render();
    } else printAssistant(text);
  }
}

export async function chatCommand(opts: { message?: string }): Promise<void> {
  const cfg = loadConfig();
  let tuiRef: OrquestaTui | null = null;

  const onSigInt = () => {
    try {
      tuiRef?.unmount();
      showCursor();
      output.write("\n");
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", onSigInt);

  let session: AgentSession;
  try {
    clearScreen();
    output.write(`${c.muted}Conectando herramientas…${c.reset}\n`);
    session = await createSession(cfg);
  } catch (err) {
    if (isAbort(err)) cleanExit(null, 0);
    throw err;
  }

  const mcpLabel = describeMcpStatus(session.mcpStatus);
  const tui = new OrquestaTui({
    model: cfg.model,
    version: "0.1.0",
    mcpCount: session.mcpStatus.connected.length,
    mcpLabel,
  });
  tuiRef = tui;

  try {
    // Modo one-shot (sin TUI interactivo completo)
    if (opts.message) {
      clearScreen();
      console.log(`${c.muted}${mcpLabel}${c.reset}\n`);
      const line = sanitizeUserInput(opts.message);
      const ui = new ThinkingUI(null);
      ui.begin();
      try {
        const out = await runTurn(session, line, { onEvent: bindThinking(ui) });
        await ui.finish();
        await handleAgentReply(session, out, null, false);
      } catch (err) {
        if (isAbort(err)) {
          ui.abort();
          cleanExit(null, 0);
        }
        await ui.fail(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    // Buffer alterno: una sola pantalla estable (como OpenCode / OpenTUI)
    tui.mount();

    // ── Home fullscreen (input REAL en la caja) ──
    while (tui.isHome) {
      let line: string;
      try {
        line = sanitizeUserInput(await tui.prompt());
      } catch (err) {
        if (isAbort(err) || /SIGINT/i.test(String(err))) cleanExit(tui, 0);
        throw err;
      }
      if (!line) continue;
      if (line === "exit" || line === "salir" || line === "quit") {
        break;
      }
      if (line === "ayuda" || line === "help" || line === "tab") {
        continue;
      }

      tui.enterSession();
      tui.addUser(line);
      tui.render();

      await runOneTurn(session, tui, line);
      break;
    }

    // ── Sesión: input abajo + chat + Thought con `t` ──
    if (!tui.isHome) {
      while (true) {
        let line: string;
        try {
          line = sanitizeUserInput(await tui.prompt());
        } catch (err) {
          if (isAbort(err) || /SIGINT/i.test(String(err))) cleanExit(tui, 0);
          throw err;
        }

        if (!line) continue;
        if (line === "exit" || line === "salir" || line === "quit") break;
        if (line === "t" || line === "T") {
          tui.toggleLastThought();
          continue;
        }
        if (line === "ayuda" || line === "help") continue;

        tui.addUser(line);
        tui.render();
        await runOneTurn(session, tui, line);
      }
    }
  } finally {
    process.off("SIGINT", onSigInt);
    tui.unmount();
    await endSession(session);
  }
}

async function runOneTurn(
  session: AgentSession,
  tui: OrquestaTui,
  line: string
): Promise<void> {
  if (/^(hola+|hey|buenas|hi|hello|gracias|ok|vale)[\s!?.¡¿]*$/i.test(line.trim())) {
    const out = await runTurn(session, line);
    tui.addAssistant(out);
    tui.render();
    return;
  }

  const ui = new ThinkingUI(tui);
  ui.begin();
  try {
    const out = await runTurn(session, line, { onEvent: bindThinking(ui) });
    const thought = await ui.finish();
    tui.addThought(thought.summary, thought.details);
    await handleAgentReply(session, out, tui, true);
    tui.render();
  } catch (err) {
    if (isAbort(err)) {
      ui.abort();
      cleanExit(tui, 0);
    }
    const msg = err instanceof Error ? err.message : String(err);
    await ui.fail(msg);
    tui.addAssistant(`Error: ${msg}`);
    tui.render();
  }
}
