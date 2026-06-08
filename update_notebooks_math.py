import json
import os

def update_notebook(path):
    print(f"Updating notebook: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)

    # 1. Load the new dataset from json
    with open('data/aethermind_dataset.json', 'r', encoding='utf-8') as f_ds:
        dataset_content = json.load(f_ds)

    dataset_json_str = json.dumps(dataset_content, indent=2)
    # Split by line so we can insert it in cells
    dataset_lines = [line + '\n' for line in dataset_json_str.split('\n')]
    
    # Define new system prompt
    sys_prompt_text = (
        "You are AetherMind, a precise and intelligent computational AI assistant specializing in "
        "Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, and Web Development. "
        "You run locally on the user's device. You MUST strictly refuse to answer questions unrelated to "
        "Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, and Web Development. "
        "If asked an out-of-scope question, politely decline and pivot back to your expertise."
    )
    
    # 2. Iterate through all cells
    for cell in nb.get('cells', []):
        if cell.get('cell_type') == 'markdown':
            source = cell.get('source', [])
            new_source = []
            for line in source:
                line = line.replace("AI Startup Mentor", "AI Computational Assistant")
                line = line.replace("Startup Mentor", "Computational Assistant")
                line = line.replace("mentor for Indian startups", "assistant for Math, Stats, CS, Coding, Security & Web Dev")
                line = line.replace("Indian startup mentoring", "Computational Math/CS/Coding/Security/WebDev")
                line = line.replace("Startup Mentoring", "Math, Stats, CS & Web Dev")
                new_source.append(line)
            cell['source'] = new_source
            
        elif cell.get('cell_type') == 'code':
            source = cell.get('source', [])
            new_source = []
            skip_lines = 0
            
            for i, line in enumerate(source):
                if skip_lines > 0:
                    skip_lines -= 1
                    continue
                    
                # Replace system prompt definitions
                if 'system_prompt = "' in line or 'system_prompt = \\"' in line or 'system_prompt = \"' in line:
                    if 'system_prompt =' in line:
                        indent = line[:line.find('system_prompt')]
                        new_source.append(f'{indent}system_prompt = "{sys_prompt_text}"\n')
                        continue
                
                if '"content": "You are AetherMind, an elite AI startup mentor' in line:
                    indent = line[:line.find('{')]
                    new_source.append(f'{indent}{{"role": "system", "content": "{sys_prompt_text}"}},\n')
                    continue
                    
                # Detect the start of aethermind_data list definition
                if 'aethermind_data = [' in line:
                    new_source.append(line)
                    # We want to replace the list elements with our dataset_json_str
                    # Let's write the formatted dataset_content representation
                    # We will format it as a python list of dicts.
                    list_code_str = ""
                    for item in dataset_content:
                        inst = json.dumps(item['instruction'])
                        inp = json.dumps(item['input'])
                        out = json.dumps(item['output'])
                        list_code_str += f"  {{\n    \"instruction\": {inst},\n    \"input\": {inp},\n    \"output\": {out}\n  }},\n"
                    # Add without the trailing comma and include closing bracket
                    new_source.append(list_code_str.rstrip(',\n') + '\n]\n')
                    
                    # Now search for the closing bracket `]` of the original list definition in subsequent lines
                    # We skip lines in the original source until we find the closing bracket
                    j = i + 1
                    bracket_balance = 1
                    while j < len(source):
                        cur_line = source[j]
                        if '[' in cur_line:
                            bracket_balance += cur_line.count('[')
                        if ']' in cur_line:
                            bracket_balance -= cur_line.count(']')
                        j += 1
                        if bracket_balance <= 0:
                            break
                    skip_lines = j - i - 1
                    continue
                
                # Replace general keywords in strings or comments
                line_sub = line.replace("AI startup mentor", "AI Computational Assistant")
                line_sub = line_sub.replace("AI Startup Mentor", "AI Computational Assistant")
                line_sub = line_sub.replace("AI startup advisor", "AI Computational Assistant")
                line_sub = line_sub.replace("startup advisor", "AI Computational Assistant")
                line_sub = line_sub.replace("Indian startup ecosystem", "Math, Stats, CS, CyberSec, and Web Dev domains")
                line_sub = line_sub.replace("startups, business, and entrepreneurship", "Mathematics, Statistics, CS, Coding, Security, and Web Dev")
                line_sub = line_sub.replace("startups and entrepreneurship", "Mathematics, Statistics, CS, Coding, Security, and Web Dev")
                line_sub = line_sub.replace("startups, business, entrepreneurship, or technology infrastructure for startups", "Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, or Web Development")
                line_sub = line_sub.replace("startup, business, entrepreneurship, or technology infrastructure for startups", "Mathematics, Statistics, Probability, Computer Science, Coding, Cybersecurity, or Web Development")
                new_source.append(line_sub)
                
            cell['source'] = new_source

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print(f"Finished updating: {path}")

# Run update on all three notebooks
for nb_path in ['AetherMind_Finetuning.ipynb', 'AetherMind_Llama3.ipynb', 'AetherMind_Llama3_V2.ipynb']:
    if os.path.exists(nb_path):
        update_notebook(nb_path)
