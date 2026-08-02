/** ANSI helpers — chat estilo burbuja / DeepSeek thinking. */
export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  bgYellow: "\x1b[43m",
  black: "\x1b[30m",
  white: "\x1b[37m",
};

export function userBubble(text: string): string {
  const lines = wrap(text, 56);
  const width = Math.min(58, Math.max(12, ...lines.map((l) => l.length)) + 2);
  const top = `╭─ tú ${"─".repeat(Math.max(1, width - 5))}╮`;
  const bot = `╰${"─".repeat(width)}╯`;
  const body = lines.map((l) => `│ ${l.padEnd(width - 2)} │`).join("\n");
  return `${c.cyan}${top}${c.reset}\n${body}\n${c.cyan}${bot}${c.reset}`;
}

export function assistantBubble(text: string): string {
  const lines = wrap(text, 56);
  const width = Math.min(58, Math.max(16, ...lines.map((l) => l.length)) + 2);
  const top = `╭─ orquesta ${"─".repeat(Math.max(1, width - 11))}╮`;
  const bot = `╰${"─".repeat(width)}╯`;
  const body = lines.map((l) => `│ ${l.padEnd(width - 2)} │`).join("\n");
  return `${c.green}${top}${c.reset}\n${body}\n${c.green}${bot}${c.reset}`;
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if ((line + word).length > max && line.trim()) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line += word;
      }
    }
    if (line) out.push(line.trimEnd());
  }
  return out.length ? out : [""];
}
