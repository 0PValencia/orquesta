#!/usr/bin/env python3
"""Regenera training/colab_bundle.zip o colab_bundle_fase2.zip."""
from __future__ import annotations

import argparse
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--phase", choices=("1", "2"), default="1")
    args = p.parse_args()

    if args.phase == "1":
        out = ROOT / "colab_bundle.zip"
        data_prefix = "data"
        notebook = "colab_sft.ipynb"
        extra = ["system_prompt.txt"]
    else:
        out = ROOT / "colab_bundle_fase2.zip"
        data_prefix = "data/fase2"
        notebook = "colab_sft_fase2.ipynb"
        extra = ["system_prompt.txt", "system_prompt_fase2.txt"]

    files = [
        *extra,
        f"{data_prefix}/train_messages.jsonl",
        f"{data_prefix}/val_messages.jsonl",
        f"{data_prefix}/test_messages.jsonl",
        f"{data_prefix}/manifest.json",
        "scripts/train_unsloth.py",
        "scripts/eval_checklist.py",
        "scripts/prepare_dataset.py",
        "configs/sft_lora.yaml",
        notebook,
    ]

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in files:
            path = ROOT / rel
            if not path.exists():
                print("skip missing", rel)
                continue
            # En el zip, data/fase2/* → training/data/* para que el notebook use la misma ruta
            arc = f"training/{rel}"
            if args.phase == "2" and rel.startswith("data/fase2/"):
                arc = "training/data/" + rel.split("/", 2)[-1]
            z.write(path, arc)
    print(f"OK {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
