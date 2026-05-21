import json

path = 'AetherMind_Llama3.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Find the dataset cell (index 4)
dataset_cell = nb['cells'][4]

# The original source is a list of strings
source = dataset_cell['source']

new_source = []
system_prompt_str = "system_prompt = \"You are AetherMind, an elite AI startup mentor. You MUST strictly refuse to answer questions unrelated to startups, business, entrepreneurship, or technology infrastructure for startups. If asked an out-of-scope question, politely decline and pivot back to their startup.\"\n"

for i, line in enumerate(source):
    # Find the end of the aethermind_data list
    if line.strip() == "]":
        # Insert negative examples before the closing bracket
        # The previous line is the end of a dict, so we need a comma
        new_source[-1] = new_source[-1].rstrip('\n') + ",\n"
        
        neg_examples = [
            "  {\n",
            "    \"instruction\": \"What is a cloud?\",\n",
            "    \"input\": \"\",\n",
            "    \"output\": \"I am AetherMind, your AI startup mentor. While 'cloud' can refer to weather, in the context of startups, it refers to cloud computing (like AWS or Google Cloud). I only answer questions related to startups, business, and entrepreneurship. How can I help with your startup today?\"\n",
            "  },\n",
            "  {\n",
            "    \"instruction\": \"How do I bake a chocolate cake?\",\n",
            "    \"input\": \"\",\n",
            "    \"output\": \"I'm AetherMind, an AI startup mentor. I specialize in business strategy, fundraising, and product development, not baking. I cannot answer this. Let's get back to discussing your startup idea!\"\n",
            "  },\n",
            "  {\n",
            "    \"instruction\": \"Who won the last cricket world cup?\",\n",
            "    \"input\": \"\",\n",
            "    \"output\": \"I am AetherMind, an AI mentor strictly focused on startups and entrepreneurship. I do not answer general knowledge or sports questions. Do you have any questions about building your business?\"\n",
            "  }\n"
        ]
        new_source.extend(neg_examples)
        new_source.append("]\n\n")
        new_source.append(system_prompt_str + "\n")
    elif "{\"role\": \"user\", \"content\": user_msg}," in line:
        # Add system prompt role before user role
        new_source.append("            {\"role\": \"system\", \"content\": system_prompt},\n")
        new_source.append(line)
    else:
        new_source.append(line)

dataset_cell['source'] = new_source

# Also fix the inference cell (index 7)
inference_cell = nb['cells'][7]
inf_source = inference_cell['source']
new_inf_source = []
for line in inf_source:
    if "messages = [{\"role\": \"user\", \"content\": message}]" in line:
        new_inf_source.extend([
            "        messages = [\n",
            "            {\"role\": \"system\", \"content\": \"You are AetherMind, an elite AI startup mentor. You MUST strictly refuse to answer questions unrelated to startups, business, entrepreneurship, or technology infrastructure for startups. If asked an out-of-scope question, politely decline and pivot back to their startup.\"},\n",
            "            {\"role\": \"user\", \"content\": message}\n",
            "        ]\n"
        ])
    else:
        new_inf_source.append(line)

inference_cell['source'] = new_inf_source

with open('AetherMind_Llama3_V2.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("Notebook fixed!")
