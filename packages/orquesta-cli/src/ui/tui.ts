import { stdin as input, stdout as output } from "node:process";
import { c, centerLine, visibleWidth } from "./theme.js";

export type ChatMessage = { role: "user" | "assistant" | "thought"; text: string };

function termSize(): { cols: number; rows: number } {
  return {
    cols: Math.max(60, output.columns || 80),
    rows: Math.max(20, output.rows || 24),
  };
}

export function clearScreen(): void {
  output.write("\x1b[2J\x1b[H\x1b[0m");
}

export function hideCursor(): void {
  output.write("\x1b[?25l");
}

export function showCursor(): void {
  output.write("\x1b[?25h");
}

const LOGO_LINES = [
  "██████╗ ██████╗  ██████╗ ██╗   ██╗███████╗███████╗████████╗ █████╗ ",
  "██╔═══██╗██╔══██╗██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗",
  "██║   ██║██████╔╝██║   ██║██║   ██║█████╗  ███████╗   ██║   ███████║",
  "██║   ██║██╔══██╗██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║   ██╔══██║",
  "╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝███████╗███████║   ██║   ██║  ██║",
  " ╚══▀▀═╝ ╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝",
];

function boxInnerWidth(cols: number): number {
  return Math.min(72, Math.max(44, cols - 10));
}

async function readLineRaw(opts: {
  onChange: (buf: string) => void;
  onCtrlC?: () => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
      let data = "";
      input.setEncoding("utf8");
      input.once("data", (chunk) => resolve(String(chunk).trim()));
      return;
    }
    const wasRaw = input.isRaw;
    let buf = "";
    opts.onChange(buf);

    const cleanup = () => {
      input.off("data", onData);
      try {
        input.setRawMode(wasRaw ?? false);
      } catch {
        /* ignore */
      }
    };

    const onData = (chunk: Buffer | string) => {
      const s = String(chunk);
      if (s.includes("\x1b[<") || /\x1b\[M/.test(s)) return;

      if (s === "\u0003") {
        cleanup();
        opts.onCtrlC?.();
        reject(new Error("SIGINT"));
        return;
      }
      if (s === "\r" || s === "\n") {
        cleanup();
        resolve(buf);
        return;
      }
      if (s === "\u007f" || s === "\b") {
        buf = buf.slice(0, -1);
        opts.onChange(buf);
        return;
      }
      if (s.startsWith("\x1b")) return;
      const clean = s.replace(/[\x00-\x1f]/g, "");
      if (!clean) return;
      buf += clean;
      if (buf.length > 2000) buf = buf.slice(0, 2000);
      opts.onChange(buf);
    };

    try {
      input.setRawMode(true);
    } catch (e) {
      reject(e);
      return;
    }
    input.resume();
    input.on("data", onData);
  });
}

export type TuiOpts = {
  model: string;
  version: string;
  mcpCount: number;
  mcpLabel: string;
};

export class OrquestaTui {
  private mode: "home" | "session" = "home";
  private messages: ChatMessage[] = [];
  private draft = "";
  private thoughtExpanded = false;
  private lastThoughtLines: string[] = [];
  readonly opts: TuiOpts;

  constructor(opts: TuiOpts) {
    this.opts = opts;
  }

  get isHome(): boolean {
    return this.mode === "home";
  }

  enterSession(): void {
    this.mode = "session";
  }

  addUser(text: string): void {
    this.messages.push({ role: "user", text });
  }

  addAssistant(text: string): void {
    this.messages.push({ role: "assistant", text });
  }

  addThought(summary: string, detailLines: string[]): void {
    this.lastThoughtLines = detailLines;
    this.thoughtExpanded = false;
    this.messages.push({ role: "thought", text: summary });
  }

  toggleLastThought(): boolean {
    if (!this.lastThoughtLines.length) return false;
    this.thoughtExpanded = !this.thoughtExpanded;
    this.render();
    return true;
  }

  renderHome(): void {
    const { cols, rows } = termSize();
    const inner = boxInnerWidth(cols);
    const tip = "Si pides Google Docs / Documents, Orquesta usa MCP y te deja el enlace.";
    const placeholder = 'Pregunta lo que necesites…  "informe en Google Docs sobre …"';
    const line1 = this.draft.length ? this.draft.slice(-(inner - 4)) : `${c.gray}${placeholder}${c.reset}`;

    const block: string[] = [
      ...LOGO_LINES.map((l) => `${c.white}${c.bold}${l}${c.reset}`),
      "",
      this.drawBoxLine(line1, inner),
      this.drawBoxLine(
        `${c.blue}Build${c.reset}${c.gray} · ${this.opts.model} · orquesta${c.reset}  ${c.orange}max${c.reset}`,
        inner
      ),
      "",
      `${c.muted}enter enviar   ctrl+c salir${c.reset}`,
      "",
      `${c.orange}● Tip${c.reset} ${c.gray}${tip}${c.reset}`,
      "",
      `${c.muted}~${c.reset} ${c.green}○${c.reset} ${this.opts.mcpCount} MCP ${c.muted}/estado${c.reset}    ${c.muted}${this.opts.version}${c.reset}`,
      "",
      `${c.muted}${this.opts.mcpLabel.replace(/\x1b\[[0-9;]*m/g, "")}${c.reset}`,
    ];

    const topPad = Math.max(1, Math.floor((rows - block.length) / 3));
    clearScreen();
    hideCursor();
    for (let i = 0; i < topPad; i++) output.write("\n");
    for (const row of block) output.write(centerLine(row, cols) + "\n");
    showCursor();
  }

  private drawBoxLine(content: string, inner: number): string {
    const plain = content.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = Math.max(0, inner - 2 - plain.length);
    return `${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${content}${c.reset}${c.bgInput}${" ".repeat(pad)}${c.reset}`;
  }

  renderSession(): void {
    const { cols, rows } = termSize();
    const sidebarW = cols >= 110 ? 30 : 0;
    const mainW = cols - (sidebarW ? sidebarW + 1 : 0);
    const inputH = 3;
    const bodyH = Math.max(6, rows - inputH - 2);

    clearScreen();
    hideCursor();

    // título sesión
    output.write(
      `${c.blue}Build${c.reset}${c.gray} · ${this.opts.model}${c.reset}` +
        `${" ".repeat(Math.max(1, cols - 40))}${c.muted}${this.opts.version}${c.reset}\n`
    );

    const lines: string[] = [];
    for (const m of this.messages) {
      if (m.role === "user") {
        lines.push(`${c.white}${m.text}${c.reset}`);
        lines.push("");
      } else if (m.role === "assistant") {
        for (const l of m.text.split("\n")) {
          lines.push(`${c.blue}┃${c.reset} ${c.white}${l}${c.reset}`);
        }
        lines.push("");
      } else if (m.role === "thought") {
        const arrow = this.thoughtExpanded ? "▾" : "▸";
        lines.push(
          `${c.orange}${arrow} Thought · ${m.text}${c.reset}${c.muted}   (escribí t + enter)${c.reset}`
        );
        if (this.thoughtExpanded) {
          for (const d of this.lastThoughtLines) {
            lines.push(`${c.muted}  · ${d}${c.reset}`);
          }
        }
        lines.push("");
      }
    }

    const visible = lines.slice(-bodyH);
    const padTop = Math.max(0, bodyH - visible.length);

    const sideLines = [
      `${c.bold} Sesión${c.reset}`,
      "",
      `${c.muted} Context${c.reset}`,
      ` ${this.messages.length} msgs`,
      "",
      `${c.muted} MCP${c.reset}`,
      ` ${c.green}●${c.reset} ${this.opts.mcpCount} conectados`,
      "",
      `${c.muted} Model${c.reset}`,
      ` ${this.opts.model}`,
    ];

    for (let i = 0; i < bodyH; i++) {
      const main =
        i < padTop ? "" : visible[i - padTop] || "";
      const mainPad = Math.max(0, mainW - visibleWidth(main) - 1);
      let row = main + " ".repeat(mainPad);
      if (sidebarW > 0) {
        const side = (sideLines[i] || "").padEnd(sidebarW).slice(0, sidebarW);
        row += `${c.muted}│${c.reset}${side}`;
      }
      output.write(row + "\n");
    }

    // Input REAL abajo (como OpenCode en sesión)
    const barInner = Math.max(10, cols - 4);
    const shown = this.draft.slice(-(barInner - 2));
    const fill = Math.max(0, barInner - 2 - visibleWidth(shown));
    output.write(
      `${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${c.white}${shown}${c.reset}${c.bgInput}${" ".repeat(fill)}${c.reset}\n`
    );
    output.write(
      `${c.muted}Build · ${this.opts.model} · orquesta${c.reset}  ${c.orange}max${c.reset}` +
        `${" ".repeat(4)}${c.muted}t thought · ctrl+c salir${c.reset}\n`
    );
    showCursor();
  }

  render(): void {
    if (this.mode === "home") this.renderHome();
    else this.renderSession();
  }

  async prompt(): Promise<string> {
    this.draft = "";
    this.render();
    try {
      const line = await readLineRaw({
        onChange: (buf) => {
          this.draft = buf;
          this.render();
        },
        onCtrlC: () => {
          showCursor();
          clearScreen();
          process.exit(0);
        },
      });
      this.draft = "";
      return line.trim();
    } catch (e) {
      showCursor();
      throw e;
    }
  }
}
