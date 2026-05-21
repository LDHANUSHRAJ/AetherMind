import os
import sys
import torch
from airllm import AutoModel
from transformers import AutoTokenizer

# Target Model: Gemma 2 2B Instruct (Public, optimized 4-bit)
# You can also change this to "unsloth/gemma-2-2b-it" or any larger model like Llama 70B!
model_id = "unsloth/gemma-2-2b-it-bnb-4bit"

print("="*60)
print(f" AirLLM Local Model Runner")
print("="*60)
print(f"Loading Model     : {model_id}")
print("Mode              : Layer-by-layer low VRAM inference")
print("Disk Optimizer    : delete_original=True (Saves 50% disk space)")
print("-"*60)

# Check if CUDA is available, otherwise fall back to CPU (AirLLM v2.10.1+ supports CPU!)
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Execution Device  : {device.upper()}")

print("\n[i] Loading model weights with AirLLM...")
try:
    # AirLLM decomposes the model layer-by-layer to fit inside low memory (under 4GB RAM)
    # Setting delete_original=True deletes raw HF source files after processing to save disk space!
    model = AutoModel.from_pretrained(
        model_id,
        delete_original=True,
        compression='4bit' # Block-wise quantization for 3x speed up
    )
    
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    print("\n[+] Model loaded successfully!")
    print("="*60)
except Exception as e:
    print(f"\n[-] Error loading model: {e}")
    print("\n[i] Troubleshooting:")
    print("1. Ensure you have installed airllm: pip install airllm bitsandbytes")
    print("2. Ensure you have at least 2.5 GB of free space on your C: drive.")
    print("="*60)
    sys.exit(1)

def ask_airllm(prompt):
    # Gemma 2 Instruct template format
    formatted_prompt = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"
    
    input_tokens = tokenizer(
        formatted_prompt, 
        return_tensors="pt", 
        return_attention_mask=False,
        truncation=True,
        max_length=512,
        padding=False
    )
    
    # Run sequential inference
    print("\nAetherMind is generating response...")
    input_ids = input_tokens['input_ids'].to(device)
    
    generation_output = model.generate(
        input_ids,
        max_new_tokens=128,
        use_cache=True,
        return_dict_in_generate=True
    )
    
    response = tokenizer.decode(generation_output.sequences[0], skip_special_tokens=True)
    
    # Clean output to show only the generated model answer
    if "model\n" in response:
        response = response.split("model\n")[-1]
    return response

# Interactive Chat Loop
print("\nAetherMind AI Startup Mentor is ready!")
print("Type 'quit' or 'exit' to stop.\n")

while True:
    user_query = input("You: ")
    if user_query.lower() in ["quit", "exit"]:
        print("\nGoodbye, Sir!")
        break
        
    if not user_query.strip():
        continue
        
    try:
        reply = ask_airllm(user_query)
        print(f"\nAetherMind: {reply}\n")
        print("-"*60)
    except Exception as e:
        print(f"\n[-] Inference Error: {e}")
