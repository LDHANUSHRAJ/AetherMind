import timeit
import tracemalloc

def benchmark(func, input_data, runs=1000):
    """
    Benchmarks execution time and peak memory usage of a function.
    """
    # Time benchmark
    time = timeit.timeit(
        lambda: func(input_data),
        number=runs
    ) / runs * 1000  # Convert to ms

    # Memory benchmark
    tracemalloc.start()
    func(input_data)
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    return {
        'avg_time_ms': round(time, 4),
        'peak_memory_kb': round(peak / 1024, 2)
    }

def format_race_results(problem_name, input_desc, approaches):
    """
    Runs a benchmark race between multiple algorithmic approaches and formats the output.
    
    approaches is a list of dicts:
    [
        {
            "name": "Approach Name",
            "func": function_to_call,
            "input_data": input_data_for_function,
            "code_str": "code as string",
            "big_o_time": "O(n)",
            "big_o_space": "O(1)"
        }, ...
    ]
    """
    output = f"## 🏁 Algorithm Race\n\n"
    output += f"**Problem:** {problem_name}\n"
    output += f"**Test Input:** {input_desc}\n\n---\n\n"
    
    results = []
    
    for i, app in enumerate(approaches):
        res = benchmark(app["func"], app["input_data"], runs=100) # Using 100 runs for slightly faster execution
        results.append({
            "name": app["name"],
            "time": res['avg_time_ms'],
            "memory": res['peak_memory_kb'],
            "big_o_time": app.get("big_o_time", "Unknown"),
            "big_o_space": app.get("big_o_space", "Unknown"),
            "code_str": app.get("code_str", "Code not provided")
        })
        
        output += f"### Approach {i+1} — {app['name']}\n"
        output += f"```python\n{app.get('code_str', '')}\n```\n"
        output += f"⏱ Time: {res['avg_time_ms']:.4f} ms\n"
        output += f"💾 Memory: {res['peak_memory_kb']:.2f} KB\n\n"
        
    output += "---\n\n"
    
    # Find winner based on minimum actual execution time
    winner = min(results, key=lambda x: x['time'])
    output += f"## 🏆 Winner: {winner['name']}\n"
    output += "This approach performed the best empirically on the given test input. Built-in implementations in Python (like Timsort or C-based functions) often outperform manual implementations due to low-level optimizations, despite having similar or even worse Big O complexity in theory.\n\n"
    
    output += "## 📊 Complexity Summary\n"
    output += "| Approach | Time (Big O) | Space | Actual Time | Winner |\n"
    output += "|---|---|---|---|---|\n"
    for r in results:
        is_winner = "✅" if r['name'] == winner['name'] else "❌"
        output += f"| {r['name']} | {r['big_o_time']} | {r['big_o_space']} | {r['time']:.4f} ms | {is_winner} |\n"
        
    return output

if __name__ == '__main__':
    # Test case
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
