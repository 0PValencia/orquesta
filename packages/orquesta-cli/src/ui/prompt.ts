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

export async function choose(
  question: string,
  options: { label: string; value: string; hint?: string }[]
): Promise<string> {
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

export async function confirm(question: string, initial = false): Promise<boolean> {
  const d = initial ? "S/n" : "s/N";
  const ans = (await ask(`${question} (${d})`)).toLowerCase();
  if (!ans) return initial;
  return ans === "s" || ans === "y" || ans === "si" || ans === "sí" || ans === "yes";
}
