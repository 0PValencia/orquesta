import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { c } from "./theme.js";

export type TraceLine = { kind: "cycle" | "tool" | "info" | "warn"; text: string };

/**
 * Pensando… (puntos animados). Enter expande/oculta el proceso del agente.
 * Colapsado: solo "Pensando..." / "Pensado".
 */
export class ThinkingUI {
  private lines: TraceLine[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private dots = 0;
  private expanded = false;
  private done = false;
  private headerRow = false;

  begin(): void {
    this.lines = [];
    this.dots = 0;
    this.expanded = false;
    this.done = false;
    output.write("\n");
    this.paintCollapsed();
    this.headerRow = true;
    this.timer = setInterval(() => {
      this.dots = (this.dots + 1) % 4;
      this.paintCollapsed();
    }, 400);
  }

  log(kind: TraceLine["kind"], text: string): void {
    this.lines.push({ kind, text });
    // No spamear el proceso en vivo: solo queda en buffer para el toggle
  }

  private paintCollapsed(): void {
    if (!output.isTTY) return;
    const label = this.done
      ? `${c.yellow}${c.bold}Pensado${c.reset}`
      : `${c.yellow}${c.bold}Pensando${".".repeat(this.dots)}${" ".repeat(3 - this.dots)}${c.reset}`;
    const hint = this.done
      ? `${c.muted}  Enter = ${this.expanded ? "ocultar" : "ver"} proceso${c.reset}`
      : `${c.muted}  …${c.reset}`;
    // Reescribir misma línea
    output.write(`\r\x1b[2K  ${label}${hint}`);
  }

  private paintExpanded(): void {
    output.write("\n");
    output.write(`  ${c.muted}┌ proceso${"─".repeat(28)}${c.reset}\n`);
    for (const l of this.lines) {
      const icon = l.kind === "tool" ? "⚙" : l.kind === "cycle" ? "↻" : l.kind === "warn" ? "!" : "·";
      output.write(`  ${c.muted}│ ${icon} ${l.text}${c.reset}\n`);
    }
    if (!this.lines.length) {
      output.write(`  ${c.muted}│ (sin pasos registrados)${c.reset}\n`);
    }
    output.write(`  ${c.muted}└ Enter oculta${"─".repeat(24)}${c.reset}\n`);
  }

  private clearExpandedBlock(): void {
    // No hay forma perfecta sin guardar filas; imprimimos colapsado en línea nueva
    output.write("\n");
    this.paintCollapsed();
  }

  async finish(interactive: boolean): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.done = true;
    this.expanded = false;
    this.paintCollapsed();
    output.write("\n");

    if (!interactive || !input.isTTY) return;

    // Toggle opcional: Enter en ~2.5s abre proceso; Enter otra vez cierra; timeout sigue
    const first = await waitKey(["enter"], 2500);
    if (first !== "enter") return;

    this.expanded = true;
    this.paintExpanded();
    const second = await waitKey(["enter"], 120_000);
    if (second === "enter") {
      this.expanded = false;
      // marcar colapsado otra vez
      output.write(`  ${c.yellow}${c.bold}Pensado${c.reset}${c.muted}  (proceso oculto)${c.reset}\n`);
    }
  }

  getLines(): TraceLine[] {
    return [...this.lines];
  }
}

function waitKey(keys: Array<"enter" | "other">, ms: number): Promise<"enter" | "timeout" | "other"> {
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
        return;
      }
      if (s === "\u0003") {
        cleanup();
        resolve("other");
        return;
      }
      // cualquier otra tecla = no expandir
      if (keys.includes("other")) {
        cleanup();
        resolve("other");
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
