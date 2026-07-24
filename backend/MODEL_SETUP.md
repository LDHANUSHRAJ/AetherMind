# Model Setup: Serving the Fine-Tuned AetherMind Model

AetherMind's "precise" tier is meant to be the actual QLoRA fine-tuned
Llama-3 8B model trained in `AetherMind_Llama3_V2.ipynb`. There are two
supported ways to serve it, and it's important to know which one you're
actually running.

## Path A — Colab Gradio link (recommended, real fine-tuned model, ephemeral)

1. Open `AetherMind_Llama3_V2.ipynb` in Google Colab (GPU runtime: T4).
2. Runtime -> Run all. Wait for training (cells 1-6) and the Gradio launch
   (cell 7 / STEP 7) to finish (~8 minutes total).
3. Copy the public `*.gradio.live` URL printed at the bottom.
4. In the AetherMind app, go to Settings -> API Endpoint and paste that URL.

This talks directly to the in-session fine-tuned `model` object via the
`api_chat` function — it is genuinely the fine-tuned model. The catch: the
link dies when the Colab runtime disconnects/recycles, so it's not
persistent and you'll need a fresh URL each session.

## Path B — Persistent local Ollama deployment (requires a one-time export)

This lets `aethermind-pro` be served locally and persistently through
Ollama, without depending on a live Colab session. It requires exporting
the fine-tuned weights once.

1. Run the Colab notebook (`AetherMind_Llama3_V2.ipynb`) end to end,
   **including the new STEP 8 cell** at the bottom (GGUF export). This
   merges the LoRA adapter into the base model and quantizes it
   (`q4_k_m`) into a local Colab folder `aethermind-gguf/`.
2. In the Colab file browser (left sidebar), find the produced file —
   it will be named something like `unsloth.Q4_K_M.gguf` inside
   `aethermind-gguf/`.
3. Download that file, then rename it to `aethermind-llama3.gguf`.
4. Place it at `backend/aethermind-llama3.gguf` in this repo (same
   directory as `Modelfile.pro`).
5. From the `backend/` directory, build the Ollama models:
   ```
   ollama create aethermind-pro -f Modelfile.pro
   ollama create aethermind -f Modelfile
   ```
   (`Modelfile` is the stock "fast" tier — `gemma3:4b` — and needs no
   export; only `Modelfile.pro` depends on the GGUF file above.)
6. Restart `ollama serve` if it was already running, then start the
   FastAPI backend (`uvicorn main:app --reload --port 8000`).

## Important: current state without doing the above

`backend/Modelfile.pro` has `FROM ./aethermind-llama3.gguf` — a **relative
path that does not exist until you complete Path B**. If you run
`ollama create aethermind-pro -f Modelfile.pro` before placing the GGUF
file, the build will fail outright because the file is missing.

Previously this file pointed at `FROM llama3:latest`, which meant the
"precise" tier silently fell back to whatever stock `llama3:latest`
model happened to be pulled locally (or failed if it wasn't pulled at
all) — **not** the fine-tuned model, despite being labelled "Llama 3 8B
(precise)" in the UI. That has been fixed: `Modelfile.pro` now points at
the local fine-tuned export by design, so there is no silent fallback to
a stock model — you must complete the export in Path B for the
`aethermind-pro` tier to work at all.
