# ═══════════════════════════════════════════════════════════════
# AETHERMIND — COLAB INFERENCE SERVER
# ═══════════════════════════════════════════════════════════════
#
# HOW TO USE:
# 1. Go to https://colab.research.google.com
# 2. Create a new notebook
# 3. Go to Runtime → Change runtime type → Select T4 GPU
# 4. Paste this ENTIRE file into a single cell
# 5. Run the cell (Ctrl+Enter)
# 6. Wait ~3-5 minutes for model download
# 7. Copy the Gradio public URL (*.gradio.live) that appears
# 8. Paste it into your AetherMind frontend Settings → Backend URL
#
# MODEL: Llama-3 8B Instruct (4-bit quantized for T4 GPU)
#
# API ENDPOINTS (auto-exposed by Gradio):
#   POST /call/api_chat   → { "data": ["message", 512, 0.7] }
#   GET  /call/api_chat/{event_id}  → SSE stream with result
# ═══════════════════════════════════════════════════════════════

# ─── Step 1: Install packages ────────────────────────────────
import subprocess
subprocess.run(["pip", "install", "-q", "torch", "transformers", "accelerate",
                "bitsandbytes", "gradio>=4.0", "scipy"], check=True)

# ─── Step 2: Imports ─────────────────────────────────────────
import torch
import gradio as gr
from transformers import (AutoModelForCausalLM, AutoTokenizer,
                          BitsAndBytesConfig, TextIteratorStreamer)
from threading import Thread

# ─── Step 3: Load model ──────────────────────────────────────
MODEL_ID = "unsloth/llama-3-8b-Instruct-bnb-4bit"

print("⏳ Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

print("⏳ Loading model in 4-bit (this takes 2-4 minutes)...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)
print("✅ Model loaded!")

# ─── Step 4: System prompt ────────────────────────────────────
SYSTEM_PROMPT = """You are AetherMind, an advanced AI assistant specialized in mathematics, statistics, computer science, and programming.

Your core capabilities:
- Mathematics: Solve problems step-by-step with formal proofs. Handle calculus, linear algebra, number theory, discrete math.
- Statistics: Hypothesis tests (t-test, chi-square, ANOVA), probabilities, Bayesian reasoning.
- Coding: Write, debug, explain code in any language. Time/space complexity analysis.
- General: Answer any question clearly and accurately.

Rules:
- Show work step-by-step for math/stats.
- For code, include comments.
- Use LaTeX notation where helpful (∑, ∫, √, ∀, ∃).
- Be concise but thorough. Never guess."""

def _get_terminators():
    toks = [tokenizer.eos_token_id]
    try:
        toks.append(tokenizer.convert_tokens_to_ids("<|eot_id|>"))
    except:
        pass
    return [t for t in toks if t is not None]

# ─── Step 5: api_chat — THE MAIN FRONTEND ENDPOINT ───────────
# Frontend calls: POST /call/api_chat
#                 body: {"data": ["message", 512, 0.7]}
# Gradio 4.x returns event_id, then streams via:
#                 GET  /call/api_chat/{event_id}
def api_chat(message: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
    """Main AetherMind API endpoint. Called by the frontend chat page."""
    if not message or not message.strip():
        return "Please send a message."
    msgs = [
        {"role": "system",    "content": SYSTEM_PROMPT},
        {"role": "user",      "content": message.strip()},
    ]
    text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt").to(model.device)
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=min(int(max_tokens), 4096),
            temperature=max(0.01, min(float(temperature), 2.0)),
            top_p=0.9,
            repetition_penalty=1.1,
            do_sample=True,
            eos_token_id=_get_terminators(),
        )
    gen_ids = output_ids[0][inputs.input_ids.shape[-1]:]
    return tokenizer.decode(gen_ids, skip_special_tokens=True).strip()

# ─── Step 6: chat_fn — streaming for the Chat UI tab ─────────
def chat_fn(message, history):
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    for human, assistant in (history or []):
        if human:     msgs.append({"role": "user",      "content": human})
        if assistant: msgs.append({"role": "assistant", "content": assistant})
    msgs.append({"role": "user", "content": message})
    text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt").to(model.device)
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
    kwargs = dict(
        **inputs,
        max_new_tokens=2048,
        temperature=0.7,
        top_p=0.9,
        repetition_penalty=1.1,
        do_sample=True,
        eos_token_id=_get_terminators(),
        streamer=streamer,
    )
    Thread(target=model.generate, kwargs=kwargs).start()
    generated = ""
    for chunk in streamer:
        generated += chunk
        yield generated

# ─── Step 7: Build Gradio Blocks app ─────────────────────────
with gr.Blocks(title="AetherMind API", theme=gr.themes.Soft()) as demo:
    gr.Markdown("# 🧠 AetherMind Inference Server")
    gr.Markdown("**Model:** Llama-3 8B (4-bit) | **Frontend endpoint:** `POST /call/api_chat`")

    with gr.Tab("Chat"):
        gr.ChatInterface(
            fn=chat_fn,
            examples=[
                "Prove by induction that 1+2+...+n = n(n+1)/2",
                "Write a Python binary search with O(log n) complexity",
                "Chi-square test: observed=[50,30,20], expected=[40,35,25]",
                "Explain BFS vs DFS with Python code",
                "Solve: ∫ x²·eˣ dx by integration by parts",
            ],
            title="",
        )

    with gr.Tab("API"):
        gr.Markdown("""### Frontend REST API
**Call from AetherMind frontend:**
```
POST https://<your-url>.gradio.live/call/api_chat
Body: {"data": ["your message here", 512, 0.7]}
```
Or test it below:""")
        api_input  = gr.Textbox(label="Message", lines=4, placeholder="Ask a math/code/stats question…")
        api_tokens = gr.Slider(256, 4096, value=512, step=256, label="Max Tokens")
        api_temp   = gr.Slider(0.0, 1.5, value=0.7, step=0.1, label="Temperature")
        api_output = gr.Textbox(label="Response", lines=10, show_copy_button=True)
        gr.Button("Send", variant="primary").click(
            fn=api_chat,
            inputs=[api_input, api_tokens, api_temp],
            outputs=api_output,
            api_name="api_chat",   # ← Creates POST /call/api_chat endpoint
        )

print("\n" + "=" * 60)
print("🚀 AetherMind Gradio server launching...")
print("   API: <your-url>.gradio.live/call/api_chat")
print("=" * 60 + "\n")

demo.launch(
    share=True,
    server_port=7860,
    show_error=True,
    quiet=False,
)
