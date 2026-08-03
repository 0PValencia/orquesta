/** Paleta estilo OpenCode (terminal oscuro). */
export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  // OpenCode-ish
  blue: "\x1b[38;2;80;160;255m",
  orange: "\x1b[38;2;255;160;60m",
  green: "\x1b[38;2;80;220;120m",
  gray: "\x1b[38;2;140;140;150m",
  muted: "\x1b[38;2;90;90;100m",
  white: "\x1b[38;2;220;220;230m",
  yellow: "\x1b[38;2;240;200;80m",
  bgInput: "\x1b[48;2;28;28;32m",
};

export const LOGO = `
${c.white}${c.bold}  ██████╗ ██████╗  ██████╗ ██╗   ██╗███████╗███████╗████████╗ █████╗ 
 ██╔═══██╗██╔══██╗██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗
 ██║   ██║██████╔╝██║   ██║██║   ██║█████╗  ███████╗   ██║   ███████║
 ██║   ██║██╔══██╗██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║   ██╔══██║
 ╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝███████╗███████║   ██║   ██║  ██║
  ╚══▀▀═╝ ╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝${c.reset}
`.trimEnd();

export function printHome(opts: {
  mcpCount: number;
  model: string;
  version: string;
}): void {
  const { mcpCount, model, version } = opts;
  console.log(LOGO);
  console.log("");
  // Caja de input (referencia OpenCode)
  console.log(`${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${c.gray}Pregunta lo que necesites…  "informe en Google Docs sobre …"${c.reset}${c.bgInput}${" ".repeat(8)}${c.reset}`);
  console.log(
    `${c.bgInput}${c.blue}┃${c.reset}${c.bgInput} ${c.blue}Build${c.reset}${c.bgInput}${c.gray} · ${model} · orquesta${c.reset}${c.bgInput}  ${c.orange}max${c.reset}${c.bgInput}${" ".repeat(20)}${c.reset}`
  );
  console.log("");
  console.log(`${c.muted}  tab ayuda   ctrl+c salir${c.reset}`);
  console.log("");
  console.log(
    `${c.orange}● Tip${c.reset} ${c.gray}Si pides Google Docs / Documents, Orquesta usa MCP y te deja el enlace.${c.reset}`
  );
  console.log("");
  const mcpLabel =
    mcpCount > 0
      ? `${c.green}○${c.reset} ${mcpCount} MCP`
      : `${c.muted}○ 0 MCP${c.reset}`;
  console.log(`  ${c.muted}~${c.reset} ${mcpLabel} ${c.muted}/estado${c.reset}`);
  console.log(`${"".padEnd(40)}${c.muted}${version}${c.reset}`);
  console.log("");
}

/** Respuesta limpia (sin cajas que se rompen al copiar). */
export function printAssistant(text: string): void {
  console.log("");
  console.log(`${c.blue}┃${c.reset} ${c.white}orquesta${c.reset}`);
  for (const line of text.split("\n")) {
    console.log(`${c.blue}┃${c.reset} ${c.white}${line}${c.reset}`);
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
    .filter((l) => l.length > 0 && !/^Pensand/i.test(l));
  // Una sola intención: primera línea “real”; si pegó mucho, unir cortas
  if (!cleaned.length) return raw.trim();
  if (cleaned.length === 1) return cleaned[0];
  // Si parece pegado de UI, tomar la primera línea sustancial
  const first = cleaned.find((l) => l.length > 2) || cleaned[0];
  return first;
}
