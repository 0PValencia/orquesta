#!/usr/bin/env python3
"""SFT con Unsloth + LoRA. El modelo se pasa por CLI; no está fijado.

Ejemplo:
  python train_unsloth.py --model unsloth/Qwen2.5-3B-Instruct --max-steps 60

Requisitos: GPU NVIDIA con CUDA. Instalar deps de training/requirements.txt
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fine-tune informe SFT (Unsloth LoRA)")
    p.add_argument("--model", required=True, help="HF id o ruta local, ej. unsloth/Qwen2.5-3B-Instruct")
    p.add_argument("--train", type=Path, default=DATA / "train_messages.jsonl")
    p.add_argument("--val", type=Path, default=DATA / "val_messages.jsonl")
    p.add_argument("--output-dir", type=Path, default=ROOT / "outputs" / "lora")
    p.add_argument("--max-seq-length", type=int, default=4096)
    p.add_argument("--batch-size", type=int, default=1)
    p.add_argument("--grad-accum", type=int, default=8)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--epochs", type=float, default=3.0)
    p.add_argument("--max-steps", type=int, default=-1, help="Si >0, limita steps (útil con dataset chico)")
    p.add_argument("--lora-r", type=int, default=16)
    p.add_argument("--lora-alpha", type=int, default=32)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--load-in-4bit", action="store_true", default=True)
    p.add_argument("--no-4bit", action="store_true", help="Desactiva QLoRA 4-bit")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    load_in_4bit = args.load_in_4bit and not args.no_4bit

    try:
        from unsloth import FastLanguageModel
        from trl import SFTTrainer, SFTConfig
        from datasets import load_dataset
    except ImportError as e:
        raise SystemExit(
            "Faltan dependencias. Instala training/requirements.txt en un entorno con CUDA.\n"
            f"Detalle: {e}"
        )

    if not args.train.exists():
        raise SystemExit(f"No existe {args.train}. Ejecuta: python scripts/prepare_dataset.py")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_length,
        load_in_4bit=load_in_4bit,
        dtype=None,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
    )

    def to_text(example: dict) -> dict:
        messages = example["messages"]
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        return {"text": text}

    train_ds = load_dataset("json", data_files=str(args.train), split="train").map(to_text)
    eval_ds = None
    if args.val.exists():
        eval_ds = load_dataset("json", data_files=str(args.val), split="train").map(to_text)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "run_config.json").write_text(
        json.dumps(vars(args), ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    sft_args = SFTConfig(
        output_dir=str(args.output_dir),
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        logging_steps=5,
        save_strategy="epoch",
        eval_strategy="epoch" if eval_ds is not None else "no",
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        seed=args.seed,
        optim="adamw_8bit",
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        packing=False,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        args=sft_args,
    )
    trainer.train()
    model.save_pretrained(str(args.output_dir / "adapter"))
    tokenizer.save_pretrained(str(args.output_dir / "adapter"))
    print(f"Adapter guardado en {args.output_dir / 'adapter'}")


if __name__ == "__main__":
    main()
