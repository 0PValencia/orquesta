#!/usr/bin/env node
/**
 * Instalador interactivo Orquesta skills (Windows / macOS / Linux).
 * Menús: ↑/↓ · Enter · Espacio (multi-selección en agentes).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = process.env.ORQUESTA_SKILLS_REPO || "0PValencia/orquesta";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GREEN = "\x1b[38;2;57;255;20m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CLEAR_LINE = "\x1b[2K";
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";

const AGENTS = [
  { id: "cursor", label: "Cursor" },
  { id: "claude-code", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
  { id: "windsurf", label: "Windsurf" },
  { id: "antigravity", label: "Gemini Antigravity" },
  { id: "amp", label: "Amp / Universal" },
];

const SKILL_CHOICES = [
  { id: "google-documents", label: "google-documents — MCP Google Docs" },
  { id: "informe-angelica", label: "informe-angelica — Informes SI I / Angélica" },
  { id: "__both__", label: "Ambas" },
];

function banner() {
  console.log(`${GREEN}${BOLD}`);
  console.log(`   ___                            _`);
  console.log(`  / _ \\ _ __ __ _ _   _  ___  ___| |_ __ _`);
  console.log(` | | | | '__/ _\` | | | |/ _ \\/ __| __/ _\` |`);
  console.log(` | |_| | | | (_| | |_| |  __/\\__ \\ || (_| |`);
  console.log(`  \\___/|_|  \\__, |\\__,_|\\___||___/\\__\\__,_|`);
  console.log(`               |_|   skills`);
  console.log(`${RESET}${DIM}${REPO}${RESET}\n`);
}

function parseArgs(argv) {
  const out = { scope: null, skills: [], agents: [], yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-g" || a === "--global") out.scope = "global";
    else if (a === "--project") out.scope = "project";
    else if (a === "-y" || a === "--yes") out.yes = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if ((a === "-s" || a === "--skill") && argv[i + 1]) out.skills.push(argv[++i]);
    else if ((a === "-a" || a === "--agent") && argv[i + 1]) out.agents.push(argv[++i]);
  }
  return out;
}

function usage() {
  console.log(`Instalar (sin clonar):

  # Linux / macOS / WSL / Git Bash
  curl -fsSL https://raw.githubusercontent.com/${REPO}/master/install.sh | bash

  # Windows PowerShell
  irm https://raw.githubusercontent.com/${REPO}/master/install.ps1 | iex

Flags: -g | --project | -s NAME | -a AGENT | -y
`);
}

/** ↑/↓ · Enter. multi: Espacio marca, a = todas, Enter confirma (1+). */
function selectMenu(title, items, { multi = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Se necesita una terminal interactiva (TTY)."));
      return;
    }

    let index = 0;
    const selected = new Set();
    let lineCount = 0;
    const wasRaw = process.stdin.isRaw;

    const buildLines = () => {
      const lines = [`${BOLD}${title}${RESET}`];
      if (multi) {
        lines.push(
          `${DIM}  ↑/↓ mover · espacio marcar · a todas · enter confirmar${RESET}`
        );
      } else {
        lines.push(`${DIM}  ↑/↓ mover · enter elegir${RESET}`);
      }
      items.forEach((it, i) => {
        const cursor = i === index ? `${GREEN}❯${RESET}` : " ";
        if (multi) {
          const mark = selected.has(i) ? `${GREEN}●${RESET}` : `${DIM}○${RESET}`;
          lines.push(`  ${cursor} ${mark} ${it.label}`);
        } else {
          const label = i === index ? `${GREEN}${it.label}${RESET}` : it.label;
          lines.push(`  ${cursor} ${label}`);
        }
      });
      return lines;
    };

    const render = (first = false) => {
      const lines = buildLines();
      if (!first && lineCount > 0) process.stdout.write(`\x1b[${lineCount}A`);
      for (const line of lines) process.stdout.write(`${CLEAR_LINE}${line}\n`);
      lineCount = lines.length;
    };

    const cleanup = () => {
      process.stdin.off("data", onData);
      try {
        process.stdin.setRawMode(Boolean(wasRaw));
      } catch {
        /* ignore */
      }
      process.stdout.write(SHOW);
    };

    const finish = (value) => {
      cleanup();
      process.stdout.write("\n");
      resolve(value);
    };

    const onData = (buf) => {
      const s = String(buf);
      if (s === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        reject(new Error("SIGINT"));
        return;
      }
      if (s === "\r" || s === "\n") {
        if (multi) {
          if (selected.size === 0) selected.add(index);
          finish([...selected].sort((a, b) => a - b).map((i) => items[i]));
        } else {
          finish(items[index]);
        }
        return;
      }
      if (multi && s === " ") {
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);
        render();
        return;
      }
      if (multi && (s === "a" || s === "A")) {
        if (selected.size === items.length) selected.clear();
        else items.forEach((_, i) => selected.add(i));
        render();
        return;
      }
      if (s === "\x1b[A" || s === "\x1bOA") {
        index = (index - 1 + items.length) % items.length;
        render();
        return;
      }
      if (s === "\x1b[B" || s === "\x1bOB") {
        index = (index + 1) % items.length;
        render();
        return;
      }
      // Ignorar teclas sueltas (t, j, 7, …)
    };

    try {
      process.stdin.setRawMode(true);
    } catch (e) {
      reject(e);
      return;
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", onData);
    process.stdout.write(HIDE);
    render(true);
  });
}

function resolveSkillIds(choice) {
  if (choice.id === "__both__") return ["google-documents", "informe-angelica"];
  return [choice.id];
}

function repoRootWithSkills() {
  if (fs.existsSync(path.join(__dirname, "skills", "google-documents", "SKILL.md"))) {
    return __dirname;
  }
  return null;
}

function runNpxSkills({ scope, skills, agents }) {
  const local = repoRootWithSkills();
  const src = local || REPO;
  const args = ["--yes", "skills", "add", src];
  if (scope === "global") args.push("-g");
  for (const s of skills) args.push("-s", s);
  for (const a of agents) args.push("-a", a);
  args.push("-y", "--copy");

  console.log(`\n${GREEN}→ npx ${args.join(" ")}${RESET}\n`);
  const r = spawnSync("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

function agentDest(agentId, scope) {
  const home = os.homedir();
  const cwd = process.cwd();
  const map = {
    cursor: {
      global: path.join(home, ".cursor", "skills"),
      project: path.join(cwd, ".cursor", "skills"),
    },
    "claude-code": {
      global: path.join(home, ".claude", "skills"),
      project: path.join(cwd, ".claude", "skills"),
    },
    opencode: {
      global: path.join(home, ".config", "opencode", "skills"),
      project: path.join(cwd, ".agents", "skills"),
    },
    codex: {
      global: path.join(home, ".codex", "skills"),
      project: path.join(cwd, ".codex", "skills"),
    },
    windsurf: {
      global: path.join(home, ".codeium", "windsurf", "skills"),
      project: path.join(cwd, ".windsurf", "skills"),
    },
    antigravity: {
      global: path.join(home, ".gemini", "antigravity", "skills"),
      project: path.join(cwd, ".agent", "skills"),
    },
    amp: {
      global: path.join(home, ".config", "agents", "skills"),
      project: path.join(cwd, ".agents", "skills"),
    },
  };
  const entry = map[agentId];
  return entry ? (scope === "global" ? entry.global : entry.project) : null;
}

function ensureSkillsRoot() {
  const local = repoRootWithSkills();
  if (local) return { root: path.join(local, "skills"), tmp: null };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orquesta-skills-"));
  const clone = spawnSync(
    "git",
    ["clone", "--depth", "1", `https://github.com/${REPO}.git`, tmp],
    { stdio: "inherit", shell: process.platform === "win32" }
  );
  if (clone.status !== 0) {
    throw new Error("No se pudo clonar el repo. Instalá git y revisá la red.");
  }
  return { root: path.join(tmp, "skills"), tmp };
}

function copySkillsManual(scope, skills, agents) {
  const { root, tmp } = ensureSkillsRoot();
  try {
    for (const agent of agents) {
      const destRoot = agentDest(agent, scope);
      if (!destRoot) continue;
      fs.mkdirSync(destRoot, { recursive: true });
      for (const s of skills) {
        const from = path.join(root, s);
        const to = path.join(destRoot, s);
        if (!fs.existsSync(from)) {
          console.error(`Falta skill: ${from}`);
          continue;
        }
        fs.rmSync(to, { recursive: true, force: true });
        fs.cpSync(from, to, { recursive: true });
        console.log(`  ✓ ${s} → ${to}`);
      }
    }
    if (agents.includes("cursor") && scope === "global") {
      const agentsDir = path.join(os.homedir(), ".agents", "skills");
      const cursorDir = path.join(os.homedir(), ".cursor", "skills");
      fs.mkdirSync(cursorDir, { recursive: true });
      for (const s of skills) {
        const from = fs.existsSync(path.join(agentsDir, s))
          ? path.join(agentsDir, s)
          : path.join(root, s);
        if (!fs.existsSync(from)) continue;
        const to = path.join(cursorDir, s);
        fs.rmSync(to, { recursive: true, force: true });
        fs.cpSync(from, to, { recursive: true });
      }
    }
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function mirrorCursorFromAgents(skills) {
  const agentsDir = path.join(os.homedir(), ".agents", "skills");
  const cursorDir = path.join(os.homedir(), ".cursor", "skills");
  fs.mkdirSync(cursorDir, { recursive: true });
  for (const s of skills) {
    const from = path.join(agentsDir, s);
    if (!fs.existsSync(from)) continue;
    const to = path.join(cursorDir, s);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  banner();

  let scope = args.scope;
  let skills = [...args.skills];
  let agents = [...args.agents];

  if (!args.yes) {
    if (!process.stdin.isTTY) {
      console.error("Terminal no interactiva. Usá: … | bash -s -- -g -a cursor -y");
      process.exit(1);
    }

    const scopePick = await selectMenu("1) ¿Dónde instalar?", [
      { id: "global", label: "Global  (recomendado — todos tus proyectos)" },
      { id: "project", label: "Solo este proyecto" },
    ]);
    scope = scopePick.id;

    const skillPick = await selectMenu("2) ¿Qué skills?", SKILL_CHOICES);
    skills = resolveSkillIds(skillPick);

    const agentPicks = await selectMenu("3) ¿En qué entornos / agentes? (podés marcar varios)", AGENTS, {
      multi: true,
    });
    agents = agentPicks.map((x) => x.id);
  } else {
    scope = scope || "global";
    if (!skills.length) skills = ["google-documents", "informe-angelica"];
    if (!agents.length) agents = ["cursor"];
  }

  console.log(`\n${BOLD}Resumen${RESET}`);
  console.log(`  Alcance: ${scope}`);
  console.log(`  Skills:  ${skills.join(", ")}`);
  console.log(`  Agentes: ${agents.join(", ")}`);
  console.log();

  if (!args.yes) {
    const ok = await selectMenu("¿Instalar ahora?", [
      { id: "yes", label: "Sí, instalar" },
      { id: "no", label: "Cancelar" },
    ]);
    if (ok.id !== "yes") {
      console.log("Cancelado.");
      return;
    }
  }

  let ok = false;
  try {
    ok = runNpxSkills({ scope, skills, agents });
  } catch (e) {
    console.error(e);
  }

  if (ok) {
    if (agents.includes("cursor")) mirrorCursorFromAgents(skills);
    console.log(`\n${GREEN}${BOLD}✓ Skills instaladas${RESET}`);
    console.log(`${DIM}Reiniciá el agente para que las tome.${RESET}`);
    return;
  }

  console.log(`${DIM}npx skills falló → copia manual…${RESET}`);
  copySkillsManual(scope, skills, agents);
  console.log(`\n${GREEN}${BOLD}✓ Listo${RESET}`);
}

main().catch((err) => {
  if (String(err.message || err).includes("SIGINT")) {
    console.log("Cancelado.");
    process.exit(130);
  }
  console.error(err);
  process.exit(1);
});
