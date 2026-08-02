# Fine-tuning — Informes SI I

Pipeline listo para SFT (Supervised Fine-Tuning) sobre el dataset de proyectos + temas.
**Modelo elegido para Colab:** `Qwen2.5-7B-Instruct` (QLoRA).

## Google Colab (recomendado)

1. Abre [`colab_sft.ipynb`](colab_sft.ipynb) en Colab (o súbelo a drive.google.com → Colaboratory).
2. Runtime → **GPU T4** (o mejor).
3. Genera/usa el zip de datos:

```bash
cd training
python scripts/prepare_dataset.py      # si cambiaste el dataset
python scripts/pack_colab_bundle.py    # crea colab_bundle.zip
```

4. En el notebook: sube `colab_bundle.zip` (Opción A) o colócalo en Drive `MyDrive/pipeeline/colab_bundle.zip` (Opción B).
5. Ejecuta las celdas → descarga `qwen25-7b-informes-adapter.zip`.

Settings T4: `max_seq_length=2048`, batch 1, grad_accum 16, 4-bit.

## Qué incluye

```
training/
├── colab_sft.ipynb            # Notebook listo para Colab (7B)
├── colab_bundle.zip           # Datos + scripts para subir
├── system_prompt.txt
├── requirements.txt
├── configs/sft_lora.yaml
├── scripts/
│   ├── prepare_dataset.py
│   ├── pack_colab_bundle.py
│   ├── train_unsloth.py
│   └── eval_checklist.py
└── data/
    ├── train_messages.jsonl
    ├── val_messages.jsonl
    ├── test_messages.jsonl
    └── manifest.json
```

## Fase 1 (ahora)

Entrena solo con:
- `dataset/proyectos/dataset_proyectos.jsonl`
- `dataset/temas/dataset_temas.jsonl`

**Excluido a propósito** (usar después):
- `razonamiento` — pipeline de agente, no redacción de informes
- `mcp_google_docs` — orquestación de tools; va al agente, no al redactor

## Preparar datos (local)

```bash
cd training
python scripts/prepare_dataset.py
python scripts/pack_colab_bundle.py
```

Formatos:
- `*_messages.jsonl` → chat (`system` / `user` / `assistant`) — **usar este**
- `*.jsonl` → Alpaca (`system` / `instruction` / `input` / `output`)

## Entrenar en local (opcional)

```bash
python scripts/train_unsloth.py \
  --model unsloth/Qwen2.5-7B-Instruct \
  --max-seq-length 2048 \
  --batch-size 1 \
  --grad-accum 16
```

Adapter en `outputs/lora/adapter`.

## Evaluar

```bash
python scripts/eval_checklist.py
python scripts/eval_checklist.py --preds outputs/preds_test.jsonl
```

## Modelo fijado para este flujo

| Uso | Modelo | Notas |
|-----|--------|-------|
| **Colab / default** | `unsloth/Qwen2.5-7B-Instruct` | QLoRA 4-bit; en T4 usa seq 2048 |
| Fallback si OOM | `unsloth/Qwen2.5-3B-Instruct` | Cambiar `CFG["model"]` en el notebook |

### Hiperparámetros (dataset chico + T4)

- Epochs: **3**
- LR: **2e-4**
- LoRA r=16, alpha=32
- max_seq_length: **2048** en Colab T4
- packing: **off**

### Qué debe aprender el fine-tune vs MCP

| Fine-tune | MCP Google Docs |
|-----------|-----------------|
| Orden y secciones del informe | Fuentes, márgenes, estilos |
| Tono académico / tercera persona | TOC automático |
| Plantillas CU, SQL, conclusiones | Imágenes / Mermaid render |
| Terminología SI I / UML / PUDS | Encabezados/pies, exportación PDF |

## Limitación actual

El corpus fase 1 es **pequeño**. El pipeline está listo, pero la calidad real mejorará cuando amplíes con ejemplos sintéticos.

## Siguientes fases (después)

1. Ampliar dataset sintético de secciones faltantes
2. Re-entrenar / continuar LoRA
3. Añadir dataset MCP solo al **agente orquestador**, no al redactor
