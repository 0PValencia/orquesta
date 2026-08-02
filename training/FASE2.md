# Fase 2 — LoRA agente (razonamiento + MCP)

La fase 1 (en Modal, model id `informes`) entrenó:

- `dataset/proyectos/dataset_proyectos.jsonl`
- `dataset/temas/dataset_temas.jsonl`

## Objetivo

Enseñar planificación / verificación y orquestación MCP (`<tool_call>`) con:

- [`dataset/razonamiento/dataset_razonamiento.jsonl`](../dataset/razonamiento/dataset_razonamiento.jsonl) (12 ejemplos)
- [`dataset/mcp_google_docs/dataset_mcp_google_docs.jsonl`](../dataset/mcp_google_docs/dataset_mcp_google_docs.jsonl) (15 ejemplos)

Los ejemplos MCP se convierten a **multi-turno** (assistant `tool_call` → user resultado sintético → …) alineado con el CLI Orquesta.

## Preparar datos (local)

```bash
cd training
python scripts/prepare_dataset.py --phase 2
python scripts/pack_colab_bundle.py --phase 2
```

Salida:

- `data/fase2/{train,val,test}_messages.jsonl`
- `colab_bundle_fase2.zip`
- Notebook: [`colab_sft_fase2.ipynb`](colab_sft_fase2.ipynb)

## Entrenar en Colab (opción A — continuar LoRA)

1. Runtime → **GPU T4**.
2. Abre `colab_sft_fase2.ipynb`.
3. Sube `colab_bundle_fase2.zip`.
4. Sube el adapter fase 1 (`qwen25-7b-informes-adapter.zip` o carpeta con `adapter_model.safetensors`).
5. Entrena (LR `1e-4`, 2 epochs, seq 2048).
6. Descarga `qwen25-7b-orquesta-fase2-adapter.zip`.

## Subir a Modal

```bash
# Descomprimir el zip en:
mkdir -p training/outputs/adapter-fase2
unzip ~/Descargas/qwen25-7b-orquesta-fase2-adapter.zip -d training/outputs/adapter-fase2

modal run modal/upload_adapter.py --src training/outputs/adapter-fase2
modal deploy modal/serve_informes.py
```

El serve actual carga un solo LoRA (`informes`). Tras subir, el mismo model id sigue siendo `informes` pero con pesos fase 2.

## Opción B (segundo adapter)

Si preferís no tocar el redactor puro: serví un segundo `--lora-modules orquesta-agent=...` y en CLI `ORQUESTA_MODEL=orquesta-agent`. Requiere cambiar `modal/serve_informes.py`.

## Separación de responsabilidades

| Componente | Rol |
|------------|-----|
| LoRA (fase 1+2) | Redacción + plan/tools |
| CLI Orquesta | Bucle tools, choices, install |
| MCP Google Docs | Formato visual real |

## Notas

- Corpus fase 2 pequeño (~27 ejemplos): riesgo de overfitting; 2 epochs + LR bajo.
- Si OOM en Colab: `max_seq_length=1536` o `1024`.
- Fase 1 sigue disponible en `data/` y `colab_bundle.zip` (`--phase 1`).
