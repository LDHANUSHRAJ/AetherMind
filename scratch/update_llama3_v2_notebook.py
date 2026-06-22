import json

with open("c:/Users/Dhanu/.gemini/antigravity/scratch/AetherMind/AetherMind_Llama3_V2.ipynb", "r", encoding="utf-8") as f:
    notebook = json.load(f)

# Update Step 5: Training cell
for cell in notebook["cells"]:
    if cell["cell_type"] == "code" and any("STEP 5:" in line for line in cell["source"]):
        cell["source"] = [
            "# ============================================================\n",
            "# STEP 5: Train the model!\n",
            "# ============================================================\n",
            "from trl import SFTTrainer, SFTConfig\n",
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
            "    args = SFTConfig(\n",
            "        per_device_train_batch_size = 1,\n",
            "        gradient_accumulation_steps = 8,\n",
            "        warmup_steps = 5,\n",
            "        max_steps = 60, # Prevent overfitting on 20-sample dataset\n",
            "        learning_rate = 2e-4, # Lower learning rate to avoid catastrophic forgetting\n",
            "        fp16 = not is_bfloat16_supported(),\n",
            "        bf16 = is_bfloat16_supported(),\n",
            "        logging_steps = 1,\n",
            "        optim = \"adamw_8bit\",\n",
            "        weight_decay = 0.01,\n",
            "        lr_scheduler_type = \"linear\",\n",
            "        seed = 3407,\n",
            "        output_dir = \"outputs\",\n",
            "        dataset_text_field = \"text\",\n",
            "        max_seq_length = 2048,\n",
            "    ),\n",
            ")\n",
            "\n",
            "print(\"Starting training...\")\n",
            "trainer_stats = trainer.train()\n",
            "print(\"Training completed!\")\n"
        ]
        break

# Update Step 7: Server cell
new_source = [
    "# ============================================================\n",
    "# STEP 7: Launch the Gradio server (copy the link!)\n",
    "# ============================================================\n",
    "import gradio as gr\n",
    "import traceback\n",
    "\n",
    "FastLanguageModel.for_inference(model)\n",
    "\n",
    "system_prompt = \"You are AetherMind, an intelligent, helpful, and precise AI assistant specializing in Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, and Web Development, capable of answering all general and conversational questions. Follow rules strictly: 1) Understand intent. 2) Be accurate. 3) Structure responses clearly. 4) Adapt to user style. 5) Answer whatever the user asks conversationally, directly, and professionally.\"\n",
    "\n",
    "def chat_fn(message, history):\n",
    "    try:\n",
    "        messages = [\n",
    "            {\"role\": \"system\", \"content\": system_prompt},\n",
    "            {\"role\": \"user\", \"content\": message}\n",
    "        ]\n",
    "        inputs = tokenizer.apply_chat_template(\n",
    "            messages, tokenize=True, add_generation_prompt=True,\n",
    "            return_dict=True, return_tensors=\"pt\"\n",
    "        ).to(\"cuda\")\n",
    "        outputs = model.generate(**inputs, max_new_tokens=512, do_sample=True, temperature=0.7, use_cache=True)\n",
    "        response = tokenizer.decode(outputs[0][inputs[\"input_ids\"].shape[1]:], skip_special_tokens=True)\n",
    "        return response\n",
    "    except Exception as e:\n",
    "        return f\"Error: {traceback.format_exc()}\"\n",
    "\n",
    "def api_chat(message, max_tokens=2048, temperature=0.7):\n",
    "    try:\n",
    "        messages = [\n",
    "            {\"role\": \"system\", \"content\": system_prompt},\n",
    "            {\"role\": \"user\", \"content\": message}\n",
    "        ]\n",
    "        inputs = tokenizer.apply_chat_template(\n",
    "            messages, tokenize=True, add_generation_prompt=True,\n",
    "            return_dict=True, return_tensors=\"pt\"\n",
    "        ).to(\"cuda\")\n",
    "        outputs = model.generate(\n",
    "            **inputs,\n",
    "            max_new_tokens=min(max_tokens, 4096),\n",
    "            temperature=max(0.01, min(temperature, 2.0)),\n",
    "            do_sample=True,\n",
    "            use_cache=True\n",
    "        )\n",
    "        response = tokenizer.decode(outputs[0][inputs[\"input_ids\"].shape[1]:], skip_special_tokens=True)\n",
    "        return {\"response\": response}\n",
    "    except Exception as e:\n",
    "        return {\"response\": f\"Error: {traceback.format_exc()}\"}\n",
    "\n",
    "with gr.Blocks(title=\"AetherMind API\", theme=gr.themes.Soft()) as demo:\n",
    "    gr.Markdown(\"# 🧠 AetherMind Fine-tuned Inference Server\")\n",
    "    gr.Markdown(\"**Model:** Llama-3 8B Fine-tuned | **Specialization:** Math, Stats, Code\")\n",
    "\n",
    "    with gr.Tab(\"Chat\"):\n",
    "        gr.ChatInterface(fn=chat_fn)\n",
    "\n",
    "    with gr.Tab(\"API\"):\n",
    "        gr.Markdown(\"### Use this endpoint from AetherMind frontend\")\n",
    "        api_input = gr.Textbox(label=\"Message\", lines=3)\n",
    "        api_tokens = gr.Slider(256, 4096, value=2048, step=256, label=\"Max Tokens\")\n",
    "        api_temp = gr.Slider(0.0, 1.5, value=0.7, step=0.1, label=\"Temperature\")\n",
    "        api_btn = gr.Button(\"Send\", variant=\"primary\")\n",
    "        api_output = gr.JSON(label=\"Response\")\n",
    "        api_btn.click(fn=api_chat, inputs=[api_input, api_tokens, api_temp], outputs=api_output, api_name=\"api_chat\")\n",
    "\n",
    "demo.launch(share=True, debug=True)\n"
]

notebook["cells"][-1]["source"] = new_source

with open("c:/Users/Dhanu/.gemini/antigravity/scratch/AetherMind/AetherMind_Llama3_V2.ipynb", "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1)

print("Notebook updated successfully!")
