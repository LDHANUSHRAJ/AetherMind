---
type: reference
title: "Python Fundamentals"
domain: programming
subdomain: python
tags: [python, fundamentals, variables, functions, loops, programming, beginner]
prerequisites: []
difficulty: beginner
last_updated: 2026-06-30
author: AetherMind OKF
---

# Python Fundamentals

## Definition
Python is a high-level, dynamically typed, interpreted programming language designed for readability. It uses indentation (whitespace) to delimit code blocks instead of braces. Python is the dominant language in data science, machine learning, scripting, and web back-ends.

## Core Concept

### Variables and Types
Python infers types dynamically — no type declarations needed.

```python
x = 42          # int
pi = 3.14159    # float
name = "Alice"  # str
flag = True     # bool
nums = [1,2,3]  # list (mutable)
pair = (1, 2)   # tuple (immutable)
d = {"a": 1}    # dict
s = {1, 2, 3}   # set
```

### Control Flow
```python
if x > 0:
    print("positive")
elif x == 0:
    print("zero")
else:
    print("negative")

for i in range(5):      # 0,1,2,3,4
    print(i)

while x > 0:
    x -= 1
```

### Functions
```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

# Arbitrary positional args
def total(*args):
    return sum(args)

# Arbitrary keyword args
def config(**kwargs):
    for k, v in kwargs.items():
        print(f"{k}={v}")
```

### List Comprehensions
Concise way to build lists:
```python
squares = [x**2 for x in range(10)]
evens   = [x for x in range(20) if x % 2 == 0]
matrix  = [[i*j for j in range(3)] for i in range(3)]
```

### Common Built-ins
```python
len([1,2,3])       # 3
range(start, stop, step)
sorted([3,1,2])    # [1,2,3]
enumerate(lst)     # (index, value) pairs
zip(a, b)          # pair elements
map(fn, iterable)  # apply fn lazily
filter(fn, it)     # keep where fn is True
```

## Key Formulas

**String formatting (f-strings)**:
```python
f"value is {x:.2f}"   # 2 decimal places
f"{'text':>10}"        # right-align in 10-wide field
```

**Slice notation** `lst[start:stop:step]`:
```python
lst[::2]     # every other element
lst[::-1]    # reversed
lst[1:4]     # indices 1,2,3
```

**Lambda (anonymous function)**:
```python
square = lambda x: x**2
sorted(pairs, key=lambda p: p[1])  # sort by second element
```

## Examples

**Example 1** — FizzBuzz:
```python
for i in range(1, 101):
    if i % 15 == 0: print("FizzBuzz")
    elif i % 3 == 0: print("Fizz")
    elif i % 5 == 0: print("Buzz")
    else: print(i)
```

**Example 2** — Fibonacci with a generator:
```python
def fib():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

gen = fib()
first10 = [next(gen) for _ in range(10)]  # [0,1,1,2,3,5,8,13,21,34]
```

**Example 3** — Count word frequencies:
```python
from collections import Counter
words = "the cat sat on the mat the cat".split()
freq = Counter(words)  # Counter({'the': 3, 'cat': 2, ...})
```

## Common Mistakes
- **Mutable default argument**: `def f(lst=[])` — the list is shared across all calls. Use `def f(lst=None): if lst is None: lst = []`
- **`is` vs `==`**: `is` checks identity (same object); `==` checks equality (same value). Use `==` for value comparison.
- **Off-by-one in `range`**: `range(n)` gives 0 to n-1. `range(1, n+1)` gives 1 to n.
- **Modifying a list while iterating over it**: Leads to skipped elements. Iterate over a copy: `for x in lst[:]`.
- **Integer division**: `7 / 2 = 3.5` (float), `7 // 2 = 3` (integer floor division).

## Related Topics
- [See also: Python OOP](oop.md)
- [See also: Common Patterns](common-patterns.md)

## Practice Problems

1. Write a one-line list comprehension that returns all prime numbers up to 50.
   <details><summary>Answer</summary>`[n for n in range(2,51) if all(n%i!=0 for i in range(2,int(n**0.5)+1))]`</details>

2. What does `[0] * 3` produce? What about `[[0]*3]*3`?
   <details><summary>Answer</summary>`[0,0,0]`. But `[[0]*3]*3` creates three references to the **same** inner list — mutating one mutates all. Use `[[0]*3 for _ in range(3)]` instead.</details>

3. How do you swap two variables in Python without a temp variable?
   <details><summary>Answer</summary>`a, b = b, a` — Python evaluates the right side fully before assigning.</details>
