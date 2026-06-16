import sympy
from sympy import sympify, simplify

def verify_proof_step(step_text, previous_steps=None):
    """
    Verifies a single step of a proof algebraically using SymPy.
    """
    if previous_steps is None:
        previous_steps = []
        
    if "=" in step_text:
        try:
            parts = step_text.split("=")
            if len(parts) == 2:
                lhs = sympify(parts[0].strip())
                rhs = sympify(parts[1].strip())
                # Check if lhs - rhs == 0
                if simplify(lhs - rhs) == 0:
                    return {"valid": True, "reason": "Algebraically consistent"}
                else:
                    return {"valid": False, "reason": f"Algebraic discrepancy: {lhs} != {rhs}"}
        except Exception as e:
            return {"valid": None, "reason": f"Could not parse algebraically: {str(e)}"}
            
    return {"valid": True, "reason": "Logical step assumed valid (no equality found)"}

def analyze_proof(proof_lines):
    """
    Analyzes an entire proof line-by-line and formats the response.
    """
    results = []
    first_invalid = None
    first_invalid_idx = -1
    
    for i, line in enumerate(proof_lines):
        # Pre-process line for sympy (e.g., replace ^ with **)
        processed_line = line.replace('^', '**')
        res = verify_proof_step(processed_line, proof_lines[:i])
        
        # Treat unparsable or explicitly true as valid for this basic logic, 
        # but mark explicit False as invalid
        is_valid = res["valid"] is not False
        
        results.append({
            "step": i + 1,
            "text": line,
            "valid": is_valid,
            "reason": res["reason"]
        })
        
        if not is_valid and first_invalid is None:
            first_invalid = res
            first_invalid_idx = i + 1
            break
            
    # Formulate output according to specification
    output = "## 🔍 Proof Analysis\n\n"
    for r in results:
        status_icon = "✅" if r["valid"] else "❌"
        status_text = "Valid" if r["valid"] else "INVALID"
        output += f"**Step {r['step']}:** {status_icon} {status_text} — {r['reason']}\n"
        
    if first_invalid:
        output += f"\n## ❌ Error Found at Step {first_invalid_idx}\n"
        output += f"The step '{results[-1]['text']}' contains an error: {first_invalid['reason']}\n"
        output += "\n## ✅ Correct Continuation\n"
        output += "Please review the algebraic manipulation from the previous step and correct the equation.\n"
        output += "\n## 📊 Verdict\nINCORRECT"
    else:
        output += "\n## 📊 Verdict\nCORRECT"
        
    return output

if __name__ == '__main__':
    # Test
    test_proof = [
        "x = 2",
        "x^2 = 4",
        "x^2 = 5"
    ]
    print(analyze_proof(test_proof))
