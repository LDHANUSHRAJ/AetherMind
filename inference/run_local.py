import torch
import os
from airllm import AutoModel
from transformers import AutoTokenizer

# Configuration
# Checks for the fine-tuned 2B model or 7B model path
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

print(f"Loading model from: {model_path} with AirLLM...")
# AirLLM loads layers one by one to fit in low memory (even 8GB RAM)
model = AutoModel.from_pretrained(model_path)

tokenizer = AutoTokenizer.from_pretrained(model_path)

def generate_response(prompt):
    # Gemma 2 Instruct Template
    formatted_prompt = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"
    
    input_tokens = tokenizer(formatted_prompt, return_tensors="pt", return_attention_mask=False)
    
    # AirLLM inference
    output = model.generate(
        input_tokens['input_ids'].cuda() if torch.cuda.is_available() else input_tokens['input_ids'],
        max_new_tokens=256,
        use_cache=True,
        return_dict_in_generate=True
    )
    
    response = tokenizer.decode(output.sequences[0], skip_special_tokens=True)
    # Clean up the response to remove the prompt part
    if "model\n" in response:
        response = response.split("model\n")[-1]
    return response

print("\nAetherMind AI Startup Mentor is ready!")
print("Type 'quit' or 'exit' to stop.\n")

while True:
    user_input = input("You: ")
    if user_input.lower() in ["quit", "exit"]:
        break
    
    print("\nAetherMind: Thinking...")
    response = generate_response(user_input)
    print(f"\nAetherMind: {response}\n")
