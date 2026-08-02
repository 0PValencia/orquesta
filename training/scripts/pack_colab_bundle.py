#!/usr/bin/env python3
"""Regenera training/colab_bundle.zip para subir a Colab."""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "colab_bundle.zip"

FILES = [
    "system_prompt.txt",
    "data/train_messages.jsonl",
    "data/val_messages.jsonl",
    "data/test_messages.jsonl",
    "data/manifest.json",
    "scripts/train_unsloth.py",
    "scripts/eval_checklist.py",
    "scripts/prepare_dataset.py",
    "configs/sft_lora.yaml",
    "colab_sft.ipynb",
]


def main() -> None:
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in FILES:
            path = ROOT / rel
            if not path.exists():
                print("skip missing", rel)
                continue
            z.write(path, f"training/{rel}")
    print(f"OK {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
