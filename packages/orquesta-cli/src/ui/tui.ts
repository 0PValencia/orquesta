/**
 * TUI estilo OpenCode (patrones, no OpenTUI nativo):
 * - Alternate screen buffer → sin scrollback ni pantallas apiladas
 * - Frame de altura fija (= rows) → nunca hace scroll
 * - Input actualizado in-place (sin clear total por tecla)
 * - Logo responsive según ancho del terminal
 */
import { stdin as input, stdout as output } from "node:process";
import { c, visibleWidth } from "./theme.js";

export type ChatMessage = { role: "user" | "assistant" | "thought"; text: string };

function termSize(): { cols: number; rows: number } {
  return {
    cols: Math.max(40, output.columns || 80),
    rows: Math.max(12, output.rows || 24),
  };
}

/** Recorta a ancho visible, preservando códigos ANSI. */
function clip(s: string, max: number): string {
  if (max <= 0) return "";
  let vis = 0;
  let out = "";
  const re = /(\x1b\[[0-9;]*m)|([^\x1b])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[1]) {
      out += m[1];
      continue;
    }
    if (vis >= max) break;
    out += m[2];
    vis++;
  }
  return out;
}

function padEndVis(s: string, width: number): string {
  const w = visibleWidth(s);
  if (w >= width) return clip(s, width);
  return s + " ".repeat(width - w);
}

function centerVis(s: string, width: number): string {
  const w = visibleWidth(s);
  if (w >= width) return clip(s, width);
  const left = Math.floor((width - w) / 2);
  return " ".repeat(left) + s + " ".repeat(width - w - left);
}

export function hideCursor(): void {
  output.write("\x1b[?25l");
}

export function showCursor(): void {
  output.write("\x1b[?25h");
}

export function enterAltScreen(): void {
  // Buffer alterno + limpia + cursor home (patrón OpenTUI / fullscreen apps)
  output.write("\x1b[?1049h\x1b[2J\x1b[H\x1b[0m");
}

export function leaveAltScreen(): void {
  output.write("\x1b[?1049l\x1b[0m");
  showCursor();
}

export function clearScreen(): void {
  output.write("\x1b[2J\x1b[H\x1b[0m");
}

const LOGO_FULL = [
  "██████╗ ██████╗  ██████╗ ██╗   ██╗███████╗███████╗████████╗ █████╗ ",
  "██╔═══██╗██╔══██╗██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗",
  "██║   ██║██████╔╝██║   ██║██║   ██║█████╗  ███████╗   ██║   ███████║",
  "██║   ██║██╔══██╗██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║   ██╔══██║",
  "╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝███████╗███████║   ██║   ██║  ██║",
  " ╚══▀▀═╝ ╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝",
];

const LOGO_COMPACT = [
  "╔═╗╦═╗╔═╗ ╦ ╦╔═╗╔═╗╔╦╗╔═╗",
  "║ ║╠╦╝║═╬╗║ ║║╣ ╚═╗ ║ ╠═╣",
  "╚═╝╩╚═╚═╝╚╚═╝╚═╝╚═╝ ╩ ╩ ╩",
];

function logoLines(cols: number): string[] {
  const fullW = LOGO_FULL[0].length;
  if (cols >= fullW + 4) return LOGO_FULL;
  if (cols >= 28) return LOGO_COMPACT;
  return [`${c.bold}ORQUESTA${c.reset}`];
}

function boxInnerWidth(cols: number): number {
  return Math.min(64, Math.max(28, cols - 8));
}

async function readLineRaw(opts: {
  onChange: (buf: string) => void;
  onCtrlC?: () => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
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
      // Ignorar eventos de ratón / SGR
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
      // Secuencias de escape (flechas, etc.)
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
    input.setEncoding("utf8");
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
  private statusLine = "";
  private alt = false;
  private inputRow = 0;
  private painting = false;
  private resizeHandler: (() => void) | null = null;
  readonly opts: TuiOpts;

  constructor(opts: TuiOpts) {
    this.opts = opts;
  }

  get isHome(): boolean {
    return this.mode === "home";
  }

  /** Entra al buffer alterno (llamar una vez al iniciar el chat interactivo). */
  mount(): void {
    if (this.alt) return;
    enterAltScreen();
    hideCursor();
    this.alt = true;
    this.resizeHandler = () => {
      if (!this.painting) this.paint(true);
    };
    output.on("resize", this.resizeHandler);
  }

  /** Sale del buffer alterno. */
  unmount(): void {
    if (this.resizeHandler) {
      output.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.alt) {
      leaveAltScreen();
      this.alt = false;
    } else {
      showCursor();
    }
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

  setStatus(text: string): void {
    this.statusLine = text;
    this.paint(true);
  }

  clearStatus(): void {
    this.statusLine = "";
    this.paint(true);
  }

  toggleLastThought(): boolean {
    if (!this.lastThoughtLines.length) return false;
    this.thoughtExpanded = !this.thoughtExpanded;
    this.paint(true);
    return true;
  }

  /** API pública: redibuja frame completo. */
  render(): void {
    this.paint(true);
  }

  private drawBoxLine(content: string, inner: number): string {
    const plain = content.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = Math.max(0, inner - 2 - Math.min(plain.length, inner - 2));
    const clipped = clip(content, inner - 2);
    return `${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${clipped}${c.reset}${c.bgInput}${" ".repeat(pad)}${c.reset}`;
  }

  private buildHome(cols: number, rows: number): { lines: string[]; inputRow: number } {
    const inner = boxInnerWidth(cols);
    const tip = "Si pides Google Docs, Orquesta usa MCP y te deja el enlace.";
    const placeholder = 'Pregunta lo que necesites…  "informe en Docs…"';
    const draftShown = this.draft.length
      ? this.draft.slice(-(inner - 4))
      : `${c.gray}${placeholder}${c.reset}`;

    const logo = logoLines(cols).map((l) => `${c.white}${c.bold}${l}${c.reset}`);
    const mcpShort =
      this.opts.mcpCount > 0
        ? `${c.green}○${c.reset} ${this.opts.mcpCount} MCP · ${this.opts.mcpCount ? "listas" : ""}`
        : `${c.muted}○ 0 MCP${c.reset}`;

    const block: string[] = [
      ...logo,
      "",
      this.drawBoxLine(draftShown, inner),
      this.drawBoxLine(
        `${c.blue}Build${c.reset}${c.gray} · ${this.opts.model} · orquesta${c.reset}  ${c.orange}max${c.reset}`,
        inner
      ),
      "",
      `${c.muted}enter enviar · ctrl+c salir${c.reset}`,
      "",
      `${c.orange}● Tip${c.reset} ${c.gray}${tip}${c.reset}`,
      "",
      `${c.muted}~${c.reset} ${mcpShort} ${c.muted}/estado${c.reset}    ${c.muted}${this.opts.version}${c.reset}`,
    ];

    if (this.statusLine) {
      block.push("", `${c.yellow}${this.statusLine}${c.reset}`);
    }

    // Centrar verticalmente sin desbordar rows
    const contentH = Math.min(block.length, rows);
    const topPad = Math.max(0, Math.floor((rows - contentH) / 3));
    const lines = Array.from({ length: rows }, () => "");
    let inputRow = topPad + logo.length + 1; // fila de la caja de input

    for (let i = 0; i < contentH; i++) {
      const row = topPad + i;
      if (row >= rows) break;
      lines[row] = centerVis(block[i], cols);
      // Detectar fila del input (primera línea de caja = draft)
      if (i === logo.length + 1) inputRow = row;
    }
    return { lines, inputRow };
  }

  private buildSession(cols: number, rows: number): { lines: string[]; inputRow: number } {
    const inputH = 3;
    const headerH = 1;
    const statusH = this.statusLine ? 1 : 0;
    const bodyH = Math.max(4, rows - inputH - headerH - statusH);
    const lines = Array.from({ length: rows }, () => "");

    lines[0] = padEndVis(
      `${c.blue}Build${c.reset}${c.gray} · ${this.opts.model}${c.reset}` +
        `${" ".repeat(4)}${c.muted}${this.opts.version}${c.reset}`,
      cols
    );

    const chat: string[] = [];
    for (const m of this.messages) {
      if (m.role === "user") {
        chat.push(`${c.white}${m.text}${c.reset}`);
        chat.push("");
      } else if (m.role === "assistant") {
        for (const l of m.text.split("\n")) {
          chat.push(`${c.blue}┃${c.reset} ${c.white}${l}${c.reset}`);
        }
        chat.push("");
      } else if (m.role === "thought") {
        const arrow = this.thoughtExpanded ? "▾" : "▸";
        chat.push(
          `${c.orange}${arrow} Thought · ${m.text}${c.reset}${c.muted}  (t + enter)${c.reset}`
        );
        if (this.thoughtExpanded) {
          for (const d of this.lastThoughtLines) {
            chat.push(`${c.muted}  · ${d}${c.reset}`);
          }
        }
        chat.push("");
      }
    }

    const visible = chat.slice(-bodyH);
    const padTop = Math.max(0, bodyH - visible.length);
    for (let i = 0; i < bodyH; i++) {
      const text = i < padTop ? "" : visible[i - padTop] || "";
      lines[headerH + i] = padEndVis(text, cols);
    }

    let row = headerH + bodyH;
    if (this.statusLine && row < rows) {
      lines[row] = padEndVis(`${c.yellow}${this.statusLine}${c.reset}`, cols);
      row++;
    }

    const inputRow = Math.min(row, rows - inputH);
    const barInner = Math.max(8, cols - 4);
    const shown = this.draft.slice(-(barInner - 2));
    const fill = Math.max(0, barInner - 2 - visibleWidth(shown));
    lines[inputRow] = padEndVis(
      `${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${c.white}${shown}${c.reset}${c.bgInput}${" ".repeat(fill)}${c.reset}`,
      cols
    );
    if (inputRow + 1 < rows) {
      lines[inputRow + 1] = padEndVis(
        `${c.muted}Build · ${this.opts.model}${c.reset}  ${c.orange}max${c.reset}` +
          `${" ".repeat(3)}${c.muted}t thought · ctrl+c salir${c.reset}`,
        cols
      );
    }

    return { lines, inputRow };
  }

  /**
   * Pinta exactamente `rows` líneas en (0,0). Nunca hace scroll → no duplica.
   */
  private paint(full: boolean): void {
    if (!this.alt) {
      // Fallback si aún no montamos (p.ej. tests)
      enterAltScreen();
      this.alt = true;
    }
    if (this.painting) return;
    this.painting = true;
    try {
      const { cols, rows } = termSize();
      const built =
        this.mode === "home" ? this.buildHome(cols, rows) : this.buildSession(cols, rows);
      this.inputRow = built.inputRow;

      if (full) {
        hideCursor();
        // Home + pintar cada fila con clear-to-eol (sin \n extras al final)
        output.write("\x1b[H");
        for (let i = 0; i < rows; i++) {
          const line = clip(built.lines[i] || "", cols);
          output.write(`\x1b[${i + 1};1H\x1b[2K${line}`);
        }
        // Cursor en la caja de input
        const col = Math.min(cols - 1, 3 + Math.min(this.draft.length, boxInnerWidth(cols) - 4));
        output.write(`\x1b[${this.inputRow + 1};${col}H`);
        showCursor();
      } else {
        // Solo actualizar fila de input (tecleo rápido)
        const line = clip(built.lines[this.inputRow] || "", cols);
        hideCursor();
        output.write(`\x1b[${this.inputRow + 1};1H\x1b[2K${line}`);
        const col = Math.min(cols - 1, 3 + Math.min(this.draft.length, boxInnerWidth(cols) - 4));
        output.write(`\x1b[${this.inputRow + 1};${col}H`);
        showCursor();
      }
    } finally {
      this.painting = false;
    }
  }

  async prompt(): Promise<string> {
    this.draft = "";
    if (!this.alt) this.mount();
    this.paint(true);
    try {
      const line = await readLineRaw({
        onChange: (buf) => {
          this.draft = buf;
          // Solo la fila del input → responsive, sin flicker ni duplicación
          this.paint(false);
        },
        onCtrlC: () => {
          this.unmount();
          process.exit(0);
        },
      });
      this.draft = "";
      return line.trim();
    } catch (e) {
      throw e;
    }
  }
}
