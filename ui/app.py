import gradio as gr
import torch
from airllm import AutoModel
from transformers import AutoTokenizer
import os
import sys

# Add current directory to path to import api_key_manager
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from api_key_manager import (
    init_db, generate_key,
    validate_key, list_keys, revoke_key
)

# Initialize Database
init_db()

# Configuration
model_path_2b = "../model/aethermind_gemma2_2b_lora"
model_path_7b = "../model/aethermind_gemma2_7b_lora"

if os.path.exists(model_path_2b):
    model_path = model_path_2b
elif os.path.exists(model_path_7b):
    model_path = model_path_7b
else:
    model_path = model_path_2b # Default fallback
    print("[!] Warning: Fine-tuned model directory not found.")

print(f"Loading AetherMind Model from {model_path} into Gradio...")
# Load model & tokenizer only if path exists to prevent crash on UI-only run
model = None
tokenizer = None
if os.path.exists(model_path):
    try:
        model = AutoModel.from_pretrained(model_path)
        tokenizer = AutoTokenizer.from_pretrained(model_path)
    except Exception as e:
        print(f"Error loading model: {e}")

def model_inference(message: str) -> str:
    if not model or not tokenizer:
        return f"[UI Demo Mode] Model not loaded. Response to: {message}"
    
    prompt = f"<start_of_turn>user\n{message}<end_of_turn>\n<start_of_turn>model\n"
    input_tokens = tokenizer(prompt, return_tensors="pt", return_attention_mask=False)
    
    output = model.generate(
        input_tokens['input_ids'].cuda() if torch.cuda.is_available() else input_tokens['input_ids'],
        max_new_tokens=512,
        use_cache=True
    )
    
    response = tokenizer.decode(output[0], skip_special_tokens=True)
    if "model\n" in response:
        response = response.split("model\n")[-1]
    return response

def predict(message, history):
    return model_inference(message)

# API endpoint protected by key validation
def aethermind_api(message: str, api_key: str) -> str:
    if not api_key or not api_key.startswith("am-"):
        return "Error: Invalid API key format."

    if not validate_key(api_key):
        return "Error: API key is invalid or expired."

    return model_inference(message)

# Handlers for Settings Page key management
def handle_generate(label: str, duration: str):
    try:
        res = generate_key(label, duration)
        return res["key"], res["prefix"], res["label"], res["expiry"], res["created_at"]
    except Exception as e:
        return f"Error: {str(e)}", "", "", "", ""

def handle_list():
    try:
        keys = list_keys()
        import json
        return json.dumps(keys)
    except Exception as e:
        return f"[]"

def handle_revoke(prefix: str):
    try:
        success = revoke_key(prefix)
        return "success" if success else "failed"
    except Exception as e:
        return f"error: {str(e)}"

# UI Design
with gr.Blocks(theme=gr.themes.Soft(), title="AetherMind Server") as demo:
    gr.Markdown("""
    # 🧠 AetherMind: Computational AI Assistant & Server
    """)
    
    with gr.Tab("Chat"):
        chatbot = gr.ChatInterface(
            fn=predict,
            title="Chat with AetherMind",
            description="A precise computational AI assistant specializing in Math, Stats, CS, and Coding."
        )

    # Invisible API triggers for settings.html client page
    with gr.Row(visible=False):
        # Generate Key API
        gen_label = gr.Textbox(label="label")
        gen_duration = gr.Textbox(label="duration")
        gen_out_key = gr.Textbox(label="key")
        gen_out_prefix = gr.Textbox(label="prefix")
        gen_out_lbl = gr.Textbox(label="out_label")
        gen_out_expiry = gr.Textbox(label="expiry")
        gen_out_created = gr.Textbox(label="created")
        gen_btn = gr.Button("Generate Key")
        gen_btn.click(
            fn=handle_generate,
            inputs=[gen_label, gen_duration],
            outputs=[gen_out_key, gen_out_prefix, gen_out_lbl, gen_out_expiry, gen_out_created],
            api_name="generate_key"
        )

        # List Keys API
        list_btn = gr.Button("List Keys")
        list_out = gr.Textbox(label="list")
        list_btn.click(
            fn=handle_list,
            inputs=[],
            outputs=list_out,
            api_name="list_keys"
        )

        # Revoke Key API
        revoke_prefix = gr.Textbox(label="prefix")
        revoke_out = gr.Textbox(label="status")
        revoke_btn = gr.Button("Revoke Key")
        revoke_btn.click(
            fn=handle_revoke,
            inputs=[revoke_prefix],
            outputs=revoke_out,
            api_name="revoke_key"
        )

        # Predict with Key API
        api_msg = gr.Textbox(label="msg")
        api_key_val = gr.Textbox(label="key")
        api_out = gr.Textbox(label="reply")
        api_btn = gr.Button("Call API")
        api_btn.click(
            fn=aethermind_api,
            inputs=[api_msg, api_key_val],
            outputs=api_out,
            api_name="predict_with_key"
        )

if __name__ == "__main__":
    demo.launch()
