"""
AetherMind Training Script — Llama 3 8B Instruct (Standardized)
================================================================
Base Model: unsloth/llama-3-8b-Instruct-bnb-4bit
LoRA Config: r=16, alpha=16
Dataset: aethermind_train.json / aethermind_val.json (built by build_dataset.py)
"""

import os
import torch
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
from unsloth import is_bfloat16_supported
from unsloth.chat_templates import get_chat_template

# ─── 1. Configuration ──────────────────────────────────────────
MODEL_NAME = "unsloth/llama-3-8b-Instruct-bnb-4bit"
MAX_SEQ_LENGTH = 2048
TRAIN_DATA = "../data/aethermind_train.json"
VAL_DATA = "../data/aethermind_val.json"
OUTPUT_DIR = "../model/aethermind_llama3_8b_lora"

# LoRA Hyperparameters (unified across project)
LORA_R = 16
LORA_ALPHA = 16
LEARNING_RATE = 2e-4
PER_DEVICE_BATCH = 1
GRAD_ACCUM_STEPS = 8  # Effective batch size = 8
DESIRED_EPOCHS = 2.5

# ─── 2. Load Model and Tokenizer ───────────────────────────────
print(f"Loading {MODEL_NAME}...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
    dtype=None,
)

# Apply official Llama 3 chat template
tokenizer = get_chat_template(tokenizer, chat_template="llama-3")

# ─── 3. Add LoRA Adapters ──────────────────────────────────────
model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_R,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)
print(f"LoRA adapter attached (r={LORA_R}, alpha={LORA_ALPHA})")

# ─── 4. Data Preparation (Llama 3 Instruct Format) ────────────
SYSTEM_PROMPT = (
    "You are AetherMind, an advanced AI assistant specialized in mathematics, "
    "statistics, computer science, and programming. You provide step-by-step "
    "solutions with formal verification. You never guess — you compute."
)

def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs = examples["input"]
    outputs = examples["output"]
    texts = []
    for instruction, input_text, output in zip(instructions, inputs, outputs):
        user_msg = instruction
        if input_text and input_text.strip():
            user_msg += f"\n{input_text}"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": output},
        ]
        text = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=False
        )
        texts.append(text)
    return {"text": texts}

# Load datasets
train_dataset = load_dataset("json", data_files=TRAIN_DATA, split="train")
train_dataset = train_dataset.map(formatting_prompts_func, batched=True)

val_dataset = load_dataset("json", data_files=VAL_DATA, split="train")
val_dataset = val_dataset.map(formatting_prompts_func, batched=True)

print(f"Train: {len(train_dataset)} samples | Val: {len(val_dataset)} samples")

# ─── 5. Calculate Training Steps ──────────────────────────────
effective_batch_size = PER_DEVICE_BATCH * GRAD_ACCUM_STEPS
steps_per_epoch = len(train_dataset) // effective_batch_size
max_steps = int(steps_per_epoch * DESIRED_EPOCHS)
eval_steps = max(1, steps_per_epoch // 2)  # Evaluate twice per epoch

print(f"Steps/epoch: {steps_per_epoch} | Max steps: {max_steps} | Eval every: {eval_steps} steps")

# ─── 6. Trainer Setup ─────────────────────────────────────────
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=False,
    args=SFTConfig(
        per_device_train_batch_size=PER_DEVICE_BATCH,
        per_device_eval_batch_size=PER_DEVICE_BATCH,
        gradient_accumulation_steps=GRAD_ACCUM_STEPS,
        warmup_steps=10,
        max_steps=max_steps,
        learning_rate=LEARNING_RATE,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=5,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=3407,
        output_dir="outputs",
        eval_strategy="steps",
        eval_steps=eval_steps,
        save_strategy="steps",
        save_steps=eval_steps,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
    ),
)

# ─── 7. Train ─────────────────────────────────────────────────
print("=" * 60)
print("Starting training...")
print("=" * 60)
trainer_stats = trainer.train()

# ─── 8. Save Model ────────────────────────────────────────────
print(f"Saving model to {OUTPUT_DIR}...")
os.makedirs(OUTPUT_DIR, exist_ok=True)
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print("Training completed and model saved!")
print(f"  Final train loss: {trainer_stats.training_loss:.4f}")
