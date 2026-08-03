# Orquesta — Agent Skills

Skills para Cursor, OpenCode, Claude Code, Codex y más:

| Skill | Para qué |
|-------|----------|
| [`google-documents`](skills/google-documents/) | MCP Google Docs |
| [`informe-angelica`](skills/informe-angelica/) | Informes SI I / Angélica (UAGRM) |

## Instalacion

```bash
curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
```

El instalador te pregunta:

1. **Global** o solo este proyecto  
2. Qué skills  
3. En qué entornos (Cursor, OpenCode, Claude Code, …)

Requisito: [Node.js](https://nodejs.org/) (`npx`).

### Ecosistema skills.sh

```bash
npx skills add 0PValencia/orquesta
npx skills add 0PValencia/orquesta -g -a cursor -a opencode -y --copy
```

## Uso

Pedí la tarea en el agente (Docs / informe SI I) o nombrá la skill.
Para un informe **en** Google Docs: usá **ambas**.

## Repo

[github.com/0PValencia/orquesta](https://github.com/0PValencia/orquesta)
