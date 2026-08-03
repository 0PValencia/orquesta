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

/** Envuelve texto plano al ancho (palabra a palabra). */
function wrapPlain(text: string, width: number): string[] {
  const w = Math.max(8, width);
  const out: string[] = [];
  for (const para of text.replace(/\r/g, "").split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/(\s+)/);
    let line = "";
    for (const part of words) {
      if (!part) continue;
      if (visibleWidth(line) + visibleWidth(part) <= w) {
        line += part;
        continue;
      }
      if (line.trim()) out.push(line.replace(/\s+$/, ""));
      // palabra más larga que el ancho → cortar
      if (visibleWidth(part) > w) {
        let rest = part.trimStart();
        while (visibleWidth(rest) > w) {
          out.push(rest.slice(0, w));
          rest = rest.slice(w);
        }
        line = rest;
      } else {
        line = part.trimStart();
      }
    }
    if (line.trim() || line === "") out.push(line.replace(/\s+$/, ""));
  }
  return out.length ? out : [""];
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
  /** Clic izquierdo: fila 1-based del terminal */
  onClick?: (row: number, col: number) => void;
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

    // Mouse SGR (clic Thought)
    try {
      output.write("\x1b[?1000h\x1b[?1006h");
    } catch {
      /* ignore */
    }

    const cleanup = () => {
      input.off("data", onData);
      try {
        output.write("\x1b[?1006l\x1b[?1000l");
      } catch {
        /* ignore */
      }
      try {
        input.setRawMode(wasRaw ?? false);
      } catch {
        /* ignore */
      }
    };

    const onData = (chunk: Buffer | string) => {
      const s = String(chunk);

      // SGR mouse: ESC [ < btn ; col ; row M/m
      const mouse = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(s);
      if (mouse) {
        const btn = Number(mouse[1]);
        const col = Number(mouse[2]);
        const row = Number(mouse[3]);
        const press = mouse[4] === "M";
        if (press && btn === 0) opts.onClick?.(row, col);
        return;
      }
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
  private thoughtExpanded = true;
  private lastThoughtLines: string[] = [];
  private thoughtHitRows: number[] = [];
  private statusLine = "";
  private choiceOverlay: { question: string; options: string[]; index: number } | null = null;
  private alt = false;
  private inputRow = 0;
  private inputCol = 3;
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
    this.thoughtExpanded = true; // mostrar proceso al toque
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

  /** Encuesta ↑/↓ dentro del alt-screen (no rompe el TUI). */
  async pickChoice(
    question: string,
    options: { label: string; value: string; hint?: string }[]
  ): Promise<string> {
    let index = 0;
    this.choiceOverlay = {
      question,
      options: options.map((o) => o.label + (o.hint ? `  (${o.hint})` : "")),
      index,
    };
    this.paint(true);

    return new Promise((resolve, reject) => {
      if (!input.isTTY) {
        this.choiceOverlay = null;
        resolve(options[0]?.value || "");
        return;
      }
      const wasRaw = input.isRaw;
      input.setRawMode(true);
      input.resume();
      input.setEncoding("utf8");

      const cleanup = () => {
        input.off("data", onData);
        try {
          input.setRawMode(wasRaw ?? false);
        } catch {
          /* ignore */
        }
        this.choiceOverlay = null;
      };

      const onData = (chunk: Buffer | string) => {
        const key = String(chunk);
        if (key === "\u0003") {
          cleanup();
          reject(new Error("SIGINT"));
          return;
        }
        if (key === "\r" || key === "\n") {
          const val = options[index]?.value || "";
          cleanup();
          this.paint(true);
          resolve(val);
          return;
        }
        if (key === "\x1b[A" || key === "\x1bOA" || key === "k") {
          index = (index - 1 + options.length) % options.length;
          this.choiceOverlay = {
            question,
            options: options.map((o) => o.label + (o.hint ? `  (${o.hint})` : "")),
            index,
          };
          this.paint(true);
          return;
        }
        if (key === "\x1b[B" || key === "\x1bOB" || key === "j") {
          index = (index + 1) % options.length;
          this.choiceOverlay = {
            question,
            options: options.map((o) => o.label + (o.hint ? `  (${o.hint})` : "")),
            index,
          };
          this.paint(true);
        }
      };
      input.on("data", onData);
    });
  }

  /** API pública: redibuja frame completo. */
  render(): void {
    this.paint(true);
  }

  private drawInputBox(content: string, inner: number): string {
    const maxInner = Math.max(4, inner - 2);
    const clipped = clip(content, maxInner);
    const pad = Math.max(0, maxInner - visibleWidth(clipped));
    return `${c.bgInput}${c.green}┃${c.reset}${c.bgInput} ${clipped}${c.reset}${c.bgInput}${" ".repeat(pad)}${c.reset}`;
  }

  private buildHome(cols: number, rows: number): {
    lines: string[];
    inputRow: number;
    inputCol: number;
  } {
    const inner = boxInnerWidth(cols);
    const placeholder = "Pregunta lo que necesites…";
    const draftShown = this.draft.length
      ? `${c.white}${this.draft.slice(-(inner - 4))}${c.reset}`
      : `${c.greenDim}${placeholder}${c.reset}`;

    const logo = logoLines(cols).map((l) => `${c.green}${c.bold}${l}${c.reset}`);
    const mcpShort =
      this.opts.mcpCount > 0
        ? `${c.green}●${c.reset} ${c.gray}${this.opts.mcpCount} MCP${c.reset}`
        : `${c.muted}○ 0 MCP${c.reset}`;

    const inputBox = this.drawInputBox(draftShown, inner);

    // Solo: logo + espacio + caja de escribir centrada + pie mínimo
    const block: string[] = [
      ...logo,
      "",
      "",
      inputBox,
      "",
      `${mcpShort}  ${c.muted}${this.opts.version}${c.reset}`,
    ];

    if (this.statusLine) {
      block.push("", `${c.yellow}${this.statusLine}${c.reset}`);
    }

    const contentH = Math.min(block.length, rows);
    const topPad = Math.max(0, Math.floor((rows - contentH) / 3));
    const lines = Array.from({ length: rows }, () => "");
    const inputIdx = logo.length + 2; // tras logo + 2 blancos
    let inputRow = topPad + inputIdx;

    for (let i = 0; i < contentH; i++) {
      const row = topPad + i;
      if (row >= rows) break;
      lines[row] = centerVis(block[i], cols);
      if (i === inputIdx) inputRow = row;
    }

    const boxW = visibleWidth(inputBox);
    const leftPad = Math.max(0, Math.floor((cols - boxW) / 2));
    const typed = Math.min(this.draft.length, Math.max(0, inner - 4));
    const inputCol = Math.min(cols, leftPad + 3 + typed);

    return { lines, inputRow, inputCol };
  }

  private buildSession(cols: number, rows: number): {
    lines: string[];
    inputRow: number;
    inputCol: number;
  } {
    const inputH = 3;
    const headerH = 1;
    const statusH = this.statusLine ? 1 : 0;
    const bodyH = Math.max(4, rows - inputH - headerH - statusH);
    const lines = Array.from({ length: rows }, () => "");

    lines[0] = padEndVis(
      `${c.green}orquesta${c.reset}${c.gray} · ${this.opts.model}${c.reset}` +
        `${" ".repeat(4)}${c.muted}${this.opts.version}${c.reset}`,
      cols
    );

    const chat: string[] = [];
    const textW = Math.max(12, cols - 4); // margen + ┃
    const thoughtHits: number[] = [];
    for (const m of this.messages) {
      if (m.role === "user") {
        for (const l of wrapPlain(m.text, textW)) {
          chat.push(`${c.white}${l}${c.reset}`);
        }
        chat.push("");
      } else if (m.role === "assistant") {
        for (const l of wrapPlain(m.text, textW - 2)) {
          chat.push(`${c.green}┃${c.reset} ${c.white}${l}${c.reset}`);
        }
        chat.push("");
      } else if (m.role === "thought") {
        const arrow = this.thoughtExpanded ? "▾" : "▸";
        const head = `${arrow} Thought · ${m.text}  (clic o t)`;
        const start = chat.length;
        for (const l of wrapPlain(head, textW)) {
          chat.push(`${c.green}${l}${c.reset}`);
        }
        if (this.thoughtExpanded) {
          for (const d of this.lastThoughtLines) {
            for (const l of wrapPlain(`· ${d}`, textW - 2)) {
              chat.push(`${c.muted}  ${l}${c.reset}`);
            }
          }
        }
        // filas relativas al chat; se ajustan abajo con padTop
        thoughtHits.push(start);
        chat.push("");
      }
    }

    if (this.choiceOverlay) {
      chat.push(`${c.green}${c.bold}${this.choiceOverlay.question}${c.reset}`);
      chat.push(`${c.muted}↑/↓ mover · enter elegir${c.reset}`);
      this.choiceOverlay.options.forEach((label, i) => {
        const sel = i === this.choiceOverlay!.index;
        chat.push(
          sel
            ? `${c.green}❯ ${label}${c.reset}`
            : `${c.muted}  ${label}${c.reset}`
        );
      });
      chat.push("");
    }

    const visible = chat.slice(-bodyH);
    const padTop = Math.max(0, bodyH - visible.length);
    const chatStart = Math.max(0, chat.length - bodyH);
    this.thoughtHitRows = thoughtHits
      .map((rel) => {
        if (rel < chatStart) return -1;
        return headerH + padTop + (rel - chatStart);
      })
      .filter((r) => r >= 0);

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
      `${c.bgInput}${c.green}┃${c.reset}${c.bgInput} ${c.white}${shown}${c.reset}${c.bgInput}${" ".repeat(fill)}${c.reset}`,
      cols
    );
    if (inputRow + 1 < rows) {
      lines[inputRow + 1] = padEndVis(
        `${c.muted}${this.opts.model}${c.reset}${" ".repeat(3)}${c.muted}t thought · ctrl+c${c.reset}`,
        cols
      );
    }

    const typed = Math.min(this.draft.length, Math.max(0, barInner - 2));
    return { lines, inputRow, inputCol: Math.min(cols, 3 + typed) };
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
      this.inputCol = built.inputCol;

      if (full) {
        hideCursor();
        output.write("\x1b[H");
        for (let i = 0; i < rows; i++) {
          const line = clip(built.lines[i] || "", cols);
          output.write(`\x1b[${i + 1};1H\x1b[2K${line}`);
        }
        output.write(`\x1b[${this.inputRow + 1};${this.inputCol}H`);
        showCursor();
      } else {
        const line = clip(built.lines[this.inputRow] || "", cols);
        hideCursor();
        output.write(`\x1b[${this.inputRow + 1};1H\x1b[2K${line}`);
        output.write(`\x1b[${this.inputRow + 1};${this.inputCol}H`);
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
          this.paint(false);
        },
        onClick: (row) => {
          // Filas ANSI son 1-based
          const r0 = row - 1;
          if (this.thoughtHitRows.some((hr) => Math.abs(hr - r0) <= 1)) {
            this.toggleLastThought();
          }
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
