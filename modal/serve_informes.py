"""Sirve Qwen2.5-7B-Instruct + LoRA informes en Modal (API OpenAI-compatible).

Prerrequisitos:
  1. pip install modal && modal setup
  2. Subir adapter:  modal run modal/upload_adapter.py
  3. Deploy:         modal deploy modal/serve_informes.py
  4. (Opcional) Secret orquesta-api-key con clave ORQUESTA_API_KEY

Cliente:
  export ORQUESTA_BASE_URL=https://<workspace>--orquesta-informes-serve.modal.run/v1
  export ORQUESTA_API_KEY=...
  # model id: informes
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import modal

APP_NAME = "orquesta-informes"
BASE_MODEL = "Qwen/Qwen2.5-7B-Instruct"
LORA_NAME = "informes"
VLLM_PORT = 8000
MINUTES = 60

# Rutas dentro del contenedor
ADAPTER_MOUNT = "/models/adapter"
HF_CACHE = "/root/.cache/huggingface"
VLLM_CACHE = "/root/.cache/vllm"

hf_cache_vol = modal.Volume.from_name("orquesta-hf-cache", create_if_missing=True)
vllm_cache_vol = modal.Volume.from_name("orquesta-vllm-cache", create_if_missing=True)
models_vol = modal.Volume.from_name("orquesta-models", create_if_missing=True)

vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.11")
    .entrypoint([])
    .pip_install(
        "vllm==0.8.5",
        "huggingface_hub[hf_transfer]==0.30.2",
        "hf_transfer",
    )
    .env(
        {
            "HF_HUB_ENABLE_HF_TRANSFER": "1",
            "VLLM_WORKER_MULTIPROC_METHOD": "spawn",
        }
    )
)

app = modal.App(APP_NAME)


def _adapter_ready() -> bool:
    cfg = Path(ADAPTER_MOUNT) / "adapter_config.json"
    weights = Path(ADAPTER_MOUNT) / "adapter_model.safetensors"
    alt = Path(ADAPTER_MOUNT) / "adapter_model.bin"
    return cfg.exists() and (weights.exists() or alt.exists())


@app.function(
    image=vllm_image,
    gpu="A10G",
    timeout=60 * MINUTES,
    scaledown_window=10 * MINUTES,
    volumes={
        HF_CACHE: hf_cache_vol,
        VLLM_CACHE: vllm_cache_vol,
        "/models": models_vol,
    },
    # Opcional: modal secret create orquesta-api-key ORQUESTA_API_KEY=...
    # y añade: secrets=[modal.Secret.from_name("orquesta-api-key")],
)
@modal.concurrent(max_inputs=8)
@modal.web_server(port=VLLM_PORT, startup_timeout=15 * MINUTES)
def serve():
    """Arranca vLLM OpenAI-compatible con LoRA `informes`."""
    if not _adapter_ready():
        raise RuntimeError(
            f"Adapter incompleto en {ADAPTER_MOUNT}. "
            "Ejecuta primero: modal run modal/upload_adapter.py"
        )

    cmd = [
        "python",
        "-m",
        "vllm.entrypoints.openai.api_server",
        "--model",
        BASE_MODEL,
        "--served-model-name",
        LORA_NAME,
        BASE_MODEL,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--enable-lora",
        "--lora-modules",
        f"{LORA_NAME}={ADAPTER_MOUNT}",
        "--max-model-len",
        "4096",
        "--dtype",
        "auto",
        "--gpu-memory-utilization",
        "0.90",
        "--enforce-eager",
    ]

    # API key opcional (Modal Secret `orquesta-api-key` → ORQUESTA_API_KEY)
    api_key = os.environ.get("ORQUESTA_API_KEY")
    if api_key:
        os.environ["VLLM_API_KEY"] = api_key

    print("Starting vLLM:", " ".join(cmd))
    subprocess.Popen(cmd)


@app.local_entrypoint()
def main():
    print(
        f"""
App: {APP_NAME}
Base: {BASE_MODEL}
LoRA name (OpenAI model id): {LORA_NAME}

1) Sube pesos:   modal run modal/upload_adapter.py
2) Deploy:       modal deploy modal/serve_informes.py
3) CLI:          export ORQUESTA_BASE_URL=https://<...>.modal.run/v1
                 orquesta chat
"""
    )
