import { c } from "./theme.js";
import { muteInput, type InputMuteHandle } from "./input-mute.js";

export type TraceLine = { kind: "cycle" | "tool" | "info" | "warn"; text: string };

export type ThinkingSink = {
  setStatus(text: string): void;
  clearStatus(): void;
  render?(): void;
};

/**
 * Pensando: UNA sola línea de estado en el TUI (sin escribir a stdout suelto).
 * Mutea teclado/scroll para que no salga basura (^[[A, etc.).
 */
export class ThinkingUI {
  private lines: TraceLine[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private dots = 0;
  private done = false;
  private startedAt = 0;
  private elapsedMs = 0;
  private active = false;
  private sink: ThinkingSink | null;
  private mute: InputMuteHandle | null = null;

  constructor(sink: ThinkingSink | null = null) {
    this.sink = sink;
  }

  begin(): void {
    this.lines = [];
    this.dots = 0;
    this.done = false;
    this.active = true;
    this.startedAt = Date.now();
    this.elapsedMs = 0;
    this.mute = muteInput({
      onCtrlC: () => {
        try {
          process.emit("SIGINT");
        } catch {
          /* ignore */
        }
      },
    });
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
    const label = `Pensando${".".repeat(this.dots)}${" ".repeat(3 - this.dots)}`;
    if (this.sink) {
      this.sink.setStatus(label);
      return;
    }
    process.stdout.write(`\r\x1b[2K  ${c.yellow}${c.bold}${label}${c.reset}`);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private releaseMute(): void {
    this.mute?.release();
    this.mute = null;
  }

  abort(): void {
    this.stopTimer();
    this.releaseMute();
    this.active = false;
    this.done = true;
    this.sink?.clearStatus();
    if (!this.sink) process.stdout.write("\r\x1b[2K");
  }

  async fail(message: string): Promise<void> {
    this.stopTimer();
    this.releaseMute();
    this.done = true;
    this.active = false;
    this.elapsedMs = Date.now() - this.startedAt;
    this.sink?.clearStatus();
    if (!this.sink) {
      process.stdout.write(
        `\r\x1b[2K  ${c.orange}✗${c.reset} ${c.muted}${(this.elapsedMs / 1000).toFixed(1)}s${c.reset}\n`
      );
      process.stdout.write(`${c.orange}Error:${c.reset} ${message}\n`);
    }
  }

  async finish(): Promise<{ summary: string; details: string[] }> {
    this.stopTimer();
    this.releaseMute();
    this.done = true;
    this.active = false;
    this.elapsedMs = Date.now() - this.startedAt;
    const secs = (this.elapsedMs / 1000).toFixed(1);
    this.sink?.clearStatus();
    if (!this.sink) process.stdout.write("\r\x1b[2K");
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
