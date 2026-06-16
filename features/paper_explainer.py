import re

def extract_paper(pdf_path: str) -> dict:
    """
    Extracts text, equations, and citations from a PDF.
    """
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
    except ImportError:
        print("PyMuPDF (fitz) is not installed.")
        return None
    except Exception as e:
        print(f"Error opening PDF: {e}")
        return None
        
    equations = []
    citations = []
    full_text = ""

    for page in doc:
        text = page.get_text("text")
        full_text += text + "\n"

        # Extract equations (lines with =, ∑, ∫, ∂, →)
        for line in text.split('\n'):
            if any(sym in line for sym in ['=', '∑', '∫', '∂', '→']):
                # Only grab relatively short lines to avoid grabbing full paragraphs
                if len(line.strip()) < 80:
                    equations.append(line.strip())

        # Extract citations [n]
        refs = re.findall(r'\[(\d+)\]', text)
        citations.extend(refs)

    return {
        'text': full_text,
        'equations': equations,
        'citations': list(set(citations))
    }

def verify_equation(equation_str: str) -> dict:
    """
    Attempts to verify an algebraic equation using SymPy.
    """
    try:
        from sympy import sympify, simplify
        # Split on = sign
        parts = equation_str.split('=')
        if len(parts) == 2:
            # Preprocess common issues
            clean_lhs = parts[0].strip().replace('^', '**')
            clean_rhs = parts[1].strip().replace('^', '**')
            
            lhs = sympify(clean_lhs)
            rhs = sympify(clean_rhs)
            diff = simplify(lhs - rhs)
            is_verified = (diff == 0)
            return {
                'verified': is_verified,
                'equation': equation_str,
                'note': 'Algebraically consistent' if is_verified else f'Discrepancy: {diff}'
            }
        else:
            return {
                'verified': None,
                'equation': equation_str,
                'note': 'No simple equality to verify'
            }
    except ImportError:
        return {
            'verified': None,
            'equation': equation_str,
            'note': 'SymPy not installed'
        }
    except Exception as e:
        return {
            'verified': None,
            'equation': equation_str,
            'note': 'Cannot verify symbolically'
        }

def format_paper_explanation(title, authors, year, abstract, sections, extraction_results):
    """
    Formats the final output for the Research Paper Explainer.
    """
    output = f"## 📄 Paper: {title}\n"
    output += f"**Authors:** {authors} | **Year:** {year}\n\n---\n\n"
    
    output += f"## 📋 Abstract — Plain English\n"
    output += f"{abstract}\n\n---\n\n"
    
    output += f"## 📖 Section by Section\n\n"
    for sec_title, sec_content in sections.items():
        output += f"### {sec_title}\n{sec_content}\n\n"
        
    output += "---\n\n"
    output += "## 🔢 Equations Found & Verified\n\n"
    output += "| Equation | Status | Note |\n"
    output += "|---|---|---|\n"
    
    # Process equations up to a limit
    for eq in extraction_results.get('equations', [])[:15]: 
        res = verify_equation(eq)
        if res['verified'] is True:
            status = "✅ Verified"
        elif res['verified'] is False:
            status = "❌ Inconsistent"
        else:
            status = "⚠️ Cannot verify"
            
        # Escape pipes in markdown table
        clean_eq = eq.replace('|', '\\|')
        output += f"| {clean_eq} | {status} | {res['note']} |\n"
        
    output += "\n---\n\n"
    output += "## 📚 Citations Referenced\n"
    citations = extraction_results.get('citations', [])
    if citations:
        # Sort numerically
        sorted_citations = sorted(citations, key=lambda x: int(x) if x.isdigit() else 0)
        citations_str = ", ".join([f"[{c}]" for c in sorted_citations])
        output += f"{citations_str} — all preserved from original\n"
    else:
        output += "No standard [n] citations found.\n"
        
    output += "\n---\n\n"
    output += "## 💡 Key Takeaway\n"
    output += "This paper contributes interesting findings to its field. The verified equations can be integrated safely, but ensure that any unverified claims are contextually understood.\n"
    
    return output

if __name__ == '__main__':
    # Test
    extraction = {
        'equations': ['x = 2', 'x^2 = 4', 'y = a*x + b'],
        'citations': ['1', '2', '12', '5']
    }
    
    sections = {
        'Introduction': 'The paper introduces a novel concept...',
        'Methodology': 'The authors used a mixed-methods approach...'
    }
    
    print(format_paper_explanation(
        "AetherMind Research", 
        "Smith et al.", 
        "2026", 
        "A study on AI learning patterns.", 
        sections, 
        extraction
    ))
