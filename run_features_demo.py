import sys
import os

# Add the root path so features can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from features.proof_verifier import analyze_proof
from features.algorithm_race import format_race_results
from features.mistake_tracker import log_mistake, get_top_mistakes, format_proactive_warning

def run_proof_demo():
    print("="*50)
    print("FEATURE 3: PROOF VERIFIER DEMO")
    print("="*50)
    test_proof = [
        "x = 2",
        "x^2 = 4",
        "x^2 = 5"
    ]
    print(f"Input Proof:\n{chr(10).join(test_proof)}\n")
    print(analyze_proof(test_proof))
    print("\n")

def run_algorithm_race_demo():
    print("="*50)
    print("FEATURE 4: ALGORITHM RACE DEMO")
    print("="*50)
    
    def bubble_sort(arr):
        a = arr.copy()
        n = len(a)
        for i in range(n):
            for j in range(0, n-i-1):
                if a[j] > a[j+1]:
                    a[j], a[j+1] = a[j+1], a[j]
        return a
        
    def builtin_sort(arr):
        return sorted(arr)
        
    test_data = list(range(100, 0, -1))
    
    approaches = [
        {
            "name": "Bubble Sort",
            "func": bubble_sort,
            "input_data": test_data,
            "big_o_time": "O(n²)",
            "big_o_space": "O(n)",
            "code_str": "def bubble_sort(arr):\n    # ... standard implementation"
        },
        {
            "name": "Built-in Sort",
            "func": builtin_sort,
            "input_data": test_data,
            "big_o_time": "O(n log n)",
            "big_o_space": "O(n)",
            "code_str": "def builtin_sort(arr):\n    return sorted(arr)"
        }
    ]
    
    print(format_race_results("Sort Array", "[100, 99, ..., 1]", approaches))
    print("\n")

def run_mistake_tracker_demo():
    print("="*50)
    print("FEATURE 6: MISTAKE PATTERN TRACKER DEMO")
    print("="*50)
    print("Logging a new mistake...")
    log_mistake('Calculus', 'Integration by Parts', 'Forgot second term', 'apply the formula to the second term')
    
    print("\nFetching top mistakes...")
    mistakes = get_top_mistakes()
    if mistakes:
        domain, mtype, count, correct = mistakes[0]
        print(format_proactive_warning(mtype, count, correct))
    print("\n")

if __name__ == '__main__':
    print("Starting AetherMind Features Demo...\n")
    try:
        run_proof_demo()
        run_algorithm_race_demo()
        run_mistake_tracker_demo()
    except Exception as e:
        print(f"Error during execution: {e}")
