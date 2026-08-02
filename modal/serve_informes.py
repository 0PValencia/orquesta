"""Sirve Qwen2.5-7B-Instruct + LoRA informes en Modal (API compatible estilo OpenAI).

Prerrequisitos:
  1. pip install modal && modal setup
  2. modal run modal/upload_adapter.py
  3. modal run modal/serve_informes.py   # descarga/cachea el base model una vez
  4. modal deploy modal/serve_informes.py

Cliente Orquesta usa model id: informes
URL: https://pvalencia--orquesta-informes-serve.modal.run/v1
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
        "huggingface_hub==0.30.2",
    )
    .env(
        {
            # hf_transfer fallaba en el download; usar HTTP normal
            "HF_HUB_ENABLE_HF_TRANSFER": "0",
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
    volumes={HF_CACHE: hf_cache_vol},
    timeout=45 * MINUTES,
)
def download_base_model():
    """Cachea Qwen2.5-7B-Instruct en el Volume HF (una vez)."""
    from huggingface_hub import snapshot_download

    print(f"Descargando {BASE_MODEL}…")
    path = snapshot_download(BASE_MODEL, local_files_only=False)
    hf_cache_vol.commit()
    print(f"OK cache en {path}")
    return path


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
)
@modal.concurrent(max_inputs=4)
@modal.web_server(port=VLLM_PORT, startup_timeout=20 * MINUTES)
def serve():
    """Arranca vLLM con LoRA `informes`."""
    if not _adapter_ready():
        raise RuntimeError(
            f"Adapter incompleto en {ADAPTER_MOUNT}. "
            "Ejecuta: modal run modal/upload_adapter.py"
        )

    # Asegurar pesos base en cache (si ya están, es rápido)
    from huggingface_hub import snapshot_download

    try:
        snapshot_download(BASE_MODEL, local_files_only=True)
        print("Base model ya en cache HF")
    except Exception:
        print("Base model no en cache; descargando…")
        snapshot_download(BASE_MODEL, local_files_only=False)
        hf_cache_vol.commit()

    cmd = [
        "python",
        "-m",
        "vllm.entrypoints.openai.api_server",
        "--model",
        BASE_MODEL,
        "--served-model-name",
        LORA_NAME,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--enable-lora",
        "--lora-modules",
        f"{LORA_NAME}={ADAPTER_MOUNT}",
        "--max-lora-rank",
        "64",
        "--max-model-len",
        "8192",
        "--dtype",
        "auto",
        "--gpu-memory-utilization",
        "0.90",
        "--enforce-eager",
    ]

    api_key = os.environ.get("ORQUESTA_API_KEY")
    if api_key:
        os.environ["VLLM_API_KEY"] = api_key

    print("Starting vLLM:", " ".join(cmd))
    subprocess.Popen(cmd)


@app.local_entrypoint()
def main(skip_download: bool = False):
    if not skip_download:
        print("Cacheando modelo base en Modal Volume…")
        download_base_model.remote()
    print(
        f"""
Listo para deploy:
  modal deploy modal/serve_informes.py

URL: https://pvalencia--orquesta-informes-serve.modal.run/v1
Model id: {LORA_NAME}
"""
    )
