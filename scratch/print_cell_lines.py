import json

with open('AetherMind_Finetuning.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for idx, cell in enumerate(nb.get('cells', [])):
    if cell.get('cell_type') == 'code':
        source_lines = cell.get('source', [])
        source = "".join(source_lines)
        if 'aethermind_data = [' in source:
            print(f"Cell {idx}:")
            for line_idx, line in enumerate(source_lines):
                print(f"{line_idx+1:3d}: {repr(line)}")
