import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { configDir } from "../config.js";

const DEFAULT_REPO = "https://github.com/0PValencia/orquesta.git";
const DEFAULT_BRANCH = "master";

function run(cmd: string, args: string[], opts?: { cwd?: string }): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function runQuiet(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function runShell(script: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", script], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function installShUrl(repo: string, branch: string): string | null {
  const m = repo.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/i);
  if (!m) return null;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${branch}/install.sh`;
}

/**
 * Actualiza ~/.orquesta/src igualando al remoto (force: tolera cambios locales).
 */
export async function updateCommand(opts?: { remoteInstall?: boolean }): Promise<void> {
  const repo = (process.env.ORQUESTA_REPO || DEFAULT_REPO).trim();
  const branch = (process.env.ORQUESTA_BRANCH || DEFAULT_BRANCH).trim();
  const root = configDir();
  const srcDir = path.join(root, "src");
  const binDir = path.join(root, "bin");
  const cliDir = path.join(srcDir, "packages", "orquesta-cli");

  console.log("Actualizando Orquesta…\n");

  if (opts?.remoteInstall) {
    const raw = installShUrl(repo, branch);
    if (!raw) {
      console.error("ORQUESTA_REPO no es de GitHub; no puedo usar --reinstall.");
      process.exitCode = 1;
      return;
    }
    console.log(`Instalador remoto: ${raw}`);
    const code = await runShell(`curl -fsSL '${raw}' | bash -s -- --no-modify-path`);
    process.exitCode = code;
    if (code === 0) {
      console.log("\n✓ Orquesta actualizado");
      console.log("  Prueba: orquesta --version && orquesta estado\n");
    }
    return;
  }

  if (!fs.existsSync(path.join(srcDir, ".git"))) {
    console.log(`No hay instalación en ${srcDir}. Instalando…\n`);
    const raw =
      installShUrl(repo, branch) ||
      "https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh";
    process.exitCode = await runShell(`curl -fsSL '${raw}' | bash -s -- --no-modify-path`);
    return;
  }

  console.log(`Código: ${srcDir}`);
  // Instalación = copia del remoto. Descartar cambios/locales sin preguntar.
  await runQuiet("git", ["-C", srcDir, "remote", "set-url", "origin", repo]);
  await runQuiet("git", ["-C", srcDir, "clean", "-fd"]);
  await runQuiet("git", ["-C", srcDir, "reset", "--hard", "HEAD"]);
  let code = await run("git", ["-C", srcDir, "fetch", "--depth", "1", "origin", branch]);
  if (code !== 0) {
    process.exitCode = code;
    return;
  }
  // reset duro al tip remoto (evita checkout conflictivo)
  code = await run("git", ["-C", srcDir, "reset", "--hard", `origin/${branch}`]);
  if (code !== 0) {
    process.exitCode = code;
    return;
  }
  await run("git", ["-C", srcDir, "clean", "-fd"]);
  await runQuiet("git", ["-C", srcDir, "checkout", "-B", branch]);

  if (!fs.existsSync(cliDir)) {
    console.error(`No encontré ${cliDir}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nnpm install + build…");
  code = await run("npm", ["install", "--silent"], { cwd: cliDir });
  if (code !== 0) {
    process.exitCode = code;
    return;
  }
  code = await run("npm", ["run", "build"], { cwd: cliDir });
  if (code !== 0) {
    process.exitCode = code;
    return;
  }

  fs.mkdirSync(binDir, { recursive: true });
  const wrapper = path.join(binDir, "orquesta");
  try {
    fs.unlinkSync(wrapper);
  } catch {
    /* ignore */
  }
  fs.writeFileSync(
    wrapper,
    `#!/usr/bin/env bash\nexec node "${cliDir}/bin/orquesta.js" "$@"\n`,
    { mode: 0o755 }
  );

  const head = await new Promise<string>((resolve) => {
    const child = spawn("git", ["-C", srcDir, "rev-parse", "--short", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.on("close", () => resolve(out.trim() || "?"));
  });

  console.log(`\n✓ Orquesta actualizado (${head})`);
  console.log(`  ${wrapper}`);
  console.log("  Prueba: orquesta --version && orquesta estado\n");
}
