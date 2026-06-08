import json
import subprocess
import os

def main():
    print("Reverting notebooks to clean versions from HEAD...")
    subprocess.check_call("git checkout HEAD AetherMind_Finetuning.ipynb AetherMind_Llama3.ipynb AetherMind_Llama3_V2.ipynb", shell=True)

    print("Loading math/CS dataset from json...")
    with open('data/aethermind_dataset.json', 'r', encoding='utf-8') as f:
        dataset_content = json.load(f)

    # Format the dataset as proper Python code lines
    dataset_lines = []
    dataset_lines.append("aethermind_data = [\n")
    for idx, item in enumerate(dataset_content):
        dataset_lines.append("  {\n")
        inst_json = json.dumps(item['instruction'])
        inp_json = json.dumps(item['input'])
        out_json = json.dumps(item['output'])
        dataset_lines.append(f"    \"instruction\": {inst_json},\n")
        dataset_lines.append(f"    \"input\": {inp_json},\n")
        dataset_lines.append(f"    \"output\": {out_json}\n")
        if idx < len(dataset_content) - 1:
            dataset_lines.append("  },\n")
        else:
            dataset_lines.append("  }\n")
    dataset_lines.append("]\n")

    sys_prompt_text = (
        "You are AetherMind, a precise and intelligent computational AI assistant specializing in "
        "Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, and Web Development. "
        "Follow these rules strictly: "
        "1) Understand the user's intent first — answer what they are trying to achieve, not just the literal words. If ambiguous, provide the most likely answer or ask a clarifying question. "
        "2) Be accurate — never make up facts. If uncertain, state the uncertainty and verify information. "
        "3) Structure responses clearly — use headings, bullet points, numbered steps, and code blocks. "
        "4) Adapt to the user — give beginner-friendly explanations to beginners and concise technical depth to experts. "
        "5) Be helpful beyond the exact question — after answering, suggest useful next steps or related topics. "
        "6) Explain reasoning when useful — don't just give bare answers, explain why. "
        "7) Stay neutral and professional — avoid being condescending or argumentative. "
        "8) Match the user's style — formal user gets formal response, casual user gets casual response. "
        "9) Admit limitations — say 'I don't have enough information' rather than inventing an answer. "
        "10) Optimize for usefulness — every response should be correct, clear, complete, actionable, and relevant. "
        "You MUST strictly refuse to answer questions unrelated to Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, and Web Development. "
        "If asked an out-of-scope question, politely decline and pivot back to your expertise."
    )

    # 1. Update AetherMind_Finetuning.ipynb
    print("Updating AetherMind_Finetuning.ipynb...")
    with open('AetherMind_Finetuning.ipynb', 'r', encoding='utf-8') as f:
        nb_finetune = json.load(f)

    # Rebrand metadata / texts in all cells
    for cell in nb_finetune.get('cells', []):
        if cell.get('cell_type') == 'markdown':
            src = cell.get('source', [])
            new_src = []
            for line in src:
                line = line.replace("AI Startup Mentor", "AI Computational Assistant")
                line = line.replace("Startup Mentor", "Computational Assistant")
                line = line.replace("mentor for Indian startups", "assistant for Math, Stats, CS, Coding, Security & Web Dev")
                line = line.replace("Indian startup mentoring", "Computational Math/CS/Coding/Security/WebDev")
                line = line.replace("Startup Mentoring", "Math, Stats, CS & Web Dev")
                new_src.append(line)
            cell['source'] = new_src
        elif cell.get('cell_type') == 'code':
            src = cell.get('source', [])
            new_src = []
            for line in src:
                line = line.replace("AI startup mentor", "AI Computational Assistant")
                line = line.replace("AI Startup Mentor", "AI Computational Assistant")
                line = line.replace("AI startup advisor", "AI Computational Assistant")
                line = line.replace("startup advisor", "AI Computational Assistant")
                line = line.replace("Indian startup ecosystem", "Math, Stats, CS, CyberSec, and Web Dev domains")
                line = line.replace("startups, business, and entrepreneurship", "Mathematics, Statistics, CS, Coding, Security, and Web Dev")
                line = line.replace("startups and entrepreneurship", "Mathematics, Statistics, CS, Coding, Security, and Web Dev")
                new_src.append(line)
            cell['source'] = new_src

    # Cell 8: Dataset definition
    cell_8_src = [
        "import json\n",
        "from datasets import Dataset\n",
        "\n",
        "# Direct inline loading of the AetherMind mentoring dataset\n"
    ]
    cell_8_src.extend(dataset_lines)
    cell_8_src.extend([
        "\n",
        "# Define Gemma 2 Prompt Template format\n",
        "prompt_template = \"\"\"<start_of_turn>user\n",
        "{instruction}\n",
        "{input}<end_of_turn>\n",
        "<start_of_turn>model\n",
        "{output}<end_of_turn>\"\"\"\n",
        "\n",
        "def format_prompts(examples):\n",
        "    instructions = examples[\"instruction\"]\n",
        "    inputs       = examples[\"input\"]\n",
        "    outputs      = examples[\"output\"]\n",
        "    texts = []\n",
        "    for instruction, input_text, output in zip(instructions, inputs, outputs):\n",
        "        text = prompt_template.format(instruction=instruction, input=input_text, output=output)\n",
        "        texts.append(text)\n",
        "    return { \"text\" : texts, }\n",
        "\n",
        "dataset = Dataset.from_list(aethermind_data)\n",
        "dataset = dataset.map(format_prompts, batched = True)\n",
        "print(\"Dataset prepared! Total samples:\", len(dataset))\n"
    ])
    nb_finetune['cells'][8]['source'] = cell_8_src

    # Cell 10: TrainingArguments and SFTTrainer
    cell_10_src = [
        "from trl import SFTTrainer\n",
        "from transformers import TrainingArguments\n",
        "from unsloth import is_bfloat16_supported\n",
        "\n",
        "trainer = SFTTrainer(\n",
        "    model = model,\n",
        "    tokenizer = tokenizer,\n",
        "    train_dataset = dataset,\n",
        "    dataset_text_field = \"text\",\n",
        "    max_seq_length = max_seq_length,\n",
        "    dataset_num_proc = 2,\n",
        "    packing = False, # Set to True for much faster packing of shorter inputs\n",
        "    args = TrainingArguments(\n",
        "        per_device_train_batch_size = 1,\n",
        "        gradient_accumulation_steps = 8,\n",
        "        warmup_steps = 5,\n",
        "        max_steps = 25, # Prevent overfitting on 20-sample dataset\n",
        "        learning_rate = 5e-5, # Lower learning rate to avoid catastrophic forgetting\n",
        "        fp16 = not is_bfloat16_supported(),\n",
        "        bf16 = is_bfloat16_supported(),\n",
        "        logging_steps = 1,\n",
        "        optim = \"adamw_8bit\",\n",
        "        weight_decay = 0.01,\n",
        "        lr_scheduler_type = \"linear\",\n",
        "        seed = 3407,\n",
        "        output_dir = \"outputs\",\n",
        "    ),\n",
        ")\n",
        "\n",
        "print(\"Starting training...\")\n",
        "trainer_stats = trainer.train()\n",
        "print(\"Training completed successfully!\")\n"
    ]
    nb_finetune['cells'][10]['source'] = cell_10_src

    # Cell 12: Quick test
    cell_12_src = [
        "# Enable fast inference mode with Unsloth\n",
        "FastLanguageModel.for_inference(model)\n",
        "\n",
        "test_prompt = \"Calculate the derivative of f(x) = x^2 * sin(x) using the product rule.\"\n",
        "\n",
        "inputs = tokenizer(\n",
        "    [f\"<start_of_turn>user\\n{test_prompt}<end_of_turn>\\n<start_of_turn>model\\n\"],\n",
        "    return_tensors = \"pt\"\n",
        ").to(\"cuda\")\n",
        "\n",
        "outputs = model.generate(**inputs, max_new_tokens = 256, use_cache = True)\n",
        "response = tokenizer.decode(outputs[0], skip_special_tokens=True)\n",
        "\n",
        "print(\"Prompt:\", test_prompt)\n",
        "print(\"\\nGenerated Response:\")\n",
        "print(response.split(\"model\\n\")[-1])\n"
    ]
    nb_finetune['cells'][12]['source'] = cell_12_src

    with open('AetherMind_Finetuning.ipynb', 'w', encoding='utf-8') as f:
        json.dump(nb_finetune, f, indent=1)

    # 2. Update Llama 3 notebooks (AetherMind_Llama3.ipynb & AetherMind_Llama3_V2.ipynb)
    for path in ['AetherMind_Llama3.ipynb', 'AetherMind_Llama3_V2.ipynb']:
        print(f"Updating {path}...")
        with open(path, 'r', encoding='utf-8') as f:
            nb = json.load(f)

        # Rebrand markdown and other cells
        for cell in nb.get('cells', []):
            if cell.get('cell_type') == 'markdown':
                src = cell.get('source', [])
                new_src = []
                for line in src:
                    line = line.replace("AI Startup Mentor", "AI Computational Assistant")
                    line = line.replace("Startup Mentor", "Computational Assistant")
                    line = line.replace("mentor for Indian startups", "assistant for Math, Stats, CS, Coding, Security & Web Dev")
                    line = line.replace("Indian startup mentoring", "Computational Math/CS/Coding/Security/WebDev")
                    line = line.replace("Startup Mentoring", "Math, Stats, CS & Web Dev")
                    new_src.append(line)
                cell['source'] = new_src
            elif cell.get('cell_type') == 'code':
                src = cell.get('source', [])
                new_src = []
                for line in src:
                    line = line.replace("AI startup mentor", "AI Computational Assistant")
                    line = line.replace("AI Startup Mentor", "AI Computational Assistant")
                    line = line.replace("AI startup advisor", "AI Computational Assistant")
                    line = line.replace("startup advisor", "AI Computational Assistant")
                    line = line.replace("Indian startup ecosystem", "Math, Stats, CS, CyberSec, and Web Dev domains")
                    line = line.replace("startups, business, and entrepreneurship", "Mathematics, Statistics, CS, Coding, Security, and Web Dev")
                    line = line.replace("startups and entrepreneurship", "Mathematics, Statistics, CS, Coding, Security, and Web Dev")
                    new_src.append(line)
                cell['source'] = new_src

        # Cell 4: Dataset definition
        cell_4_src = [
            "# ============================================================\n",
            "# STEP 4: Load the AetherMind Dataset\n",
            "# ============================================================\n",
            "import json\n",
            "from datasets import Dataset\n",
            "from unsloth.chat_templates import get_chat_template\n",
            "\n",
            "# Apply the official Llama-3 chat template\n",
            "tokenizer = get_chat_template(tokenizer, chat_template=\"llama-3\")\n",
            "\n",
            "# The AetherMind Indian AI Computational Assistant dataset\n"
        ]
        cell_4_src.extend(dataset_lines)
        cell_4_src.extend([
            "\n",
            f"system_prompt = \"{sys_prompt_text}\"\n",
            "\n",
            "# Format the dataset for Llama-3\n",
            "def format_prompts(examples):\n",
            "    instructions = examples[\"instruction\"]\n",
            "    inputs       = examples[\"input\"]\n",
            "    outputs      = examples[\"output\"]\n",
            "    texts = []\n",
            "    for instruction, input_text, output in zip(instructions, inputs, outputs):\n",
            "        user_msg = instruction\n",
            "        if input_text.strip():\n",
            "            user_msg += f\"\\n{input_text}\"\n",
            "        messages = [\n",
            "            {\"role\": \"system\", \"content\": system_prompt},\n",
            "            {\"role\": \"user\", \"content\": user_msg},\n",
            "            {\"role\": \"assistant\", \"content\": output}\n",
            "        ]\n",
            "        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)\n",
            "        texts.append(text)\n",
            "    return { \"text\" : texts }\n",
            "\n",
            "dataset = Dataset.from_list(aethermind_data)\n",
            "dataset = dataset.map(format_prompts, batched=True)\n",
            "print(f\"Dataset ready! {len(dataset)} training samples.\")\n"
        ])
        nb['cells'][4]['source'] = cell_4_src

        # Cell 5: TrainingArgs and SFTTrainer
        cell_5_src = [
            "# ============================================================\n",
            "# STEP 5: Train the model!\n",
            "# ============================================================\n",
            "from trl import SFTTrainer\n",
            "from transformers import TrainingArguments\n",
            "from unsloth import is_bfloat16_supported\n",
            "\n",
            "trainer = SFTTrainer(\n",
            "    model = model,\n",
            "    tokenizer = tokenizer,\n",
            "    train_dataset = dataset,\n",
            "    dataset_text_field = \"text\",\n",
            "    max_seq_length = 2048,\n",
            "    dataset_num_proc = 2,\n",
            "    packing = False,\n",
            "    args = TrainingArguments(\n",
            "        per_device_train_batch_size = 1,\n",
            "        gradient_accumulation_steps = 8,\n",
            "        warmup_steps = 5,\n",
            "        max_steps = 25, # Prevent overfitting on 20-sample dataset\n",
            "        learning_rate = 5e-5, # Lower learning rate to avoid catastrophic forgetting\n",
            "        fp16 = not is_bfloat16_supported(),\n",
            "        bf16 = is_bfloat16_supported(),\n",
            "        logging_steps = 1,\n",
            "        optim = \"adamw_8bit\",\n",
            "        weight_decay = 0.01,\n",
            "        lr_scheduler_type = \"linear\",\n",
            "        seed = 3407,\n",
            "        output_dir = \"outputs\",\n",
            "    ),\n",
            ")\n",
            "\n",
            "print(\"Starting training...\")\n",
            "trainer_stats = trainer.train()\n",
            "print(\"Training completed!\")\n"
        ]
        nb['cells'][5]['source'] = cell_5_src

        # Cell 6: Quick test
        cell_6_src = [
            "# ============================================================\n",
            "# STEP 6: Quick test!\n",
            "# ============================================================\n",
            "FastLanguageModel.for_inference(model)\n",
            "\n",
            f"system_prompt = \"{sys_prompt_text}\"\n",
            "messages = [\n",
            "    {\"role\": \"system\", \"content\": system_prompt},\n",
            "    {\"role\": \"user\", \"content\": \"Explain what a probability distribution is, and give its types and standard conditions.\"}\n",
            "]\n",
            "inputs = tokenizer.apply_chat_template(\n",
            "    messages, tokenize=True, add_generation_prompt=True,\n",
            "    return_dict=True, return_tensors=\"pt\"\n",
            ").to(\"cuda\")\n",
            "\n",
            "outputs = model.generate(**inputs, max_new_tokens=256, use_cache=True)\n",
            "response = tokenizer.decode(outputs[0][inputs[\"input_ids\"].shape[1]:], skip_special_tokens=True)\n",
            "print(\"AI says:\", response)\n"
        ]
        nb['cells'][6]['source'] = cell_6_src

        # Cell 7: Gradio / share link
        cell_7_src = [
            "# ============================================================\n",
            "# STEP 7: Launch the Gradio server (copy the link!)\n",
            "# ============================================================\n",
            "import gradio as gr\n",
            "import traceback\n",
            "\n",
            "FastLanguageModel.for_inference(model)\n",
            "\n",
            f"system_prompt = \"{sys_prompt_text}\"\n",
            "\n",
            "def chat(message):\n",
            "    try:\n",
            "        messages = [\n",
            "            {\"role\": \"system\", \"content\": system_prompt},\n",
            "            {\"role\": \"user\", \"content\": message}\n",
            "        ]\n",
            "        inputs = tokenizer.apply_chat_template(\n",
            "            messages, tokenize=True, add_generation_prompt=True,\n",
            "            return_dict=True, return_tensors=\"pt\"\n",
            "        ).to(\"cuda\")\n",
            "        outputs = model.generate(**inputs, max_new_tokens=512, use_cache=True)\n",
            "        response = tokenizer.decode(outputs[0][inputs[\"input_ids\"].shape[1]:], skip_special_tokens=True)\n",
            "        return response\n",
            "    except Exception as e:\n",
            "        return f\"Error: {traceback.format_exc()}\"\n",
            "\n",
            "demo = gr.Interface(fn=chat, inputs=\"text\", outputs=\"text\", title=\"AetherMind AI\")\n",
            "demo.launch(share=True, debug=True)\n"
        ]
        nb['cells'][7]['source'] = cell_7_src

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(nb, f, indent=1)

    print("Checking AST compilation of the modified cells...")
    for path in ['AetherMind_Finetuning.ipynb', 'AetherMind_Llama3.ipynb', 'AetherMind_Llama3_V2.ipynb']:
        with open(path, 'r', encoding='utf-8') as f:
            nb = json.load(f)
        for idx, cell in enumerate(nb['cells']):
            if cell['cell_type'] == 'code':
                src_code = ''.join(cell['source'])
                if 'aethermind_data =' in src_code or 'SFTTrainer' in src_code or 'FastLanguageModel.for_inference' in src_code:
                    import ast
                    try:
                        ast.parse(src_code)
                        print(f"  {path} cell {idx} parsed successfully!")
                    except SyntaxError as e:
                        print(f"  SYNTAX ERROR in {path} cell {idx}: {e}")

if __name__ == "__main__":
    main()
