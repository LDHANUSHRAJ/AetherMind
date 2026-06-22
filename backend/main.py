"""
AetherMind FastAPI Backend
==========================
Serves the chat API with:
  - Domain detection
  - Verified computation (SymPy/SciPy/NumPy) via compute.py
  - Streaming responses from Ollama
  - EX-1 / EX-4 resilience handling

Run: uvicorn main:app --reload --port 8000
"""

import json
import os
import asyncio
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from compute import detect_domain, try_compute

# ─── Config ───────────────────────────────────────────────────────────────────
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.environ.get("OLLAMA_MODEL", "aethermind")

SYSTEM_PROMPT = (
    "You are AetherMind, an advanced AI assistant specialized in mathematics, "
    "statistics, computer science, and secure coding. "
    "You provide step-by-step solutions with formal verification. "
    "Format math using LaTeX: $inline$ or $$display$$. "
    "Format code in triple-backtick blocks with the language tag. "
    "You never guess on numerical calculations — you compute."
)

app = FastAPI(title="AetherMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    max_tokens: int = 2048
    temperature: float = 0.7
    history: list[dict] | None = None   # [{"role": "user"|"assistant", "content": "..."}]


# ─── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Check if Ollama is reachable and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
                model_ready = any(MODEL_NAME in m for m in models)
                return {
                    "status": "ok",
                    "ollama": "reachable",
                    "model": MODEL_NAME,
                    "model_ready": model_ready,
                    "available_models": models
                }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable: {str(e)}")


# ─── Streaming Chat ────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    domain = detect_domain(req.message)
    computed_prefix = try_compute(req.message)

    # Build message list for Ollama
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if req.history:
        messages.extend(req.history[-20:])  # Last 20 turns for context

    user_content = req.message
    if computed_prefix:
        user_content = (
            f"{computed_prefix}\n\n"
            f"Using the verified result above, now explain this step by step: {req.message}"
        )

    messages.append({"role": "user", "content": user_content})

    return StreamingResponse(
        _stream_ollama(messages, req, domain, computed_prefix),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


async def _stream_ollama(
    messages: list,
    req: ChatRequest,
    domain: str,
    computed_prefix: str | None
) -> AsyncGenerator[str, None]:
    # First event: metadata (domain, computed flag)
    yield f"data: {json.dumps({'domain': domain, 'has_compute': computed_prefix is not None})}\n\n"

    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": True,
        "options": {
            "num_predict": req.max_tokens,
            "temperature": req.temperature,
        }
    }

    total_tokens = 0

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_URL}/api/chat",
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    err_text = await resp.aread()
                    # Fallback: try /api/generate with plain prompt
                    async for chunk in _fallback_generate(req, domain, computed_prefix):
                        yield chunk
                    return

                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            total_tokens += 1
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if data.get("done"):
                            yield f"data: {json.dumps({'done': True, 'tokens': total_tokens, 'domain': domain})}\n\n"
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue

    except httpx.ConnectError:
        yield f"data: {json.dumps({'error': 'EX-1: Ollama is not running. Start it with: ollama serve'})}\n\n"
        yield "data: [DONE]\n\n"
    except MemoryError:
        # EX-4: Memory overflow — retry with reduced tokens
        yield f"data: {json.dumps({'warning': 'EX-4: Memory limit hit. Retrying with reduced context...'})}\n\n"
        reduced_req = ChatRequest(
            message=req.message,
            max_tokens=min(512, req.max_tokens),
            temperature=req.temperature,
            history=None
        )
        async for chunk in _stream_ollama([messages[0], messages[-1]], reduced_req, domain, computed_prefix):
            yield chunk
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


async def _fallback_generate(req, domain, computed_prefix) -> AsyncGenerator[str, None]:
    """Fallback to /api/generate if /api/chat is unavailable (older Ollama)."""
    prompt = req.message
    if computed_prefix:
        prompt = f"{computed_prefix}\n\nExplain step by step: {req.message}"

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "stream": True,
        "options": {
            "num_predict": req.max_tokens,
            "temperature": req.temperature,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", f"{OLLAMA_URL}/api/generate", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("response", "")
                        if token:
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if data.get("done"):
                            yield f"data: {json.dumps({'done': True, 'domain': domain})}\n\n"
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
