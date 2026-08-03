# Orquesta — Agent Skills

| Skill | Para qué |
|-------|----------|
| [`google-documents`](skills/google-documents/) | MCP Google Docs |
| [`informe-angelica`](skills/informe-angelica/) | Informes SI I / Angélica (UAGRM) |

## Instalar (un comando)

### Linux / macOS / WSL / Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/0PValencia/orquesta/master/install.ps1 | iex
```

Requisito en todos los SO: [Node.js LTS](https://nodejs.org/).

El instalador pregunta:

1. Global o solo este proyecto  
2. Qué skills  
3. En qué agentes (Cursor, OpenCode, Claude Code, …) — **multi-selección**

## Uso

Pedí la tarea en el agente o nombrá la skill. Informe **en** Docs → ambas skills.

Repo: [github.com/0PValencia/orquesta](https://github.com/0PValencia/orquesta)
