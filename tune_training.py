import json
import os

def tune_notebook(path):
    print(f"Tuning notebook: {path}")
    if not os.path.exists(path):
        print(f"Skipping: {path} (not found)")
        return
        
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)

    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'code':
            source = cell.get('source', [])
            new_source = []
            for line in source:
                # 1. Boost LoRA Rank & Alpha
                if 'r = 16' in line:
                    line = line.replace('r = 16', 'r = 32')
                if 'lora_alpha = 16' in line:
                    line = line.replace('lora_alpha = 16', 'lora_alpha = 32')
                
                # 2. Boost max steps
                if 'max_steps = 25' in line:
                    line = line.replace('max_steps = 25', 'max_steps = 60')
                
                # 3. Boost Learning Rate
                if 'learning_rate = 5e-5' in line:
                    line = line.replace('learning_rate = 5e-5', 'learning_rate = 2e-4')
                
                new_source.append(line)
            cell['source'] = new_source

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print(f"Finished tuning: {path}")

if __name__ == '__main__':
    for nb_path in ['AetherMind_Finetuning.ipynb', 'AetherMind_Llama3.ipynb', 'AetherMind_Llama3_V2.ipynb']:
        tune_notebook(nb_path)
