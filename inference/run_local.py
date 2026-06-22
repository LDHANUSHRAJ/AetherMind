import torch
import os
from airllm import AutoModel
from transformers import AutoTokenizer

# [DEPRECATED] Old Gemma 2 paths (not used in AetherMind V2)
# model_path_2b = "../model/aethermind_gemma2_2b_lora"
# model_path_7b = "../model/aethermind_gemma2_7b_lora"

# Active Model: Standardized on Llama 3 8B
model_path = "../model/aethermind_llama3_8b_lora"

if not os.path.exists(model_path):
    print(f"[!] Warning: Fine-tuned model directory not found. Please place your model weights at: {model_path}")

print(f"Loading model from: {model_path} with AirLLM...")
# AirLLM loads layers one by one to fit in low memory (even 8GB RAM)
model = AutoModel.from_pretrained(model_path)

tokenizer = AutoTokenizer.from_pretrained(model_path)

def generate_response(prompt):
    # Llama 3 Instruct Template
    formatted_prompt = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    
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
    if "assistant\n\n" in response:
        response = response.split("assistant\n\n")[-1]
    return response

print("\nAetherMind Computational AI Assistant (Math/Stats/CS/Coding/Cybersec/Web) is ready!")
print("Type 'quit' or 'exit' to stop.\n")

while True:
    user_input = input("You: ")
    if user_input.lower() in ["quit", "exit"]:
        break
    
    print("\nAetherMind: Thinking...")
    response = generate_response(user_input)
    print(f"\nAetherMind: {response}\n")
