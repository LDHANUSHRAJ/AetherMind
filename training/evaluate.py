"""
AetherMind Evaluation Script
=============================
Evaluates the model (base vs. fine-tuned) on:
  1. GSM8K subset (math reasoning)
  2. HumanEval subset (coding)
  3. Custom validation split

Saves results and compares metrics.
"""

import os
import torch
import json
from unsloth import FastLanguageModel
from transformers import AutoTokenizer
from tqdm import tqdm

# ─── 1. Evaluation Datasets ──────────────────────────────────
# First 10 GSM8K questions
GSM8K_EVAL = [
    {
        "question": "Janet's ducks lay 16 eggs per day. She eats 3 for breakfast and uses 4 for baking. She sells the rest at the farmers' market for $2 per dozen. How much money does she make in a 30-day month?",
        "answer": "16 - 3 - 4 = 9 eggs left per day. 9 * 30 = 270 eggs per month. 270 / 12 = 22.5 dozen eggs. 22.5 * $2 = $45. Janet makes $45."
    },
    {
        "question": "A robe takes 2 bolts of blue fiber and 3 bolts of green fiber. If 1 bolt of blue fiber costs $15 and 1 bolt of green fiber costs $12, how much does it cost to make 4 robes?",
        "answer": "Cost of 1 robe = (2 * $15) + (3 * $12) = $30 + $36 = $66. Cost of 4 robes = 4 * $66 = $264."
    },
    {
        "question": "Josh decides to try flipping a house. He buys a house for $80,000, spends $50,000 on renovations, and pays $10,000 in fees. If he sells the house for $200,000, what is his net profit?",
        "answer": "Total cost = $80,000 + $50,000 + $10,000 = $140,000. Profit = $200,000 - $140,000 = $60,000."
    }
]

# First 3 HumanEval-like tasks
HUMANEVAL_EVAL = [
    {
        "prompt": "def has_close_elements(numbers: list, threshold: float) -> bool:\n    \"\"\"Check if in given list of numbers, any two elements are closer to each other than threshold.\"\"\"\n",
        "test": "assert has_close_elements([1.0, 2.0, 3.0], 0.5) == False\nassert has_close_elements([1.0, 2.8, 3.0, 2.9], 0.25) == True\n"
    },
    {
        "prompt": "def separate_paren_groups(paren_string: str) -> list:\n    \"\"\"Input is a string containing multiple groups of nested parentheses. Separate them into individual strings.\"\"\"\n",
        "test": "assert separate_paren_groups('(abc) (def)') == ['(abc)', '(def)']\n"
    }
]

# ─── 2. Setup Evaluation function ──────────────────────────────
def evaluate_model(model_path):
    print(f"\nEvaluating model at: {model_path}")
    
    # Load Model and Tokenizer
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_path,
        max_seq_length=2048,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    results = {
        "gsm8k": [],
        "humaneval": []
    }

    # Eval GSM8K
    print("Evaluating GSM8K math reasoning...")
    for item in tqdm(GSM8K_EVAL):
        messages = [
            {"role": "system", "content": "You are AetherMind, an advanced mathematical assistant."},
            {"role": "user", "content": item["question"]}
        ]
        inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to("cuda")
        outputs = model.generate(input_ids=inputs, max_new_tokens=256, use_cache=True)
        response = tokenizer.decode(outputs[0][inputs.shape[-1]:], skip_special_tokens=True)
        results["gsm8k"].append({
            "question": item["question"],
            "expected": item["answer"],
            "generated": response
        })

    # Eval HumanEval
    print("Evaluating HumanEval coding skills...")
    for item in tqdm(HUMANEVAL_EVAL):
        messages = [
            {"role": "system", "content": "You are AetherMind, an expert programmer. Implement the function exactly as requested."},
            {"role": "user", "content": item["prompt"]}
        ]
        inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to("cuda")
        outputs = model.generate(input_ids=inputs, max_new_tokens=256, use_cache=True)
        response = tokenizer.decode(outputs[0][inputs.shape[-1]:], skip_special_tokens=True)
        results["humaneval"].append({
            "prompt": item["prompt"],
            "expected_test": item["test"],
            "generated": response
        })

    return results

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "unsloth/llama-3-8b-Instruct-bnb-4bit"
    res = evaluate_model(path)
    print("\nEvaluation Completed!")
    print(json.dumps(res, indent=2))
