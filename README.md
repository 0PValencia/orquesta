# Pipeeline / Orquesta — Agent Skills

Dos skills profesionales para agentes (Cursor, OpenCode, Claude Code, Codex, …):

| Skill | Para qué |
|-------|----------|
| [`google-documents`](skills/google-documents/) | MCP Google Docs: `documentId`, estructura, headings, bib, tablas, imágenes |
| [`informe-angelica`](skills/informe-angelica/) | Informes SI I / INF 342 (UAGRM), estructura y estilo Angélica |

Repo: [github.com/0PValencia/orquesta](https://github.com/0PValencia/orquesta)

## Instalar (interactivo)

Desde el clone:

```bash
chmod +x install.sh
./install.sh
```

Te pregunta:

1. **Global** o **proyecto**
2. Qué skills
3. En qué entornos (Cursor, OpenCode, Claude Code, Codex, …)

### Un solo comando (ecosistema skills.sh)

```bash
# Listar
npx skills add 0PValencia/orquesta --list

# Global → Cursor + OpenCode (ambas skills)
npx skills add 0PValencia/orquesta -g -a cursor -a opencode -y --copy

# Solo informe Angélica en Claude Code (proyecto)
npx skills add 0PValencia/orquesta -s informe-angelica -a claude-code -y --copy
```

Tras publicar en GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
```

Tras `npx skills`, Cursor suele recibir la skill en `~/.agents/skills/`
(y el CLI la enlaza al agente). Si tu Cursor solo mira `~/.cursor/skills/`,
el instalador en modo copia manual también escribe ahí.

## Uso

En el agente, invocá la skill por nombre o pedí la tarea (Docs / informe SI I).
Para un informe **en** Google Docs: usá **ambas** skills juntas.

## Estructura del repo

```text
skills/
  google-documents/
    SKILL.md
    references/
  informe-angelica/
    SKILL.md
    references/
install.sh
README.md
```

Compatible con el CLI [`npx skills`](https://skills.sh/) (Vercel / ecosistema abierto).
