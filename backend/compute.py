"""
AetherMind Verified Computation Layer
=====================================
Intercepts math/stats queries, computes exact answers via SymPy/SciPy/NumPy,
and returns a verified result string that the LLM wraps in an explanation.
"""

import re
import sympy as sp
from sympy import symbols, solve, diff, integrate, simplify, expand, factor, latex as sp_latex
from scipy import stats as scipy_stats
import numpy as np

# ─── Domain Detection ─────────────────────────────────────────────────────────

DOMAIN_KEYWORDS = {
    'stats': ['mean', 'median', 'mode', 'variance', 'standard deviation', 'std dev',
              'regression', 'chi-square', 'chi square', 't-test', 'ttest', 'correlation',
              'p-value', 'p value', 'hypothesis test', 'normal distribution', 'binomial',
              'poisson distribution', 'confidence interval', 'z-score', 'z score',
              'probability distribution', 'expected value', 'random variable'],
    'math': ['solve', 'derivative', 'differentiate', 'd/dx', 'integral', 'integrate',
             'limit', 'eigenvalue', 'determinant', 'matrix inverse', 'simplify',
             'expand', 'factor', 'prove', 'proof by', 'summation formula',
             'arithmetic series', 'geometric series'],
    'coding': ['implement', 'write a function', 'debug', 'algorithm', 'time complexity',
               'big o', 'dynamic programming', 'sort algorithm', 'binary search',
               'recursion', 'data structure', 'class', 'api', 'async'],
    'webdev': ['html', 'css', 'javascript', 'react', 'vue', 'angular', 'landing page',
               'responsive design', 'flexbox', 'css grid', 'bootstrap', 'tailwind',
               'frontend', 'backend server', 'rest api', 'express', 'node.js'],
    'security': ['vulnerability', 'exploit', 'xss', 'sql injection', 'csrf', 'buffer overflow',
                 'authentication bypass', 'privilege escalation', 'penetration test',
                 'encryption algorithm', 'hash function', 'firewall rule']
}


def detect_domain(message: str) -> str:
    msg = message.lower()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if any(k in msg for k in keywords):
            return domain
    return 'general'


# ─── Math Parser Helpers ──────────────────────────────────────────────────────

def _parse_expr(expr_str: str) -> sp.Expr | None:
    """Safely parse a string into a SymPy expression."""
    x, y, z, n, t = symbols('x y z n t')
    local_dict = {
        'x': x, 'y': y, 'z': z, 'n': n, 't': t,
        'e': sp.E, 'pi': sp.pi, 'oo': sp.oo, 'inf': sp.oo,
        'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan,
        'asin': sp.asin, 'acos': sp.acos, 'atan': sp.atan,
        'ln': sp.log, 'log': sp.log, 'exp': sp.exp,
        'sqrt': sp.sqrt, 'abs': sp.Abs,
    }
    try:
        return sp.sympify(expr_str, locals=local_dict)
    except Exception:
        return None


def _extract_after(text: str, *prefixes) -> str | None:
    """Extract the expression that follows any of the given prefix keywords."""
    text_lower = text.lower()
    for prefix in prefixes:
        idx = text_lower.find(prefix)
        if idx != -1:
            raw = text[idx + len(prefix):].strip()
            # Strip trailing punctuation and filler words
            raw = re.sub(r'(?i)\s*(with respect to \w+|\?|\.)$', '', raw).strip()
            # Handle "of <expr>" pattern
            raw = re.sub(r'^of\s+', '', raw).strip()
            return raw
    return None


# ─── Computation Functions ────────────────────────────────────────────────────

def _try_solve(message: str) -> str | None:
    x = sp.Symbol('x')
    # Pattern: "solve <expr> = <expr>" or "solve <expr>"
    eq_match = re.search(
        r'solve\s+(.+?)\s*=\s*(.+?)(?:\s+for\s+\w+)?$',
        message, re.IGNORECASE
    )
    if eq_match:
        lhs = _parse_expr(eq_match.group(1).strip())
        rhs = _parse_expr(eq_match.group(2).strip())
        if lhs is not None and rhs is not None:
            try:
                result = sp.solve(lhs - rhs, x)
                if result:
                    return f"**Exact solution (SymPy verified):** $x = {sp_latex(result[0]) if len(result) == 1 else sp_latex(result)}$"
            except Exception:
                pass
    return None


def _try_derivative(message: str) -> str | None:
    raw = _extract_after(
        message,
        'derivative of', 'differentiate', 'd/dx of', 'd/dx '
    )
    if not raw:
        return None
    # Handle "wrt" or "with respect to"
    wrt_match = re.search(r'(?:with respect to|wrt)\s+(\w)', raw, re.IGNORECASE)
    var_sym = sp.Symbol(wrt_match.group(1)) if wrt_match else sp.Symbol('x')
    if wrt_match:
        raw = raw[:wrt_match.start()].strip()

    expr = _parse_expr(raw)
    if expr is None:
        return None
    try:
        result = sp.diff(expr, var_sym)
        return f"**Derivative (SymPy verified):** $\\frac{{d}}{{d{var_sym}}}\\left({sp_latex(expr)}\\right) = {sp_latex(result)}$"
    except Exception:
        return None


def _try_integral(message: str) -> str | None:
    raw = _extract_after(message, 'integral of', 'integrate')
    if not raw:
        return None
    # Check for definite integral bounds: "from a to b"
    bounds_match = re.search(r'from\s+(-?\w+)\s+to\s+(-?\w+)', raw, re.IGNORECASE)
    if bounds_match:
        raw = raw[:bounds_match.start()].strip()
    expr = _parse_expr(raw)
    if expr is None:
        return None
    x = sp.Symbol('x')
    try:
        if bounds_match:
            a = _parse_expr(bounds_match.group(1))
            b = _parse_expr(bounds_match.group(2))
            result = sp.integrate(expr, (x, a, b))
            return f"**Definite integral (SymPy verified):** $\\int_{{{sp_latex(a)}}}^{{{sp_latex(b)}}} {sp_latex(expr)}\\, dx = {sp_latex(result)}$"
        else:
            result = sp.integrate(expr, x)
            return f"**Indefinite integral (SymPy verified):** $\\int {sp_latex(expr)}\\, dx = {sp_latex(result)} + C$"
    except Exception:
        return None


def _try_simplify(message: str) -> str | None:
    raw = _extract_after(message, 'simplify', 'expand', 'factor')
    if not raw:
        return None
    expr = _parse_expr(raw)
    if expr is None:
        return None
    msg_lower = message.lower()
    try:
        if 'expand' in msg_lower:
            result = sp.expand(expr)
        elif 'factor' in msg_lower:
            result = sp.factor(expr)
        else:
            result = sp.simplify(expr)
        return f"**Result (SymPy verified):** ${sp_latex(expr)} = {sp_latex(result)}$"
    except Exception:
        return None


def _try_stats(message: str) -> str | None:
    msg = message.lower()
    # Extract a list of numbers from the message
    numbers = re.findall(r'-?\d+(?:\.\d+)?', message)
    nums = [float(n) for n in numbers]
    if not nums:
        return None

    if 'mean' in msg:
        m = np.mean(nums)
        return f"**Computed (NumPy):** mean({nums}) = **{m:.4f}**"
    if 'median' in msg:
        m = np.median(nums)
        return f"**Computed (NumPy):** median({nums}) = **{m:.4f}**"
    if 'variance' in msg or 'var(' in msg:
        v = np.var(nums)
        return f"**Computed (NumPy):** variance({nums}) = **{v:.4f}**"
    if 'standard deviation' in msg or 'std dev' in msg or 'std(' in msg:
        s = np.std(nums)
        return f"**Computed (NumPy):** std({nums}) = **{s:.4f}**"

    return None


# ─── Public API ───────────────────────────────────────────────────────────────

def try_compute(message: str) -> str | None:
    """
    Attempt to compute an exact answer for the given message.
    Returns a formatted verified-result string, or None if not applicable.
    The result string is prepended to the Ollama prompt so the model
    explains a verified answer instead of guessing.
    """
    domain = detect_domain(message)

    if domain == 'math':
        for fn in (_try_solve, _try_derivative, _try_integral, _try_simplify):
            result = fn(message)
            if result:
                return result

    if domain == 'stats':
        result = _try_stats(message)
        if result:
            return result

    return None
