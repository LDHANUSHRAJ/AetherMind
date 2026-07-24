"""
AetherMind OKF Knowledge Search Engine
========================================
Indexes all .md files in knowledge/ at startup, then provides:
  - search()           — scored keyword search
  - get_prerequisites() — recursive prerequisite chain resolution
  - get_related()      — tag-overlap recommendations
"""

import re
import yaml
from pathlib import Path
from typing import Optional

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"

# filepath → {meta, body, path, relpath}
_index: dict[str, dict] = {}


# ─── Indexing ─────────────────────────────────────────────────────────────────

def _parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("---", 3)
    if end == -1:
        return {}, text
    try:
        meta = yaml.safe_load(text[3:end]) or {}
    except Exception:
        meta = {}
    body = text[end + 3:].strip()
    return meta, body


def _build_index() -> None:
    global _index
    _index = {}
    if not KNOWLEDGE_DIR.exists():
        return
    for path in KNOWLEDGE_DIR.rglob("*.md"):
        if path.name.startswith("_"):
            continue  # skip domain index files
        try:
            text = path.read_text(encoding="utf-8")
            meta, body = _parse_frontmatter(text)
            _index[str(path)] = {
                "meta": meta,
                "body": body,
                "path": str(path),
                "relpath": str(path.relative_to(KNOWLEDGE_DIR)),
            }
        except Exception:
            pass


# Index on module import (once at server startup)
_build_index()


# ─── Public helpers ───────────────────────────────────────────────────────────

def reindex() -> int:
    """Re-scan the knowledge/ directory and rebuild the in-memory index."""
    _build_index()
    return len(_index)


def get_file_count() -> int:
    return len(_index)


def get_domain_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in _index.values():
        domain = entry["meta"].get("domain", "unknown")
        counts[domain] = counts.get(domain, 0) + 1
    return counts


# ─── Search ───────────────────────────────────────────────────────────────────

def search(
    query: str,
    domain_filter: Optional[str] = None,
    max_results: int = 3,
) -> list[dict]:
    """
    Score every indexed file against the query terms and return the top results.

    Scoring:
      tag match    → 3 pts each term
      title match  → 2 pts each term
      body match   → 1 pt  each term
      domain match → 5 pt  bonus (if domain_filter provided)
    """
    terms = set(re.findall(r"\w+", query.lower()))
    if not terms:
        return []

    results = []
    for filepath, entry in _index.items():
        meta  = entry["meta"]
        body  = entry["body"]
        score = 0

        tags        = [t.lower() for t in (meta.get("tags") or [])]
        title_words = set(re.findall(r"\w+", (meta.get("title") or "").lower()))
        body_lower  = body.lower()

        for term in terms:
            if any(term in tag for tag in tags):
                score += 3
            if term in title_words:
                score += 2
            if term in body_lower:
                score += 1

        if domain_filter and meta.get("domain", "").lower() == domain_filter.lower():
            score += 5

        if score > 0:
            results.append({
                "title":    meta.get("title", Path(filepath).stem),
                "path":     filepath,
                "relpath":  entry["relpath"],
                "score":    score,
                "excerpt":  body[:500].strip(),
                "metadata": meta,
            })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:max_results]


# ─── Prerequisite resolution ──────────────────────────────────────────────────

def get_prerequisites(filepath: str) -> list[dict]:
    """
    Return the prerequisite chain for *filepath* in bottom-up learning order
    (deepest dependency first, the requested topic last).
    """
    entry = _index.get(filepath)
    if not entry:
        return []

    resolved: list[dict] = []
    seen: set[str] = set()

    def _resolve(name: str, depth: int = 0) -> None:
        if depth > 6 or name in seen:
            return
        seen.add(name)
        for fpath, e in _index.items():
            if Path(fpath).stem == name:
                for p in (e["meta"].get("prerequisites") or []):
                    _resolve(p, depth + 1)
                resolved.append({
                    "title":    e["meta"].get("title", name),
                    "path":     fpath,
                    "relpath":  e["relpath"],
                    "metadata": e["meta"],
                })
                return

    for prereq in (entry["meta"].get("prerequisites") or []):
        _resolve(prereq)

    return resolved


# ─── Related topics ───────────────────────────────────────────────────────────

def get_related(filepath: str, max_results: int = 5) -> list[dict]:
    """Return other files that share 2+ tags with the given file."""
    entry = _index.get(filepath)
    if not entry:
        return []

    own_tags = set(t.lower() for t in (entry["meta"].get("tags") or []))
    if not own_tags:
        return []

    related = []
    for fpath, e in _index.items():
        if fpath == filepath:
            continue
        other_tags = set(t.lower() for t in (e["meta"].get("tags") or []))
        overlap = len(own_tags & other_tags)
        if overlap >= 2:
            related.append({
                "title":    e["meta"].get("title", Path(fpath).stem),
                "path":     fpath,
                "relpath":  e["relpath"],
                "overlap":  overlap,
                "metadata": e["meta"],
            })

    related.sort(key=lambda r: r["overlap"], reverse=True)
    return related[:max_results]


# ─── Concept graph (Phase 4.4) ────────────────────────────────────────────────

def get_graph() -> dict:
    """Build a {nodes, edges} graph for the concept-map visualizer: one node
    per indexed OKF file, prerequisite edges + tag-overlap 'related' edges."""
    nodes = []
    edges = []
    stem_to_path = {Path(p).stem: p for p in _index}

    for filepath, entry in _index.items():
        meta = entry["meta"]
        node_id = Path(filepath).stem
        nodes.append({
            "id": node_id,
            "title": meta.get("title", node_id),
            "domain": meta.get("domain", "unknown"),
            "difficulty": meta.get("difficulty", "beginner"),
            "tags": meta.get("tags") or [],
        })
        for prereq in (meta.get("prerequisites") or []):
            if prereq in stem_to_path:
                edges.append({"from": prereq, "to": node_id, "type": "prerequisite"})

    seen_pairs = set()
    for filepath, entry in _index.items():
        node_id = Path(filepath).stem
        for rel in get_related(filepath, max_results=3):
            other_id = Path(rel["path"]).stem
            pair = tuple(sorted((node_id, other_id)))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            edges.append({"from": node_id, "to": other_id, "type": "related"})

    return {"nodes": nodes, "edges": edges}
