import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { c } from "./theme.js";

export type TraceLine = { kind: "cycle" | "tool" | "info" | "warn"; text: string };

/**
 * Estado "Pensando" estilo DeepSeek: amarillo mientras corre,
 * luego colapsado; Enter expande/oculta el proceso.
 */
export class ThinkingUI {
  private lines: TraceLine[] = [];
  private started = false;
  private liveCount = 0;

  begin(): void {
    this.lines = [];
    this.started = true;
    this.liveCount = 0;
    output.write(`\n  ${c.yellow}${c.bold}● Pensando…${c.reset}${c.dim}  (el proceso se puede expandir al terminar)${c.reset}\n`);
  }

  log(kind: TraceLine["kind"], text: string): void {
    this.lines.push({ kind, text });
    if (!this.started) return;
    const icon =
      kind === "tool" ? "⚙" : kind === "cycle" ? "↻" : kind === "warn" ? "!" : "·";
    const color =
      kind === "tool" ? c.cyan : kind === "warn" ? c.yellow : c.dim;
    output.write(`  ${color}${icon} ${text}${c.reset}\n`);
    this.liveCount++;
  }

  /** Colapsa el bloque live y deja un toggle Enter. */
  async finish(interactive: boolean): Promise<void> {
    if (!this.started) return;
    this.started = false;

    // Subir y limpiar líneas live + cabecera (~ liveCount+1)
    const erase = this.liveCount + 1;
    if (erase > 0 && output.isTTY) {
      output.write(`\x1b[${erase}A`);
      for (let i = 0; i < erase; i++) output.write(`\x1b[2K\n`);
      output.write(`\x1b[${erase}A`);
    }

    const summary = summarize(this.lines);
    output.write(
      `  ${c.yellow}${c.bold}● Pensando${c.reset}${c.green} ✓${c.reset}` +
        `${c.dim}  ${summary}  ·  Enter = ver/ocultar proceso${c.reset}\n`
    );

    if (!interactive || !input.isTTY || !this.lines.length) return;

    let expanded = false;
    const render = () => {
      if (expanded) {
        output.write(`  ${c.dim}┌─ proceso ─────────────────────${c.reset}\n`);
        for (const l of this.lines) {
          const icon = l.kind === "tool" ? "⚙" : l.kind === "cycle" ? "↻" : "·";
          output.write(`  ${c.dim}│ ${icon} ${l.text}${c.reset}\n`);
        }
        output.write(`  ${c.dim}└─ Enter oculta · sigue en el chat ─${c.reset}\n`);
      }
    };

    // Una pulsación Enter opcional (timeout 1.2s para no bloquear el chat)
    const key = await waitEnterOrTimeout(1200);
    if (key === "enter") {
      expanded = true;
      render();
      await waitEnterOrTimeout(60_000);
      // no borramos el proceso expandido; el usuario ya lo vio
    }
  }

  getLines(): TraceLine[] {
    return [...this.lines];
  }
}

function summarize(lines: TraceLine[]): string {
  const cycles = lines.filter((l) => l.kind === "cycle").length;
  const tools = lines.filter((l) => l.kind === "tool").length;
  const parts = [];
  if (cycles) parts.push(`${cycles} ciclo${cycles === 1 ? "" : "s"}`);
  if (tools) parts.push(`${tools} tool${tools === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "listo";
}

function waitEnterOrTimeout(ms: number): Promise<"enter" | "timeout"> {
  return new Promise((resolve) => {
    if (!input.isTTY) {
      resolve("timeout");
      return;
    }
    const wasRaw = input.isRaw;
    const timer = setTimeout(() => {
      cleanup();
      resolve("timeout");
    }, ms);

    const onData = (buf: Buffer | string) => {
      const s = String(buf);
      if (s === "\r" || s === "\n") {
        cleanup();
        resolve("enter");
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      input.off("data", onData);
      if (input.isTTY) input.setRawMode(wasRaw ?? false);
    };

    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

/** Prompt de usuario estilo chat. */
export async function readChatLine(): Promise<string> {
  const rl = readline.createInterface({ input, output, terminal: true });
  try {
    const ans = await rl.question(`\n${c.cyan}tú${c.reset} ${c.dim}›${c.reset} `);
    return ans.trim();
  } finally {
    rl.close();
  }
}
