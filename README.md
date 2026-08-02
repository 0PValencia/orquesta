# Pipeeline / Orquesta

Dataset + fine-tune de informes SI I, inferencia en **Modal**, agente CLI **orquesta** con MCP.

Repo: [github.com/0PValencia/orquesta](https://github.com/0PValencia/orquesta)

## Instalar el CLI (como OpenCode)

```bash
curl -fsSL https://raw.githubusercontent.com/0PValencia/orquesta/master/install.sh | bash
```


## Piezas

| Ruta | Rol |
|------|-----|
| [`dataset/`](dataset/) | Proyectos, temas, razonamiento, MCP Docs |
| [`training/`](training/) | Colab SFT, splits, adapter fase 1 |
| [`modal/`](modal/) | vLLM + LoRA en Modal |
| [`packages/orquesta-cli/`](packages/orquesta-cli/) | CLI agente `orquesta` |
