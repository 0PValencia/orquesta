"""Sube training/outputs/adapter al Modal Volume `orquesta-models`.

Uso:
  modal run modal/upload_adapter.py
  modal run modal/upload_adapter.py --src /ruta/alternativa/adapter
"""

from __future__ import annotations

from pathlib import Path

import modal

APP_NAME = "orquesta-informes-upload"
VOLUME_NAME = "orquesta-models"

app = modal.App(APP_NAME)
models_vol = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = REPO_ROOT / "training" / "outputs" / "adapter"


@app.local_entrypoint()
def main(src: str = str(DEFAULT_SRC)):
    src_path = Path(src).expanduser().resolve()
    required = ["adapter_config.json"]
    weight_names = ["adapter_model.safetensors", "adapter_model.bin"]

    if not src_path.is_dir():
        raise SystemExit(f"No existe el directorio adapter: {src_path}")

    for r in required:
        if not (src_path / r).exists():
            raise SystemExit(f"Falta {r} en {src_path}")

    if not any((src_path / w).exists() for w in weight_names):
        raise SystemExit(
            f"Faltan pesos ({' o '.join(weight_names)}) en {src_path}. "
            "Re-descarga el zip completo desde Colab."
        )

    print(f"Uploading {src_path} → volume {VOLUME_NAME}:/adapter ...")
    with models_vol.batch_upload(force=True) as batch:
        batch.put_directory(str(src_path), "/adapter")
    print("OK. Siguiente: modal deploy modal/serve_informes.py")
