import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function ask(question: string, opts?: { default?: string }): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const hint = opts?.default ? ` [${opts.default}]` : "";
  try {
    const ans = (await rl.question(`${question}${hint}: `)).trim();
    if (!ans && opts?.default !== undefined) return opts.default;
    return ans;
  } finally {
    rl.close();
  }
}

export type ChooseOption = { label: string; value: string; hint?: string };

/**
 * Selector con ↑/↓ + Enter (TTY). Si no hay TTY, cae a números.
 */
export async function choose(question: string, options: ChooseOption[]): Promise<string> {
  if (!options.length) throw new Error("choose: sin opciones");
  if (!input.isTTY || !output.isTTY) {
    return chooseByNumber(question, options);
  }
  return chooseByArrows(question, options);
}

async function chooseByNumber(question: string, options: ChooseOption[]): Promise<string> {
  console.log(`\n${question}`);
  options.forEach((o, i) => {
    const hint = o.hint ? `  (${o.hint})` : "";
    console.log(`  ${i + 1}) ${o.label}${hint}`);
  });
  while (true) {
    const ans = await ask("Elige número");
    const n = Number(ans);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      return options[n - 1].value;
    }
    console.log("Opción inválida.");
  }
}

async function chooseByArrows(question: string, options: ChooseOption[]): Promise<string> {
  let index = 0;

  const render = (first = false) => {
    if (!first) {
      // subir al inicio del menú y reescribir
      output.write(`\x1b[${options.length}A`);
    }
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      const selected = i === index;
      const mark = selected ? "❯" : " ";
      const label = selected ? `\x1b[36m${o.label}\x1b[0m` : o.label;
      const hint = o.hint ? `\x1b[2m  ${o.hint}\x1b[0m` : "";
      const line = `  ${mark} ${label}${hint}`;
      output.write(`\x1b[2K${line}\n`);
    }
  };

  output.write(`\n${question}\n`);
  output.write("\x1b[2m  ↑/↓ para mover · Enter para elegir\x1b[0m\n");
  render(true);

  return new Promise((resolve, reject) => {
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    const cleanup = () => {
      input.off("data", onData);
      if (input.isTTY) input.setRawMode(wasRaw ?? false);
    };

    const onData = (key: string) => {
      // Ctrl+C
      if (key === "\u0003") {
        cleanup();
        output.write("\n");
        reject(new Error("SIGINT"));
        return;
      }
      // Enter
      if (key === "\r" || key === "\n") {
        cleanup();
        output.write("\n");
        resolve(options[index].value);
        return;
      }
      // Up: ESC [ A  or  ESC O A
      if (key === "\x1b[A" || key === "\x1bOA") {
        index = (index - 1 + options.length) % options.length;
        render();
        return;
      }
      // Down
      if (key === "\x1b[B" || key === "\x1bOB") {
        index = (index + 1) % options.length;
        render();
        return;
      }
      // j/k vim-style
      if (key === "k") {
        index = (index - 1 + options.length) % options.length;
        render();
        return;
      }
      if (key === "j") {
        index = (index + 1) % options.length;
        render();
      }
    };

    input.on("data", onData);
  });
}

export async function confirm(question: string, initial = false): Promise<boolean> {
  const d = initial ? "S/n" : "s/N";
  const ans = (await ask(`${question} (${d})`)).toLowerCase();
  if (!ans) return initial;
  return ans === "s" || ans === "y" || ans === "si" || ans === "sí" || ans === "yes";
}
