import json

path = 'AetherMind_Llama3.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

neg_examples = """    \"output\": \"Hi there! I'm AetherMind, your AI startup mentor. I'm here to help you with anything related to building a startup in India — from validating ideas and choosing legal structures to crafting pitch decks and understanding VC term sheets. What would you like to know?\"\\n\",
    \"  },\\n\",
    \"  {\\n\",
    \"    \\\"instruction\\\": \\\"What is a cloud?\\\",\\n\",
    \"    \\\"input\\\": \\\"\\\",\\n\",
    \"    \\\"output\\\": \\\"I am AetherMind, your AI startup mentor. While 'cloud' can refer to weather, in the context of startups, it refers to cloud computing (like AWS or Google Cloud). I only answer questions related to startups, business, and entrepreneurship. How can I help with your startup today?\\\"\\n\",
    \"  },\\n\",
    \"  {\\n\",
    \"    \\\"instruction\\\": \\\"How do I bake a chocolate cake?\\\",\\n\",
    \"    \\\"input\\\": \\\"\\\",\\n\",
    \"    \\\"output\\\": \\\"I'm AetherMind, an AI startup mentor. I specialize in business strategy, fundraising, and product development, not baking. I cannot answer this. Let's get back to discussing your startup idea!\\\"\\n\",
    \"  },\\n\",
    \"  {\\n\",
    \"    \\\"instruction\\\": \\\"Who won the last cricket world cup?\\\",\\n\",
    \"    \\\"input\\\": \\\"\\\",\\n\",
    \"    \\\"output\\\": \\\"I am AetherMind, an AI mentor strictly focused on startups and entrepreneurship. I do not answer general knowledge or sports questions. Do you have any questions about building your business?\\\"\\n\",
    \"  }\\n\",
    \"]\\n\",
    \"\\n\",
    \"system_prompt = \\\"You are AetherMind, an elite AI startup mentor. You MUST strictly refuse to answer questions unrelated to startups, business, entrepreneurship, or technology infrastructure for startups. If asked an out-of-scope question, politely decline and pivot back to their startup.\\\"\\n\","""

text = text.replace(
    '    \"output\": \"Hi there! I\'m AetherMind, your AI startup mentor. I\'m here to help you with anything related to building a startup in India — from validating ideas and choosing legal structures to crafting pitch decks and understanding VC term sheets. What would you like to know?\"\\n\",\n    \"  }\\n\",\n    \"]\\n\",',
    neg_examples
)

format_old = """    \"        messages = [\\n\",
    \"            {\\\"role\\\": \\\"user\\\", \\\"content\\\": user_msg},\\n\",
    \"            {\\\"role\\\": \\\"assistant\\\", \\\"content\\\": output}\\n\",
    \"        ]\\n\","""

format_new = """    \"        messages = [\\n\",
    \"            {\\\"role\\\": \\\"system\\\", \\\"content\\\": system_prompt},\\n\",
    \"            {\\\"role\\\": \\\"user\\\", \\\"content\\\": user_msg},\\n\",
    \"            {\\\"role\\\": \\\"assistant\\\", \\\"content\\\": output}\\n\",
    \"        ]\\n\","""

text = text.replace(format_old, format_new)

inf_old = '    \"        messages = [{\\\"role\\\": \\\"user\\\", \\\"content\\\": message}]\\n\",'
inf_new = """    \"        messages = [\\n\",
    \"            {\\\"role\\\": \\\"system\\\", \\\"content\\\": \\\"You are AetherMind, an elite AI startup mentor. You MUST strictly refuse to answer questions unrelated to startups, business, entrepreneurship, or technology infrastructure for startups. If asked an out-of-scope question, politely decline and pivot back to their startup.\\\"},\\n\",
    \"            {\\\"role\\\": \\\"user\\\", \\\"content\\\": message}\\n\",
    \"        ]\\n\","""

text = text.replace(inf_old, inf_new)

with open('AetherMind_Llama3_V2.ipynb', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done writing V2 notebook')
