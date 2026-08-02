#!/usr/bin/env python3
"""Prepara splits train/val/test listos para SFT.

Fases:
  1 — proyectos + temas (redacción de informes)  [default]
  2 — razonamiento + mcp_google_docs (agente / tools)
  all — las cuatro fuentes

Genera en --out:
  - {train,val,test}.jsonl
  - {train,val,test}_messages.jsonl
  - manifest.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

TRAINING = Path(__file__).resolve().parents[1]
ROOT = TRAINING.parent
DATASET = ROOT / "dataset"
OUT_DEFAULT = TRAINING / "data"

SYSTEM_FASE1 = (TRAINING / "system_prompt.txt").read_text(encoding="utf-8")
SYSTEM_FASE2 = (TRAINING / "system_prompt_fase2.txt").read_text(encoding="utf-8")

SOURCES_BY_PHASE: dict[str, list[tuple[str, Path]]] = {
    "1": [
        ("proyectos", DATASET / "proyectos" / "dataset_proyectos.jsonl"),
        ("temas", DATASET / "temas" / "dataset_temas.jsonl"),
    ],
    "2": [
        ("razonamiento", DATASET / "razonamiento" / "dataset_razonamiento.jsonl"),
        ("mcp_google_docs", DATASET / "mcp_google_docs" / "dataset_mcp_google_docs.jsonl"),
    ],
    "all": [
        ("proyectos", DATASET / "proyectos" / "dataset_proyectos.jsonl"),
        ("temas", DATASET / "temas" / "dataset_temas.jsonl"),
        ("razonamiento", DATASET / "razonamiento" / "dataset_razonamiento.jsonl"),
        ("mcp_google_docs", DATASET / "mcp_google_docs" / "dataset_mcp_google_docs.jsonl"),
    ],
}

SEED = 42


def system_for(source: str, phase: str) -> str:
    if source in ("razonamiento", "mcp_google_docs") or phase == "2":
        return SYSTEM_FASE2
    if phase == "all" and source in ("proyectos", "temas"):
        return SYSTEM_FASE1
    return SYSTEM_FASE1


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
    elif source == "temas":
        rules = [
            ("definir", r"definir|qué es|que es"),
            ("diagrama", r"diagrama|uml|andarivel|swim"),
            ("glosario", r"glosario|guía|guia"),
            ("pruebas", r"prueba"),
            ("explicar", r"explicar|diferenc|comparar|describir|clasificar|responder"),
        ]
    elif source == "razonamiento":
        rules = [
            ("extraer", r"extraer|pdf|estructura"),
            ("planificar", r"plan|analizar|verificar|buscar"),
            ("agentico", r"agente|paralelo|orquest"),
        ]
    else:  # mcp_google_docs
        rules = [
            ("crear_doc", r"crear|nuevo|desde cero|generate_academic"),
            ("editar", r"insertar|editar|escribir|reemplazar|formato"),
            ("estructura", r"estructura|índice|indice|heading|portada"),
            ("imagen", r"imagen|diagrama|mermaid"),
            ("tabla", r"tabla"),
            ("export", r"export|pdf|bibliograf"),
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


def tool_call_block(name: str, arguments: dict[str, Any]) -> str:
    payload = {"name": name, "arguments": arguments}
    return "<tool_call>\n" + json.dumps(payload, ensure_ascii=False) + "\n</tool_call>"


def synth_mcp_result(step: dict, final: dict) -> str:
    """Resultado sintético plausible para el bucle multi-turno."""
    tool = step.get("tool", "")
    params = step.get("params") or {}
    doc_id = (
        (final or {}).get("documentId")
        or params.get("documentId")
        or "1a2b3c4d5e6f7g8h9i0j"
    )
    if tool == "create_document":
        return json.dumps(
            {"documentId": doc_id, "title": params.get("title", "Documento")},
            ensure_ascii=False,
        )
    if tool in ("generate_academic_document", "create_academic_structure"):
        return json.dumps(
            {
                "documentId": doc_id,
                "ok": True,
                "message": f"{tool} aplicado",
                "sections": (final or {}).get("sections") or ["Portada", "Introducción"],
            },
            ensure_ascii=False,
        )
    if tool == "get_document_structure":
        return json.dumps(
            {
                "documentId": doc_id,
                "blocks": [
                    {"type": "heading", "text": "PORTADA", "startIndex": 1, "endIndex": 20},
                    {
                        "type": "heading",
                        "text": "1. INTRODUCCIÓN",
                        "startIndex": 50,
                        "endIndex": 80,
                    },
                    {
                        "type": "paragraph",
                        "text": "",
                        "startIndex": 81,
                        "endIndex": 82,
                    },
                ],
            },
            ensure_ascii=False,
        )
    if tool in ("list_documents",):
        return json.dumps(
            {"documents": [{"id": doc_id, "title": params.get("title", "Doc")}]},
            ensure_ascii=False,
        )
    if tool == "search_images":
        return json.dumps(
            {
                "results": [
                    {
                        "title": "ejemplo",
                        "insertUrl": "https://upload.wikimedia.org/example.png",
                    }
                ]
            },
            ensure_ascii=False,
        )
    # genérico
    body = {
        "ok": True,
        "documentId": doc_id if "documentId" in params or tool.endswith("document") else None,
        "purpose": step.get("purpose") or "",
        "echo": {k: params[k] for k in list(params)[:6]},
    }
    body = {k: v for k, v in body.items() if v is not None and v != ""}
    return json.dumps(body, ensure_ascii=False)


def messages_mcp(row: dict, system: str) -> list[dict]:
    out = row["output"]
    assert isinstance(out, dict)
    reasoning = out.get("reasoning") or ""
    sequence = out.get("tool_sequence") or []
    rules = out.get("rules_applied") or []
    final = out.get("result") or {}

    msgs: list[dict] = [
        {"role": "system", "content": system},
        {"role": "user", "content": format_user(row["instruction"], row["input"])},
    ]

    if not sequence:
        text = reasoning
        if rules:
            text += "\n\nReglas: " + "; ".join(rules)
        text += "\n\n" + json.dumps(final, ensure_ascii=False)
        msgs.append({"role": "assistant", "content": text.strip()})
        return msgs

    for i, step in enumerate(sequence):
        tool = step.get("tool") or "unknown"
        params = step.get("params") or {}
        purpose = step.get("purpose") or ""
        preamble_parts = []
        if i == 0 and reasoning:
            preamble_parts.append(reasoning.strip())
        if purpose:
            preamble_parts.append(f"Siguiente paso: {purpose}")
        preamble = "\n\n".join(preamble_parts)
        content = (preamble + "\n\n" if preamble else "") + tool_call_block(tool, params)
        msgs.append({"role": "assistant", "content": content.strip()})

        result = synth_mcp_result(step, final if isinstance(final, dict) else {})
        msgs.append(
            {
                "role": "user",
                "content": (
                    f"Resultado de la tool {tool}:\n{result}\n\n"
                    "Continúa: otra tool_call o respuesta final al usuario."
                ),
            }
        )

    # cierre
    close_bits = []
    if rules:
        close_bits.append("Reglas aplicadas: " + "; ".join(rules))
    close_bits.append("Resultado:\n" + json.dumps(final, ensure_ascii=False, indent=2))
    msgs.append({"role": "assistant", "content": "\n\n".join(close_bits)})
    return msgs


def synth_razon_result(action: dict) -> str:
    analysis = action.get("result_analysis") or "OK"
    decision = action.get("decision") or ""
    return json.dumps(
        {
            "ok": True,
            "analysis": analysis,
            "decision": decision,
            "echo_params": action.get("params") or {},
        },
        ensure_ascii=False,
    )


def messages_razonamiento(row: dict, system: str) -> list[dict]:
    out = row["output"]
    assert isinstance(out, dict)
    thinking = out.get("thinking") or ""
    plan = out.get("plan") or []
    actions = out.get("actions") or []
    verification = out.get("verification") or []
    result = out.get("result") or {}

    plan_txt = "\n".join(
        f"{p.get('step', i+1)}. {p.get('action', '')} → {p.get('expected_outcome', '')}"
        for i, p in enumerate(plan)
    )

    msgs: list[dict] = [
        {"role": "system", "content": system},
        {"role": "user", "content": format_user(row["instruction"], row["input"])},
    ]

    if not actions:
        content = f"## Thinking\n{thinking}\n\n## Plan\n{plan_txt}\n\n## Resultado\n{json.dumps(result, ensure_ascii=False, indent=2)}"
        msgs.append({"role": "assistant", "content": content.strip()})
        return msgs

    for i, action in enumerate(actions):
        tool = action.get("tool") or "tool"
        params = action.get("params") or {}
        parts = []
        if i == 0:
            parts.append(f"## Thinking\n{thinking}")
            if plan_txt:
                parts.append(f"## Plan\n{plan_txt}")
        parts.append(f"Ejecuto: {tool}")
        content = "\n\n".join(parts) + "\n\n" + tool_call_block(tool, params)
        msgs.append({"role": "assistant", "content": content.strip()})
        msgs.append(
            {
                "role": "user",
                "content": (
                    f"Resultado de la tool {tool}:\n{synth_razon_result(action)}\n\n"
                    "Continúa: otra tool_call o respuesta final al usuario."
                ),
            }
        )

    ver_txt = "\n".join(
        f"- {v.get('check')}: {v.get('result')} ({v.get('method')})"
        + (f" → corrección: {v.get('correction')}" if v.get("correction") else "")
        for v in verification
    )
    final = f"## Verificación\n{ver_txt}\n\n## Resultado\n{json.dumps(result, ensure_ascii=False, indent=2)}"
    msgs.append({"role": "assistant", "content": final.strip()})
    return msgs


def messages_plain(row: dict, system: str) -> list[dict]:
    out = row["output"]
    content = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": format_user(row["instruction"], row["input"])},
        {"role": "assistant", "content": content},
    ]


def to_messages(row: dict, phase: str) -> dict:
    source = row["meta"]["source"]
    system = system_for(source, phase)
    if source == "mcp_google_docs":
        messages = messages_mcp(row, system)
    elif source == "razonamiento":
        messages = messages_razonamiento(row, system)
    else:
        messages = messages_plain(row, system)
    return {"messages": messages, "meta": row["meta"]}


def to_alpaca(row: dict, phase: str) -> dict:
    """Vista aplanada (solo último assistant) — útil para inspeccionar, no para train multi-turno."""
    msgs = to_messages(row, phase)["messages"]
    last_asst = next((m["content"] for m in reversed(msgs) if m["role"] == "assistant"), "")
    return {
        "system": system_for(row["meta"]["source"], phase),
        "instruction": row["instruction"],
        "input": row["input"]
        if isinstance(row["input"], str)
        else json.dumps(row["input"], ensure_ascii=False),
        "output": last_asst,
        "meta": row["meta"],
    }


def stratified_split(
    indices_by_family: dict[str, list[int]], seed: int
) -> tuple[list[int], list[int], list[int]]:
    rng_order = sorted(
        ((fam, idxs) for fam, idxs in indices_by_family.items()),
        key=lambda x: (len(x[1]), x[0]),
    )
    train, val, test = [], [], []
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
    parser.add_argument("--phase", choices=("1", "2", "all"), default="1")
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    if args.out is None:
        args.out = OUT_DEFAULT if args.phase == "1" else TRAINING / "data" / f"fase{args.phase}"

    sources = SOURCES_BY_PHASE[args.phase]
    all_rows: list[dict] = []
    for source, path in sources:
        if not path.exists():
            raise FileNotFoundError(path)
        all_rows.extend(load_source(source, path))

    train_rows, val_rows, test_rows = [], [], []
    manifest: dict[str, Any] = {
        "seed": args.seed,
        "phase": args.phase,
        "sources": {},
        "counts": {},
    }

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
        write_jsonl(out / f"{split}.jsonl", [to_alpaca(r, args.phase) for r in rows])
        write_jsonl(out / f"{split}_messages.jsonl", [to_messages(r, args.phase) for r in rows])
        manifest["counts"][split] = len(rows)

    # stats multi-turno
    n_msgs = []
    for r in train_rows:
        n_msgs.append(len(to_messages(r, args.phase)["messages"]))
    manifest["train_messages_len"] = {
        "min": min(n_msgs) if n_msgs else 0,
        "max": max(n_msgs) if n_msgs else 0,
        "avg": round(sum(n_msgs) / len(n_msgs), 2) if n_msgs else 0,
    }
    manifest["formats"] = {
        "alpaca": "{train,val,test}.jsonl",
        "messages": "{train,val,test}_messages.jsonl (multi-turno para MCP/razonamiento)",
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(json.dumps({"phase": args.phase, "out": str(out), **manifest["counts"]}, ensure_ascii=False))
    print("messages/train avg:", manifest["train_messages_len"])


if __name__ == "__main__":
    main()
