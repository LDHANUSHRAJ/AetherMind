import json

with open('data/aethermind_dataset.json', encoding='utf-8') as f:
    data = json.load(f)

print(f"Dataset valid: {len(data)} samples")
print(f"Last sample instruction: {data[-1]['instruction']}")
print(f"Last sample output length: {len(data[-1]['output'])} chars")
