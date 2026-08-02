# Fase 2 — LoRA agente (razonamiento + MCP)

La fase 1 (actual en Modal, model id `informes`) entrenó solo:

- `dataset/proyectos/dataset_proyectos.jsonl`
- `dataset/temas/dataset_temas.jsonl`

## Objetivo fase 2

Enseñar a Orquesta a **planificar / verificar** y a **orquestar tools MCP** usando:

- [`dataset/razonamiento/dataset_razonamiento.jsonl`](../dataset/razonamiento/dataset_razonamiento.jsonl)
- [`dataset/mcp_google_docs/dataset_mcp_google_docs.jsonl`](../dataset/mcp_google_docs/dataset_mcp_google_docs.jsonl)

El CLI ya soporta el protocolo `<tool_call>` + MCP; el LoRA fase 2 debe mejorar la adherencia a ese protocolo y a las reglas de Google Docs.

## Pasos previstos

1. Extender [`training/scripts/prepare_dataset.py`](../training/scripts/prepare_dataset.py) para incluir esos JSONL (convertir `output` dict → texto/messages estructurado).
2. Re-entrenar en Colab (mismo notebook o uno `colab_sft_fase2.ipynb`) como:
   - **Opción A:** continuar LoRA sobre `informes` (mismo adapter).
   - **Opción B:** segundo adapter `orquesta-agent` y servir ambos en vLLM (`--lora-modules`).
3. Subir pesos: `modal run modal/upload_adapter.py --src training/outputs/adapter-fase2`
4. Redeploy Modal; en CLI:

```bash
export ORQUESTA_MODEL=orquesta-agent   # o el nombre del lora-module
```

## Separación de responsabilidades (no cambia)

| Componente | Aprende / hace |
|------------|----------------|
| LoRA informes | Estructura y tono de secciones |
| LoRA agente (fase 2) | thinking/plan + secuencias MCP |
| CLI Orquesta | Bucle tools, config, install |
| MCP Google Docs | Formato visual real del documento |

## Mientras tanto (fase 1)

Orquesta ya funciona con el system prompt + tools MCP + modelo `informes` en Modal. La calidad de tool-calling mejorará con fase 2.
