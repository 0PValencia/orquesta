# Modal — Orquesta informes

Sirve el LoRA fase 1 (informes) sobre `Qwen/Qwen2.5-7B-Instruct` con API OpenAI-compatible.

## Requisitos

```bash
pip install modal
modal setup   # login una vez
```

Adapter local esperado: [`../training/outputs/adapter/`](../training/outputs/adapter/)  
(debe incluir `adapter_model.safetensors`).

## Pasos

```bash
# 1) Subir LoRA al Volume orquesta-models
modal run modal/upload_adapter.py

# 2) Desplegar servidor vLLM
modal deploy modal/serve_informes.py
```

La URL será similar a:

```text
https://<workspace>--orquesta-informes-serve.modal.run
```

Base URL para el CLI:

```bash
export ORQUESTA_BASE_URL=https://<workspace>--orquesta-informes-serve.modal.run/v1
export ORQUESTA_API_KEY=  # opcional si configuras Secret
export ORQUESTA_MODEL=informes
```

## Probar con curl

```bash
curl "$ORQUESTA_BASE_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ORQUESTA_API_KEY" \
  -d '{
    "model": "informes",
    "messages": [
      {"role": "user", "content": "Redacta un objetivo general para un SI de biblioteca."}
    ],
    "max_tokens": 400
  }'
```

## GPU / coste

Default: `A10G`, scale-to-zero tras ~10 min sin tráfico. Ajusta en `serve_informes.py` si usas L4/A100.
