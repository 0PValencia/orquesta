import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { c } from "./theme.js";

export type TraceLine = { kind: "cycle" | "tool" | "info" | "warn"; text: string };

/**
 * Pensando / Thought estilo OpenCode–DeepSeek:
 * - Animación mientras corre
 * - Clic (mouse) en la línea expande/oculta el hilo — NO Enter
 * - Tras terminar: "▸ Thought · 3.2s" clicable
 */
export class ThinkingUI {
  private lines: TraceLine[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private dots = 0;
  private expanded = false;
  private done = false;
  private startedAt = 0;
  private elapsedMs = 0;
  private mouseOn = false;
  private onData: ((buf: Buffer | string) => void) | null = null;
  private wasRaw: boolean | undefined;
  private expandedLines = 0;
  private alive = false;

  begin(): void {
    this.lines = [];
    this.dots = 0;
    this.expanded = false;
    this.done = false;
    this.alive = true;
    this.startedAt = Date.now();
    this.elapsedMs = 0;
    this.expandedLines = 0;
    output.write("\n");
    this.enableMouse();
    this.paintHeader();
    this.timer = setInterval(() => {
      if (this.done || this.expanded) return;
      this.dots = (this.dots + 1) % 4;
      this.paintHeader();
    }, 400);
  }

  log(kind: TraceLine["kind"], text: string): void {
    this.lines.push({ kind, text });
    if (this.expanded) {
      this.writeTraceLine(this.lines[this.lines.length - 1]);
      this.expandedLines++;
    }
  }

  private enableMouse(): void {
    if (!input.isTTY || !output.isTTY) return;
    if (this.mouseOn) return;
    this.wasRaw = input.isRaw;
    try {
      input.setRawMode(true);
    } catch {
      return;
    }
    input.resume();
    // X10 + SGR mouse (clic)
    output.write("\x1b[?1000h\x1b[?1006h");
    this.mouseOn = true;
    this.onData = (buf) => this.handleInput(buf);
    input.on("data", this.onData);
  }

  private disableMouse(): void {
    if (!this.mouseOn) return;
    output.write("\x1b[?1006l\x1b[?1000l");
    if (this.onData) input.off("data", this.onData);
    this.onData = null;
    try {
      if (input.isTTY) input.setRawMode(this.wasRaw ?? false);
    } catch {
      /* ignore */
    }
    this.mouseOn = false;
  }

  private handleInput(buf: Buffer | string): void {
    const s = String(buf);
    if (s === "\u0003") {
      this.abort();
      return;
    }
    // SGR mouse: ESC [ < btn ; col ; row M/m
    const m = s.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (m) {
      const btn = Number(m[1]);
      const press = m[4] === "M";
      if (press && btn === 0) {
        this.toggle();
      }
      return;
    }
    // Fallback sin mouse fiable: tecla 't' / espacio también toggle (no Enter)
    if (!this.done && (s === "t" || s === "T" || s === " ")) {
      this.toggle();
    }
    if (this.done && (s === "t" || s === "T" || s === " ")) {
      this.toggle();
    }
  }

  private paintHeader(): void {
    if (!output.isTTY) return;
    const ms = this.done ? this.elapsedMs : Date.now() - this.startedAt;
    const secs = (ms / 1000).toFixed(1);
    let label: string;
    if (!this.done) {
      label = `${c.yellow}${c.bold}Pensando${".".repeat(this.dots)}${" ".repeat(3 - this.dots)}${c.reset}`;
    } else {
      const arrow = this.expanded ? "▾" : "▸";
      label = `${c.orange}${c.bold}${arrow} Thought · ${secs}s${c.reset}`;
    }
    const hint = this.expanded
      ? `${c.muted}  clic para ocultar${c.reset}`
      : `${c.muted}  clic para ver proceso${c.reset}`;
    // Reescribir línea del header
    if (!this.expanded) {
      output.write(`\r\x1b[2K  ${label}${hint}`);
    }
  }

  private writeTraceLine(l: TraceLine): void {
    const icon = l.kind === "tool" ? "⚙" : l.kind === "cycle" ? "↻" : l.kind === "warn" ? "!" : "·";
    output.write(`\n  ${c.muted}${icon} ${l.text}${c.reset}`);
  }

  private paintExpanded(): void {
    output.write("\n");
    output.write(`  ${c.muted}┌ proceso${"─".repeat(36)}${c.reset}`);
    this.expandedLines = 1;
    for (const l of this.lines) {
      this.writeTraceLine(l);
      this.expandedLines++;
    }
    if (!this.lines.length) {
      output.write(`\n  ${c.muted}· (sin pasos aún)${c.reset}`);
      this.expandedLines++;
    }
    output.write(`\n  ${c.muted}└ clic oculta${"─".repeat(28)}${c.reset}\n`);
    this.expandedLines += 2;
  }

  private collapseExpanded(): void {
    if (this.expandedLines > 0 && output.isTTY) {
      // subir y borrar el bloque expandido
      output.write(`\x1b[${this.expandedLines}A`);
      for (let i = 0; i < this.expandedLines; i++) {
        output.write(`\x1b[2K`);
        if (i < this.expandedLines - 1) output.write("\x1b[1B");
      }
      // volver al inicio del bloque
      output.write(`\x1b[${this.expandedLines - 1}A`);
    }
    this.expandedLines = 0;
    this.paintHeader();
    output.write("\n");
  }

  toggle(): void {
    if (!this.alive) return;
    if (this.expanded) {
      this.expanded = false;
      this.collapseExpanded();
      return;
    }
    this.expanded = true;
    // dejar la línea header y volcar proceso
    if (!this.done) {
      output.write(`\r\x1b[2K  ${c.yellow}${c.bold}Pensando…${c.reset}${c.muted}  (proceso)${c.reset}`);
    } else {
      this.paintHeader();
    }
    this.paintExpanded();
  }

  abort(): void {
    this.stopTimer();
    this.disableMouse();
    this.alive = false;
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Error: detener animación y mostrar fallo limpio. */
  async fail(message: string): Promise<void> {
    this.stopTimer();
    this.done = true;
    this.elapsedMs = Date.now() - this.startedAt;
    this.alive = false;
    this.disableMouse();
    if (output.isTTY) {
      output.write(`\r\x1b[2K  ${c.orange}✗${c.reset} ${c.yellow}Pensando cancelado${c.reset}${c.muted} · ${(this.elapsedMs / 1000).toFixed(1)}s${c.reset}\n`);
    }
    output.write(`\n${c.orange}Error:${c.reset} ${message}\n`);
  }

  /**
   * Termina animación → "▸ Thought · Xs".
   * Durante ~2s el clic sigue expandiendo el hilo; luego se suelta el mouse para el prompt.
   */
  async finish(interactive: boolean): Promise<void> {
    this.stopTimer();
    this.done = true;
    this.elapsedMs = Date.now() - this.startedAt;
    if (!this.expanded) {
      this.paintHeader();
      output.write("\n");
    }

    if (!interactive || !input.isTTY) {
      this.disableMouse();
      this.alive = false;
      return;
    }

    // Ventana para clic en Thought (handleInput → toggle). No uses Enter.
    await new Promise<void>((r) => setTimeout(r, 2200));
    this.disableMouse();
    this.alive = false;
  }

  getLines(): TraceLine[] {
    return [...this.lines];
  }
}

/** Prompt tipo OpenCode (barra azul). */
export async function readChatLine(): Promise<string> {
  const rl = readline.createInterface({ input, output, terminal: true });
  try {
    const ans = await rl.question(`${c.blue}┃${c.reset} `);
    return ans;
  } finally {
    rl.close();
  }
}
