# Orquesta CLI

Agente de terminal: LLM en **Modal** + **MCP** (local/remoto).  
Tras instalarlo, el comando es solo:

```bash
orquesta
```

## Instalar como OpenCode (`curl | bash`)

OpenCode usa un script público. Orquesta igual: el archivo es [`install.sh`](../../install.sh) en la raíz del repo.

### 1. Sube el repo a GitHub

```bash
cd /home/ariel/Proyectos/pipeeline
git init   # si aún no es repo
git add .
git commit -m "orquesta cli + modal"
# crea el repo en github.com y:
git remote add origin https://github.com/TU_USER/TU_REPO.git
git push -u origin main
```

### 2. Cualquiera instala con una línea

```bash
curl -fsSL https://raw.githubusercontent.com/TU_USER/TU_REPO/main/install.sh \
  | bash -s -- --repo https://github.com/TU_USER/TU_REPO.git
```

Eso clona en `~/.orquesta/src`, compila el CLI y deja el binario en `~/.orquesta/bin/orquesta` (añade el PATH al shell).

Luego:

```bash
orquesta --help
orquesta
```

### 3. URL “bonita” (opcional, como opencode.ai/install)

Cuando tengas dominio (ej. `orquesta.dev`):

- Redirige `https://orquesta.dev/install` → el `raw.githubusercontent.com/.../install.sh`
- La gente usa: `curl -fsSL https://orquesta.dev/install | bash`

Sin dominio, la URL de GitHub raw es el equivalente funcional.

## Configurar Modal

```bash
export ORQUESTA_BASE_URL='https://pvalencia--orquesta-informes-serve.modal.run/v1'
export ORQUESTA_MODEL=informes
orquesta doctor
```

## MCP (como OpenCode)

```bash
orquesta mcp add
# → Nombre
# → Local o Remoto
# → Comando  (local)  o  URL (remoto)
# → env / headers opcionales

orquesta mcp list
orquesta mcp show google-docs
orquesta mcp remove google-docs
orquesta mcp path
```

No interactivo:

```bash
orquesta mcp add filesystem --command 'npx -y @modelcontextprotocol/server-filesystem /tmp'
orquesta mcp add remoto --url 'https://example.com/mcp' --header 'Authorization=Bearer xxx'
```

Config en `~/.orquesta/mcp.json`.

## Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `orquesta` | Abre el chat del agente |
| `orquesta chat -m "..."` | Un mensaje y sale |
| `orquesta mcp add` | Añadir MCP (interactivo) |
| `orquesta mcp list` | Listar MCPs |
| `orquesta mcp remove` | Quitar MCP |
| `orquesta config` | Ver env / rutas |
| `orquesta doctor` | Diagnóstico rápido |
| `orquesta --help` | Ayuda |

## Variables

| Variable | Descripción |
|----------|-------------|
| `ORQUESTA_BASE_URL` | `https://…modal.run/v1` (no la URL del dashboard) |
| `ORQUESTA_API_KEY` | Bearer opcional |
| `ORQUESTA_MODEL` | default `informes` |
| `ORQUESTA_HOME` | default `~/.orquesta` |
