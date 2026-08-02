# Pipeeline / Orquesta

Dataset + fine-tune de informes SI I, inferencia en **Modal**, agente CLI **orquesta** con MCP.

## Piezas

| Ruta | Rol |
|------|-----|
| [`dataset/`](dataset/) | Proyectos, temas, razonamiento, MCP Docs |
| [`training/`](training/) | Colab SFT, splits, adapter fase 1 |
| [`modal/`](modal/) | vLLM + LoRA en Modal |
| [`packages/orquesta-cli/`](packages/orquesta-cli/) | CLI instalable `orquesta` |

## Instalar el CLI (como OpenCode)

```bash
curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/main/install.sh \
  | bash -s -- --repo https://github.com/0PValencia/orquesta.git
```

Luego: `orquesta`. Detalle en [`packages/orquesta-cli/README.md`](packages/orquesta-cli/README.md).

## Flujo rápido (desarrollo local)

```bash
# 1) Adapter ya en training/outputs/adapter (desde Colab)
# 2) Modal
pip install modal && modal setup
modal run modal/upload_adapter.py
modal deploy modal/serve_informes.py

# 3) CLI
cd packages/orquesta-cli && npm i && npm run build && npm link
export ORQUESTA_BASE_URL='https://pvalencia--orquesta-informes-serve.modal.run/v1'
export ORQUESTA_MODEL=informes
orquesta doctor
orquesta mcp add          # nombre → local/remoto → comando o URL
orquesta                  # abre el agente
```