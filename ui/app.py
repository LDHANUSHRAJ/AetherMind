import gradio as gr
import torch
from airllm import AutoModel
from transformers import AutoTokenizer
import os

# Configuration
model_path_2b = "../model/aethermind_gemma2_2b_lora"
model_path_7b = "../model/aethermind_gemma2_7b_lora"

if os.path.exists(model_path_2b):
    model_path = model_path_2b
elif os.path.exists(model_path_7b):
    model_path = model_path_7b
else:
    model_path = model_path_2b # Default fallback
    print("[!] Warning: Fine-tuned model directory not found. Please place your model weights at:")
    print(f"    {model_path_2b} or {model_path_7b}")

print(f"Loading AetherMind Model from {model_path} into Gradio...")
# Use AirLLM for low-memory local inference
model = AutoModel.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path)

def predict(message, history):
    # Construct the chat history for context if needed, 
    # but for simplicity we'll focus on the current instruction.
    prompt = f"<start_of_turn>user\n{message}<end_of_turn>\n<start_of_turn>model\n"
    
    input_tokens = tokenizer(prompt, return_tensors="pt", return_attention_mask=False)
    
    # Inference
    output = model.generate(
        input_tokens['input_ids'].cuda() if torch.cuda.is_available() else input_tokens['input_ids'],
        max_new_tokens=512,
        use_cache=True
    )
    
    response = tokenizer.decode(output[0], skip_special_tokens=True)
    if "model\n" in response:
        response = response.split("model\n")[-1]
    
    return response

# UI Design
with gr.Blocks(theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🧠 AetherMind: Computational AI Assistant
    ### Specialized in Mathematics, Statistics, CS, Coding, Cybersecurity, & Web Dev
    *Ask about linear algebra, statistics, algorithm complexity, coding logic, and secure protocols.*
    """)
    
    chatbot = gr.ChatInterface(
        fn=predict,
        title="Chat with AetherMind",
        description="A precise computational AI assistant specializing in Math, Stats, CS, and Coding, running 100% locally.",
        examples=[
            "Find the derivative of f(x) = x^2 * sin(x)",
            "Calculate the mean, variance, and standard deviation of [4, 8, 6, 2, 10]",
            "Explain the Master Theorem in complexity analysis with an example.",
            "Implement a binary search algorithm in Python.",
            "Explain SQL Injection (SQLi) vulnerabilities."
        ]
    )

if __name__ == "__main__":
    demo.launch()
