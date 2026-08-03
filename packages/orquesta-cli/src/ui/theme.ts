/** Paleta Orquesta — verde chillón. */
export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  /** Acento principal: lima neón */
  green: "\x1b[38;2;57;255;20m",
  greenDim: "\x1b[38;2;40;180;40m",
  /** Alias: acento = verde (antes blue) */
  blue: "\x1b[38;2;57;255;20m",
  orange: "\x1b[38;2;180;255;80m",
  gray: "\x1b[38;2;120;160;120m",
  muted: "\x1b[38;2;70;100;70m",
  white: "\x1b[38;2;220;255;220m",
  yellow: "\x1b[38;2;200;255;80m",
  bgInput: "\x1b[48;2;12;28;14m",
};

function cols(): number {
  return Math.max(60, outputColumns());
}

function outputColumns(): number {
  try {
    return process.stdout.columns || 80;
  } catch {
    return 80;
  }
}

/** Ancho visible aproximado (sin ANSI). */
export function visibleWidth(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function centerLine(s: string, width = cols()): string {
  const w = visibleWidth(s);
  const pad = Math.max(0, Math.floor((width - w) / 2));
  return " ".repeat(pad) + s;
}

export function centerBlock(text: string, width = cols()): string {
  return text
    .split("\n")
    .map((l) => centerLine(l, width))
    .join("\n");
}

/** Logo tipo OpenCode: wordmark centrado (hueco / display). */
export const LOGO = centerBlock(
  [
    `${c.white}${c.bold}██████╗ ██████╗  ██████╗ ██╗   ██╗███████╗███████╗████████╗ █████╗ ${c.reset}`,
    `${c.white}${c.bold}██╔═══██╗██╔══██╗██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗${c.reset}`,
    `${c.white}${c.bold}██║   ██║██████╔╝██║   ██║██║   ██║█████╗  ███████╗   ██║   ███████║${c.reset}`,
    `${c.white}${c.bold}██║   ██║██╔══██╗██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║   ██╔══██║${c.reset}`,
    `${c.white}${c.bold}╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝███████╗███████║   ██║   ██║  ██║${c.reset}`,
    `${c.white}${c.bold} ╚══▀▀═╝ ╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝${c.reset}`,
  ].join("\n")
);

function inputBox(lines: string[], width = cols()): string[] {
  const inner = Math.min(64, Math.max(48, width - 8));
  const pad = Math.max(0, Math.floor((width - inner) / 2));
  const left = " ".repeat(pad);
  const out: string[] = [];
  for (const line of lines) {
    const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
    const fill = Math.max(0, inner - 2 - plain.length);
    out.push(
      `${left}${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${line}${c.reset}${c.bgInput}${" ".repeat(fill)}${c.reset}`
    );
  }
  return out;
}

export function printHome(opts: {
  mcpCount: number;
  model: string;
  version: string;
}): void {
  const { mcpCount, model, version } = opts;
  const width = cols();

  // Espacio superior (sensación fullscreen / centrado vertical ligero)
  const topPad = Math.min(4, Math.max(1, Math.floor(((process.stdout.rows || 24) - 18) / 3)));
  console.log("\n".repeat(topPad));
  console.log(LOGO);
  console.log("");

  for (const row of inputBox(
    [
      `${c.gray}Pregunta lo que necesites…  "informe en Google Docs sobre …"${c.reset}`,
      `${c.blue}Build${c.reset}${c.gray} · ${model} · orquesta${c.reset}  ${c.orange}max${c.reset}`,
    ],
    width
  )) {
    console.log(row);
  }

  console.log("");
  console.log(centerLine(`${c.muted}tab ayuda   ctrl+c salir${c.reset}`, width));
  console.log("");
  console.log(
    centerLine(
      `${c.orange}● Tip${c.reset} ${c.gray}Si pides Google Docs / Documents, Orquesta usa MCP y te deja el enlace.${c.reset}`,
      width
    )
  );
  console.log("");

  const mcpLabel =
    mcpCount > 0
      ? `${c.green}○${c.reset} ${mcpCount} MCP`
      : `${c.muted}○ 0 MCP${c.reset}`;
  const footL = `  ${c.muted}~${c.reset} ${mcpLabel} ${c.muted}/estado${c.reset}`;
  const footR = `${c.muted}${version}${c.reset}`;
  const gap = Math.max(2, width - visibleWidth(footL) - visibleWidth(footR) - 2);
  console.log(`${footL}${" ".repeat(gap)}${footR}`);
  console.log("");
}

/** Respuesta limpia (sin cajas que se rompen al copiar). */
export function printAssistant(text: string): void {
  console.log("");
  console.log(`${c.green}┃${c.reset} ${c.white}orquesta${c.reset}`);
  for (const line of text.split("\n")) {
    console.log(`${c.green}┃${c.reset} ${c.white}${line}${c.reset}`);
  }
  console.log("");
}

/** Limpia basura de copy-paste (bordes Unicode, prompts viejos). */
export function sanitizeUserInput(raw: string): string {
  const cleaned = raw
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) =>
      l
        .replace(/[╭╮╰╯│─┌┐└┘┃]/g, "")
        .replace(/^\s*tú\s*[›>]\s*/i, "")
        .replace(/^\s*orquesta\s*/i, "")
        .trim()
    )
    .filter((l) => l.length > 0 && !/^Pensand/i.test(l) && !/^Thought/i.test(l));
  if (!cleaned.length) return raw.trim();
  if (cleaned.length === 1) return cleaned[0];
  const first = cleaned.find((l) => l.length > 2) || cleaned[0];
  return first;
}
