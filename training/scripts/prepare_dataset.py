#!/usr/bin/env python3
"""Prepara splits train/val/test listos para SFT (fase 1: informes + temas).

No incluye razonamiento ni MCP (fases posteriores).
Genera:
  - data/{train,val,test}.jsonl          (Alpaca + system)
  - data/{train,val,test}_messages.jsonl (chat messages)
  - data/manifest.json                   (índices y familias)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

TRAINING = Path(__file__).resolve().parents[1]
ROOT = TRAINING.parent
DATASET = ROOT / "dataset"
OUT = TRAINING / "data"
SYSTEM_PROMPT = (TRAINING / "system_prompt.txt").read_text(encoding="utf-8")

SOURCES = [
    ("proyectos", DATASET / "proyectos" / "dataset_proyectos.jsonl"),
    ("temas", DATASET / "temas" / "dataset_temas.jsonl"),
]

SEED = 42


def family(instruction: str, source: str) -> str:
    i = instruction.lower()
    if source == "proyectos":
        rules = [
            ("portada", r"portada"),
            ("introduccion", r"introduc"),
            ("justificacion", r"justific"),
            ("objetivos", r"objetiv"),
            ("problema", r"problema"),
            ("alcance", r"alcance"),
            ("caso_uso", r"caso de uso"),
            ("diagrama", r"diagrama"),
            ("sql", r"sql|procedimiento|trigger|base de datos|consulta"),
            ("pruebas", r"prueba"),
            ("conclusiones", r"conclusion"),
            ("recomendaciones", r"recomend"),
            ("bibliografia", r"referenc|bibliograf"),
            ("perfil", r"perfil|entrevista|elementos del sistema|tecnolog|costos|beneficios|clientes"),
            ("arquitectura", r"arquitectura|diseño físico|diseño fisico"),
        ]
    else:
        rules = [
            ("definir", r"definir|qué es|que es"),
            ("diagrama", r"diagrama|uml|andarivel|swim"),
            ("glosario", r"glosario|guía|guia"),
            ("pruebas", r"prueba"),
            ("explicar", r"explicar|diferenc|comparar|describir|clasificar|responder"),
        ]
    for name, pat in rules:
        if re.search(pat, i):
            return name
    return "otro"


def format_user(instruction: str, inp: object) -> str:
    if inp is None or inp == "" or inp == {}:
        return instruction
    payload = json.dumps(inp, ensure_ascii=False, indent=2)
    return f"{instruction}\n\nDatos de entrada:\n{payload}"


def to_alpaca(row: dict) -> dict:
    return {
        "system": SYSTEM_PROMPT,
        "instruction": row["instruction"],
        "input": row["input"] if isinstance(row["input"], str) else json.dumps(row["input"], ensure_ascii=False),
        "output": row["output"] if isinstance(row["output"], str) else json.dumps(row["output"], ensure_ascii=False),
        "meta": row["meta"],
    }


def to_messages(row: dict) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": format_user(row["instruction"], row["input"])},
            {
                "role": "assistant",
                "content": row["output"]
                if isinstance(row["output"], str)
                else json.dumps(row["output"], ensure_ascii=False),
            },
        ],
        "meta": row["meta"],
    }


def stratified_split(indices_by_family: dict[str, list[int]], seed: int) -> tuple[list[int], list[int], list[int]]:
    """Reparto ~75/12.5/12.5 priorizando al menos 1 train por familia cuando hay ≥1."""
    rng_order = sorted(
        ((fam, idxs) for fam, idxs in indices_by_family.items()),
        key=lambda x: (len(x[1]), x[0]),
    )
    train, val, test = [], [], []
    # Deterministic shuffle per family using hash+seed
    for fam, idxs in rng_order:
        keyed = sorted(idxs, key=lambda i: hashlib.md5(f"{seed}:{fam}:{i}".encode()).hexdigest())
        n = len(keyed)
        if n == 1:
            train.extend(keyed)
        elif n == 2:
            train.append(keyed[0])
            test.append(keyed[1])
        elif n == 3:
            train.append(keyed[0])
            val.append(keyed[1])
            test.append(keyed[2])
        else:
            n_test = max(1, round(n * 0.125))
            n_val = max(1, round(n * 0.125))
            n_train = n - n_test - n_val
            if n_train < 1:
                n_train, n_val, n_test = n - 2, 1, 1
            train.extend(keyed[:n_train])
            val.extend(keyed[n_train : n_train + n_val])
            test.extend(keyed[n_train + n_val :])
    return train, val, test


def load_source(source: str, path: Path) -> list[dict]:
    rows = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        obj = json.loads(line)
        assert "instruction" in obj and "input" in obj and "output" in obj
        rows.append(
            {
                "instruction": obj["instruction"],
                "input": obj["input"],
                "output": obj["output"],
                "meta": {
                    "source": source,
                    "source_index": i,
                    "family": family(obj["instruction"], source),
                    "id": f"{source}:{i}",
                },
            }
        )
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()

    all_rows: list[dict] = []
    for source, path in SOURCES:
        if not path.exists():
            raise FileNotFoundError(path)
        all_rows.extend(load_source(source, path))

    # Split independently per source to keep balance, then merge
    train_rows, val_rows, test_rows = [], [], []
    manifest = {"seed": args.seed, "sources": {}, "counts": {}}

    by_source: dict[str, list[dict]] = defaultdict(list)
    for r in all_rows:
        by_source[r["meta"]["source"]].append(r)

    for source, rows in by_source.items():
        fam_map: dict[str, list[int]] = defaultdict(list)
        for idx, r in enumerate(rows):
            fam_map[r["meta"]["family"]].append(idx)
        tr, va, te = stratified_split(fam_map, args.seed)
        train_rows.extend(rows[i] for i in tr)
        val_rows.extend(rows[i] for i in va)
        test_rows.extend(rows[i] for i in te)
        manifest["sources"][source] = {
            "total": len(rows),
            "train": [rows[i]["meta"]["id"] for i in tr],
            "val": [rows[i]["meta"]["id"] for i in va],
            "test": [rows[i]["meta"]["id"] for i in te],
            "families": {k: len(v) for k, v in sorted(fam_map.items())},
        }

    out = args.out
    for split, rows in ("train", train_rows), ("val", val_rows), ("test", test_rows):
        write_jsonl(out / f"{split}.jsonl", [to_alpaca(r) for r in rows])
        write_jsonl(out / f"{split}_messages.jsonl", [to_messages(r) for r in rows])
        manifest["counts"][split] = len(rows)

    manifest["phase"] = 1
    manifest["excluded"] = ["razonamiento", "mcp_google_docs"]
    manifest["formats"] = {
        "alpaca": "{train,val,test}.jsonl",
        "messages": "{train,val,test}_messages.jsonl",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(manifest["counts"], ensure_ascii=False))
    print(f"Escrito en {out}")


if __name__ == "__main__":
    main()
