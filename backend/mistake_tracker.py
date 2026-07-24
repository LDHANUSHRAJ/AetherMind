"""
AetherMind Mistake Pattern Analyzer (Phase 3.1)
================================================
Lightweight keyword-based error classification. Given the AI's evaluation of a
student's answer (from /practice/check), guess a coarse error_type so recurring
weak spots can surface on the Dashboard/Practice page.
"""

ERROR_PATTERNS = {
    'sign_error':    ['sign error', 'negative sign', 'wrong sign', 'should be negative', 'should be positive', '-cos', '-sin'],
    'missing_step':  ['forgot', 'missing step', 'skipped', 'chain rule', 'left out', 'didn’t apply', 'did not apply'],
    'wrong_formula': ['wrong formula', 'incorrect formula', 'should use', 'used the wrong'],
    'syntax_error':  ['syntaxerror', 'indentationerror', 'nameerror', 'syntax error'],
    'logic_error':   ['off by one', 'boundary', 'edge case', 'logic error', 'infinite loop'],
}


def classify_error(evaluation_text: str) -> str | None:
    """Return a coarse error_type tag by scanning the AI's evaluation text for
    known phrases, or None if the answer looks correct / nothing matched."""
    if not evaluation_text:
        return None
    text_lower = evaluation_text.lower()
    for error_type, patterns in ERROR_PATTERNS.items():
        if any(p in text_lower for p in patterns):
            return error_type
    return None


def summarize_patterns(error_types: list[str | None]) -> list[dict]:
    """Given a list of error_type values (e.g. from recent practice attempts),
    return counts sorted descending — used to drive the proactive warning
    banner ("you've made sign errors 4 times this week")."""
    counts: dict[str, int] = {}
    for et in error_types:
        if et:
            counts[et] = counts.get(et, 0) + 1
    return sorted(
        ({'error_type': k, 'count': v} for k, v in counts.items()),
        key=lambda r: r['count'], reverse=True,
    )
