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
import re
import sys
import asyncio
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from compute import detect_domain, try_compute
import knowledge_search
import mistake_tracker

# ── repo-root import (features/ lives one level up from backend/) ────────────
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from features.proof_verifier import analyze_proof

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

# ─── OKF Conceptual Query Detection ──────────────────────────────────────────

_CONCEPTUAL_RE = re.compile(
    r"\bwhat is\b|\bwhat are\b|\bexplain\b|\bhow does\b|\bhow do\b"
    r"|\bdifference between\b|\bwhen should i\b|\bwhen to use\b"
    r"|\bdefine\b|\bwhat.*formula\b|\bwhat should i study\b"
    r"|\bwhat should i learn\b|\bprerequisites?\s+for\b|\blearn.*after\b",
    re.IGNORECASE,
)

_SKIP_OKF_RE = re.compile(
    r"\bsolve\b|\bcalculate\b|\bcompute\b|\bdebug\b|\bcheck my work\b"
    r"|\bfix.*code\b|\bwrite.*function\b|\bimplement\b",
    re.IGNORECASE,
)

_GREETING_RE = re.compile(
    r"^(hi|hello|hey|thanks|thank you|yes|no|go on|continue|ok|okay|more)\b",
    re.IGNORECASE,
)


def _is_conceptual(message: str) -> bool:
    """Return True if the query is asking for a factual/conceptual explanation."""
    msg = message.strip()
    if _GREETING_RE.match(msg):
        return False
    if _SKIP_OKF_RE.search(msg):
        return False
    return bool(_CONCEPTUAL_RE.search(msg))


app = FastAPI(title="AetherMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Models ────────────────────────────────────────────────────────────
MODELS = {
    "fast":    {"name": "aethermind",     "max_tokens": 512},
    "precise": {"name": "aethermind-pro", "max_tokens": 1024},
}

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    max_tokens: int = 512
    temperature: float = 0.7
    history: list[dict] | None = None   # [{"role": "user"|"assistant", "content": "..."}]
    model_id: str = "fast"              # "fast" | "precise"


class ProofRequest(BaseModel):
    steps: list[str]   # proof lines, one equation/statement per line


class PracticeGenerateRequest(BaseModel):
    domain: str = "math"
    difficulty: str = "intermediate"   # beginner | intermediate | advanced
    topic: str | None = None


class PracticeCheckRequest(BaseModel):
    problem: str
    verified_solution: str | None = None
    student_answer: str


class FlashcardRequest(BaseModel):
    content: str          # raw text to derive flashcards from (OKF excerpt or chat transcript)
    count: int = 8


class TranslateRequest(BaseModel):
    code: str
    source_lang: str
    target_lang: str


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


# ─── Knowledge Base Endpoints ─────────────────────────────────────────────────

@app.get("/knowledge/status")
async def knowledge_status():
    """Return the current OKF index stats (file count, per-domain counts)."""
    return {
        "file_count":    knowledge_search.get_file_count(),
        "domain_counts": knowledge_search.get_domain_counts(),
    }


@app.post("/knowledge/reindex")
async def knowledge_reindex():
    """Re-scan the knowledge/ directory and rebuild the in-memory index."""
    count = knowledge_search.reindex()
    return {"indexed": count}


# ─── Proof Verifier ────────────────────────────────────────────────────────────

@app.post("/verify-proof")
async def verify_proof(req: ProofRequest):
    """Algebraically verify a multi-line proof step-by-step (SymPy-backed)."""
    try:
        result = analyze_proof(req.steps)
        return {"result": result}
    except Exception as e:
        return {"error": f"Proof verification failed: {str(e)}"}


# ─── Non-streaming Ollama helper (Phase 3/4 tool endpoints) ───────────────────

async def _ollama_complete(prompt: str, system: str | None = None, max_tokens: int = 512) -> str:
    """One-shot (non-streaming) completion, used by tool endpoints that need a
    single finished string rather than an SSE stream (practice/flashcards)."""
    payload = {
        "model": MODELS["fast"]["name"],
        "prompt": prompt,
        "system": system or SYSTEM_PROMPT,
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.4},
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "").strip()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="EX-1: Ollama is not running. Start it with: ollama serve")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Practice Problem Generator (Phase 3.2) ───────────────────────────────────

@app.post("/practice/generate")
async def practice_generate(req: PracticeGenerateRequest):
    topic_line = f"Topic: {req.topic}\n" if req.topic else ""
    problem_prompt = (
        f"Generate ONE practice problem for a student studying {req.domain}.\n"
        f"Difficulty: {req.difficulty}\n{topic_line}"
        f"Return ONLY the problem statement — no solution, no hints, no preamble."
    )
    problem = await _ollama_complete(problem_prompt, max_tokens=200)

    verified_solution = try_compute(problem) if req.domain in ("math", "stats") else None

    solution_prompt = (
        f"Problem: {problem}\n\n"
        f"{'Verified answer: ' + verified_solution if verified_solution else ''}\n\n"
        f"Provide a complete, step-by-step solution."
    )
    full_solution = await _ollama_complete(solution_prompt, max_tokens=700)

    return {
        "problem": problem,
        "domain": req.domain,
        "difficulty": req.difficulty,
        "verified_solution": verified_solution,
        "full_solution": full_solution,
    }


@app.post("/practice/check")
async def practice_check(req: PracticeCheckRequest):
    eval_prompt = (
        f"Problem: {req.problem}\n"
        + (f"Verified correct answer: {req.verified_solution}\n" if req.verified_solution else "")
        + f"Student's answer: {req.student_answer}\n\n"
        f"Judge whether the student's answer is correct. Reply with a first line of "
        f"exactly 'CORRECT' or 'INCORRECT', then a short explanation. If incorrect, "
        f"name the specific mistake (e.g. sign error, missing step, wrong formula, logic error)."
    )
    evaluation = await _ollama_complete(eval_prompt, max_tokens=350)
    is_correct = evaluation.strip().upper().startswith("CORRECT")
    error_type = None if is_correct else mistake_tracker.classify_error(evaluation)
    return {
        "is_correct": is_correct,
        "evaluation": evaluation,
        "error_type": error_type,
    }


# ─── Flashcard Generator (Phase 3.3) ───────────────────────────────────────────

@app.post("/flashcards/generate")
async def flashcards_generate(req: FlashcardRequest):
    prompt = (
        f"From the following study content, generate {req.count} flashcards.\n"
        f"Each flashcard has a short question on the front and a concise answer on the back.\n"
        f"Respond with ONLY a JSON array, no markdown fences, no commentary, in this exact "
        f'shape: [{{"front": "...", "back": "..."}}, ...]\n\n'
        f"Content:\n{req.content[:4000]}"
    )
    raw = await _ollama_complete(prompt, max_tokens=900)
    cards = _parse_json_array(raw)
    return {"cards": cards}


def _parse_json_array(raw: str) -> list[dict]:
    """Best-effort JSON extraction: the model sometimes wraps the array in
    ```json fences or adds a sentence before/after it."""
    text = raw.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("["):
                text = part
                break
    start, end = text.find("["), text.rfind("]")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    try:
        cards = json.loads(text)
        return [c for c in cards if isinstance(c, dict) and "front" in c and "back" in c]
    except Exception:
        return []


# ─── Code Translation (Phase 4.3) ──────────────────────────────────────────────

@app.post("/translate")
async def translate_code(req: TranslateRequest):
    prompt = (
        f"Translate this {req.source_lang} code to {req.target_lang}.\n\n"
        f"Source code ({req.source_lang}):\n```{req.source_lang}\n{req.code}\n```\n\n"
        f"Requirements:\n"
        f"1. Translate every function and piece of logic faithfully.\n"
        f"2. Output the translated code in a single ```{req.target_lang} fenced block.\n"
        f"3. After the code block, add a '**Changes explained:**' section listing what "
        f"changed and why (idioms, stdlib differences, etc.)."
    )

    async def gen():
        yield f"data: {json.dumps({'domain': 'coding'})}\n\n"
        async for chunk in _fallback_generate_raw(prompt, max_tokens=1200):
            yield chunk
    return StreamingResponse(gen(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def _fallback_generate_raw(prompt: str, max_tokens: int = 800) -> AsyncGenerator[str, None]:
    """Shared streaming primitive for one-shot prompt endpoints (translate)."""
    payload = {
        "model": MODELS["fast"]["name"],
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "stream": True,
        "options": {"num_predict": max_tokens, "temperature": 0.3},
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
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue
    except httpx.ConnectError:
        yield f"data: {json.dumps({'error': 'EX-1: Ollama is not running. Start it with: ollama serve'})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


# ─── Concept Map (Phase 4.4) ───────────────────────────────────────────────────

@app.get("/knowledge/graph")
async def knowledge_graph():
    return knowledge_search.get_graph()


# ─── Streaming Chat ────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    domain = detect_domain(req.message)
    computed_prefix = try_compute(req.message)

    # ── OKF route: only when not going to the computation engine ──────────────
    okf_context: str | None = None
    okf_source:  str | None = None

    if not computed_prefix and _is_conceptual(req.message):
        domain_hint = domain if domain != "general" else None
        hits = knowledge_search.search(req.message, domain_filter=domain_hint, max_results=3)
        if hits:
            best = hits[0]
            excerpt = best["excerpt"][:2000]
            okf_context = (
                f"Reference material from AetherMind knowledge base:\n\n"
                f"**{best['title']}**: {excerpt}\n\n"
                f"Using the above as verified reference, answer the student's question: "
            )
            okf_source = best["relpath"]

    # Build message list for Ollama
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if req.history:
        messages.extend(req.history[-20:])  # Last 20 turns for context

    if computed_prefix:
        user_content = (
            f"{computed_prefix}\n\n"
            f"Using the verified result above, now explain this step by step: {req.message}"
        )
    elif okf_context:
        user_content = f"{okf_context}{req.message}"
    else:
        user_content = req.message

    messages.append({"role": "user", "content": user_content})

    return StreamingResponse(
        _stream_ollama(messages, req, domain, computed_prefix, okf_source),
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
    computed_prefix: str | None,
    okf_source: str | None = None,
) -> AsyncGenerator[str, None]:
    # First event: metadata (domain, compute flag, OKF source)
    yield f"data: {json.dumps({'domain': domain, 'has_compute': computed_prefix is not None, 'okf_source': okf_source})}\n\n"

    chosen = MODELS.get(req.model_id, MODELS["fast"])
    model_name = chosen["name"]
    effective_tokens = min(req.max_tokens, chosen["max_tokens"])

    payload = {
        "model": model_name,
        "messages": messages,
        "stream": True,
        "options": {
            "num_predict": effective_tokens,
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
                    err_text = (await resp.aread()).decode(errors="ignore")
                    # EX-4: Ollama's actual OOM signal is a non-200 response whose body
                    # mentions memory (e.g. "model requires more system memory than is
                    # available") — not a Python MemoryError, which this streaming path
                    # never raises. Retry once with a smaller context before giving up.
                    if "memory" in err_text.lower() and req.max_tokens > 256:
                        async for chunk in _retry_reduced(messages, req, domain, computed_prefix, okf_source):
                            yield chunk
                        return
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
    except httpx.TimeoutException:
        # EX-4: a stalled/very slow response under a large context is the other
        # real-world symptom of resource exhaustion — retry once with less context.
        if req.max_tokens > 256:
            async for chunk in _retry_reduced(messages, req, domain, computed_prefix, okf_source):
                yield chunk
        else:
            yield f"data: {json.dumps({'error': 'Ollama request timed out.'})}\n\n"
            yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


async def _retry_reduced(
    messages: list,
    req: ChatRequest,
    domain: str,
    computed_prefix: str | None,
    okf_source: str | None,
) -> AsyncGenerator[str, None]:
    """EX-4: retry with a trimmed context (system + last user turn only) and a
    smaller token budget after a memory/timeout failure from Ollama."""
    yield f"data: {json.dumps({'warning': 'EX-4: Resource limit hit. Retrying with reduced context...'})}\n\n"
    reduced_req = req.model_copy(update={"max_tokens": min(256, req.max_tokens), "history": None})
    trimmed_messages = [messages[0], messages[-1]]
    async for chunk in _stream_ollama(trimmed_messages, reduced_req, domain, computed_prefix, okf_source):
        yield chunk


async def _fallback_generate(req, domain, computed_prefix) -> AsyncGenerator[str, None]:
    """Fallback to /api/generate if /api/chat is unavailable (older Ollama)."""
    prompt = req.message
    if computed_prefix:
        prompt = f"{computed_prefix}\n\nExplain step by step: {req.message}"

    chosen = MODELS.get(req.model_id, MODELS["fast"])
    payload = {
        "model": chosen["name"],
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
