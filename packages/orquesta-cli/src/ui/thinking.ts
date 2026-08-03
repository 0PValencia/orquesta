import { stdout as output } from "node:process";
import { c } from "./theme.js";

export type TraceLine = { kind: "cycle" | "tool" | "info" | "warn"; text: string };

/**
 * Pensando: UNA sola línea (sin spam). El detalle va a Thought en el TUI (`t`).
 */
export class ThinkingUI {
  private lines: TraceLine[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private dots = 0;
  private done = false;
  private startedAt = 0;
  private elapsedMs = 0;
  private active = false;

  begin(): void {
    this.lines = [];
    this.dots = 0;
    this.done = false;
    this.active = true;
    this.startedAt = Date.now();
    this.elapsedMs = 0;
    output.write("\n");
    this.paint();
    this.timer = setInterval(() => {
      if (this.done || !this.active) return;
      this.dots = (this.dots + 1) % 4;
      this.paint();
    }, 350);
  }

  log(kind: TraceLine["kind"], text: string): void {
    this.lines.push({ kind, text });
  }

  private paint(): void {
    if (!this.active || this.done) return;
    const label = `${c.yellow}${c.bold}Pensando${".".repeat(this.dots)}${" ".repeat(3 - this.dots)}${c.reset}`;
    // Solo \r — nunca \n (evita el spam de líneas)
    output.write(`\r\x1b[2K  ${label}${c.muted}  …${c.reset}`);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  abort(): void {
    this.stopTimer();
    this.active = false;
    this.done = true;
    output.write("\r\x1b[2K");
  }

  async fail(message: string): Promise<void> {
    this.stopTimer();
    this.done = true;
    this.active = false;
    this.elapsedMs = Date.now() - this.startedAt;
    output.write(
      `\r\x1b[2K  ${c.orange}✗${c.reset} ${c.muted}${(this.elapsedMs / 1000).toFixed(1)}s${c.reset}\n`
    );
    output.write(`${c.orange}Error:${c.reset} ${message}\n`);
  }

  async finish(): Promise<{ summary: string; details: string[] }> {
    this.stopTimer();
    this.done = true;
    this.active = false;
    this.elapsedMs = Date.now() - this.startedAt;
    const secs = (this.elapsedMs / 1000).toFixed(1);
    output.write("\r\x1b[2K");
    const details = this.lines.map((l) => {
      const icon = l.kind === "tool" ? "⚙" : l.kind === "cycle" ? "↻" : l.kind === "warn" ? "!" : "·";
      return `${icon} ${l.text}`;
    });
    return { summary: `${secs}s`, details };
  }

  getLines(): TraceLine[] {
    return [...this.lines];
  }
}
