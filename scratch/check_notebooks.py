import json
import ast

for nb_path in ['AetherMind_Finetuning.ipynb', 'AetherMind_Llama3.ipynb', 'AetherMind_Llama3_V2.ipynb']:
    print(f"Checking {nb_path}...")
    with open(nb_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    for idx, cell in enumerate(nb.get('cells', [])):
        if cell.get('cell_type') == 'code':
            source = "".join(cell.get('source', []))
            if 'aethermind_data = [' in source:
                print(f"Found code cell {idx} containing aethermind_data.")
                try:
                    ast.parse(source)
                    print("  Compiled successfully!")
                except SyntaxError as e:
                    print(f"  SyntaxError in cell {idx}: {e}")
                    # Print lines with numbers to pinpoint
                    lines = source.split('\n')
                    for line_idx, line in enumerate(lines):
                        print(f"    {line_idx+1:3d}: {line}")
