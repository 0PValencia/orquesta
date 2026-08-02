#!/usr/bin/env python3
"""Evaluación ligera del holdout: checklist estructural (sin GPU).

Uso:
  # Solo audita el gold del test split
  python scripts/eval_checklist.py

  # Compara predicciones generadas (mismo orden que test_messages.jsonl)
  python scripts/eval_checklist.py --preds outputs/preds_test.jsonl
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "data" / "test.jsonl"

CJK = re.compile(r"[\u4e00-\u9fff]")
FIRST_PERSON = re.compile(r"\b(yo |nosotros |nuestra |nuestro |me |mi )\b", re.I)


def checks(text: str, instruction: str) -> dict:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return {
        "non_empty": bool(text.strip()),
        "min_chars_200": len(text) >= 200,
        "no_cjk": not bool(CJK.search(text)),
        "has_multiple_lines": len(lines) >= 3,
        "likely_heading": bool(
            re.match(r"^([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s\.\-]{3,}|CU\d+|CP-|-- |\| )", text.strip())
        )
        or "introduc" in instruction.lower()
        or "justific" in instruction.lower(),
        "low_first_person": len(FIRST_PERSON.findall(text)) <= 2,
    }


def score(row_checks: dict) -> float:
    return sum(1 for v in row_checks.values() if v) / len(row_checks)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", type=Path, default=TEST)
    ap.add_argument("--preds", type=Path, default=None, help="JSONL con campo output o prediction")
    args = ap.parse_args()

    gold = [json.loads(l) for l in args.test.read_text(encoding="utf-8").splitlines() if l.strip()]
    preds = None
    if args.preds:
        preds = [json.loads(l) for l in args.preds.read_text(encoding="utf-8").splitlines() if l.strip()]
        if len(preds) != len(gold):
            raise SystemExit(f"preds={len(preds)} != gold={len(gold)}")

    results = []
    for i, g in enumerate(gold):
        text = g["output"]
        if preds is not None:
            p = preds[i]
            text = p.get("prediction") or p.get("output") or p.get("text") or ""
        c = checks(text, g["instruction"])
        results.append({"id": g.get("meta", {}).get("id", i), "instruction": g["instruction"][:80], "score": score(c), **c})

    avg = sum(r["score"] for r in results) / max(1, len(results))
    print(json.dumps({"n": len(results), "avg_score": round(avg, 3), "rows": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
