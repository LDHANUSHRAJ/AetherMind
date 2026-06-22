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
# 8. Paste it into your AetherMind frontend settings
#
# MODEL: Qwen2.5-7B-Instruct (best open model for math/code/stats)
# ═══════════════════════════════════════════════════════════════

# ─── Step 1: Install packages ────────────────────────────────
!pip install -q torch transformers accelerate bitsandbytes gradio scipy

# ─── Step 2: Load model (4-bit quantized to fit T4 GPU) ─────
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

MODEL_ID = "unsloth/llama-3-8b-Instruct-bnb-4bit"

print("⏳ Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)

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
print("✅ Model loaded successfully!")

# ─── Step 3: System prompt for math/code/stats ───────────────
SYSTEM_PROMPT = """You are AetherMind, an advanced AI assistant specialized in mathematics, statistics, computer science, and programming.

Your core capabilities:
- **Mathematics**: Solve problems step-by-step. Write formal proofs (induction, contradiction, direct). Handle calculus, linear algebra, number theory, discrete math, and more.
- **Statistics**: Perform hypothesis tests (t-test, chi-square, ANOVA, etc.), compute probabilities, explain Bayesian reasoning, and interpret p-values correctly.
- **Coding**: Write, debug, and explain code in ANY programming language (Python, C++, Java, JavaScript, Rust, Go, etc.). Analyze time/space complexity. Suggest optimizations.
- **General Knowledge**: Answer any question the user asks clearly and accurately.

Rules:
- Always show your work step-by-step for math/stats problems.
- For code, include comments explaining the logic.
- If a proof is requested, state the method (induction, contradiction, etc.) and verify each step.
- Never guess. If uncertain, say so.
- Use LaTeX-style notation for math when helpful (e.g., ∑, ∫, √, ∀, ∃).
- Be concise but thorough."""

# ─── Step 4: Inference function ──────────────────────────────
def generate_response(user_message, chat_history):
    """Generate a response from the model."""
    # Build messages list from history
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for human, assistant in chat_history:
        messages.append({"role": "user", "content": human})
        messages.append({"role": "assistant", "content": assistant})

    messages.append({"role": "user", "content": user_message})

    # Tokenize with chat template
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer([text], return_tensors="pt").to(model.device)

    # Generate
    terminators = [
        tokenizer.eos_token_id,
        tokenizer.convert_tokens_to_ids("<|eot_id|>")
    ]
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=2048,
            temperature=0.7,
            top_p=0.9,
            repetition_penalty=1.1,
            do_sample=True,
            eos_token_id=terminators,
        )

    # Decode only the new tokens
    generated_ids = output_ids[0][inputs.input_ids.shape[-1]:]
    response = tokenizer.decode(generated_ids, skip_special_tokens=True)

    return response

# ─── Step 5: Gradio interface ────────────────────────────────
import gradio as gr

def chat_fn(message, history):
    """Gradio chat function."""
    response = generate_response(message, history)
    return response

# Also expose a raw API endpoint for the frontend
def api_chat(message, max_tokens=2048, temperature=0.7):
    """API endpoint for AetherMind frontend."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message}
    ]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer([text], return_tensors="pt").to(model.device)

    terminators = [
        tokenizer.eos_token_id,
        tokenizer.convert_tokens_to_ids("<|eot_id|>")
    ]
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=min(max_tokens, 4096),
            temperature=max(0.01, min(temperature, 2.0)),
            top_p=0.9,
            repetition_penalty=1.1,
            do_sample=True,
            eos_token_id=terminators,
        )

    generated_ids = output_ids[0][inputs.input_ids.shape[-1]:]
    response = tokenizer.decode(generated_ids, skip_special_tokens=True)
    return {"response": response, "tokens_used": len(generated_ids)}

# Build the Gradio app
with gr.Blocks(title="AetherMind API", theme=gr.themes.Soft()) as demo:
    gr.Markdown("# 🧠 AetherMind Inference Server")
    gr.Markdown("**Model:** Qwen2.5-7B-Instruct (4-bit) | **Specialization:** Math, Stats, Code")

    # Chat tab
    with gr.Tab("Chat"):
        chatbot = gr.ChatInterface(
            fn=chat_fn,
            examples=[
                "Prove by induction that 1+2+...+n = n(n+1)/2",
                "Write a Python function for binary search with O(log n) complexity",
                "Perform a chi-square test: observed=[50,30,20], expected=[40,35,25]",
                "Explain the difference between BFS and DFS with code examples",
                "Solve: ∫ x²·eˣ dx using integration by parts",
            ],
            title="",
        )

    # API tab (for programmatic access from the frontend)
    with gr.Tab("API"):
        gr.Markdown("### Use this endpoint from AetherMind frontend")
        api_input = gr.Textbox(label="Message", lines=3)
        api_tokens = gr.Slider(256, 4096, value=2048, step=256, label="Max Tokens")
        api_temp = gr.Slider(0.0, 1.5, value=0.7, step=0.1, label="Temperature")
        api_btn = gr.Button("Send", variant="primary")
        api_output = gr.JSON(label="Response")
        api_btn.click(fn=api_chat, inputs=[api_input, api_tokens, api_temp], outputs=api_output, api_name="api_chat")

print("\n" + "═" * 60)
print("🚀 Launching Gradio server with public URL...")
print("═" * 60 + "\n")

demo.launch(
    share=True,       # Creates a public *.gradio.live URL
    server_port=7860,
    show_error=True,
)
