"""
Fix notebook source format: split the massive single-line dataset string
into proper per-line source entries for better Colab compatibility.
"""
import json
import ast

def fix_notebook(path):
    print(f"Fixing {path}...")
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)

    for idx, cell in enumerate(nb.get('cells', [])):
        if cell.get('cell_type') != 'code':
            continue
        source_lines = cell.get('source', [])
        full_source = "".join(source_lines)
        if 'aethermind_data = [' not in full_source:
            continue

        print(f"  Found data cell at index {idx}")
        # Parse the full source to verify it's valid
        try:
            ast.parse(full_source)
        except SyntaxError as e:
            print(f"  ERROR: Cell has syntax error: {e}")
            continue

        # Split into proper per-line entries
        lines = full_source.split('\n')
        new_source = []
        for i, line in enumerate(lines):
            if i < len(lines) - 1:
                new_source.append(line + '\n')
            else:
                # Last line - only add if non-empty
                if line:
                    new_source.append(line)

        cell['source'] = new_source
        print(f"  Reformatted: {len(source_lines)} entries -> {len(new_source)} lines")

        # Verify the reformatted source still compiles
        reformed = "".join(new_source)
        try:
            ast.parse(reformed)
            print(f"  Verified: reformatted cell compiles OK")
        except SyntaxError as e:
            print(f"  ERROR after reformat: {e}")
            return False

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print(f"  Saved {path}")
    return True

# Fix all three
for nb_path in ['AetherMind_Llama3_V2.ipynb', 'AetherMind_Llama3.ipynb', 'AetherMind_Finetuning.ipynb']:
    fix_notebook(nb_path)

print("\nDone! Re-upload the fixed notebook to Colab.")
