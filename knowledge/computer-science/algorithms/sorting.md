---
type: comparison
title: "Sorting Algorithms"
domain: computer-science
subdomain: algorithms
tags: [sorting, algorithms, complexity, merge-sort, quick-sort, bubble-sort, big-o, comparison]
prerequisites: []
difficulty: beginner
last_updated: 2026-06-30
author: AetherMind OKF
---

# Sorting Algorithms

## Definition
A sorting algorithm rearranges a sequence of elements into a defined order (usually ascending or descending). Sorting is one of the most fundamental operations in computer science — many other algorithms (binary search, merge join, deduplication) require sorted input.

## Core Concept
Sorting algorithms differ in three dimensions:
1. **Time complexity** — how fast in the best, average, and worst case
2. **Space complexity** — how much extra memory is needed
3. **Stability** — does equal-key ordering preserve the original relative order?

### The Main Algorithms

**Bubble Sort** — repeatedly swap adjacent elements that are out of order. Simple but slow. $O(n^2)$ average. Only useful for teaching.

**Selection Sort** — find the minimum, move it to position 0, repeat. Also $O(n^2)$ but makes at most $n$ swaps — useful when writes are expensive.

**Insertion Sort** — build the sorted array one item at a time, like sorting playing cards in your hand. $O(n^2)$ average but $O(n)$ on nearly-sorted data. Used as a base case inside Timsort.

**Merge Sort** — divide the array in half, recursively sort each half, then merge. Guaranteed $O(n \log n)$. Stable. Requires $O(n)$ extra space.

**Quick Sort** — pick a pivot, partition: elements less than pivot go left, greater go right, recurse. Average $O(n \log n)$, worst case $O(n^2)$ (avoided with random pivot). In-place, cache-friendly. The most commonly used sort in practice.

**Heap Sort** — build a max-heap, repeatedly extract the maximum. Guaranteed $O(n \log n)$, in-place, but not stable and not cache-friendly.

**Counting Sort / Radix Sort** — non-comparison sorts for integers in a bounded range. $O(n + k)$ where $k$ is the range. Not general-purpose.

## Key Formulas

| Algorithm | Best | Average | Worst | Space | Stable? |
|---|---|---|---|---|---|
| Bubble Sort | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | Yes |
| Selection Sort | $O(n^2)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | No |
| Insertion Sort | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | Yes |
| Merge Sort | $O(n\log n)$ | $O(n\log n)$ | $O(n\log n)$ | $O(n)$ | Yes |
| Quick Sort | $O(n\log n)$ | $O(n\log n)$ | $O(n^2)$ | $O(\log n)$ | No |
| Heap Sort | $O(n\log n)$ | $O(n\log n)$ | $O(n\log n)$ | $O(1)$ | No |

**Lower bound**: Any comparison-based sort requires at least $\Omega(n \log n)$ comparisons in the worst case. Merge/Heap/Quick Sort are all asymptotically optimal.

## Examples

**Merge Sort trace** on `[5, 2, 4, 1, 3]`:

```
Divide:  [5,2,4,1,3]
         [5,2] [4,1,3]
         [5][2] [4][1,3]
                 [4][1][3]
Merge:   [2,5]  [1,4] [3]
         [2,5]  [1,3,4]
         [1,2,3,4,5]
```

**Quick Sort partition** on `[3, 6, 8, 10, 1, 2, 1]`, pivot = 3:

After partition: `[1, 2, 1, 3, 6, 8, 10]` — pivot is in its final position.

## Common Mistakes
- **Picking Bubble Sort for real work**: It is a teaching tool. Use language built-ins (Timsort in Python, introsort in C++) for production.
- **Assuming Quick Sort is always faster**: On nearly-sorted data, a bad pivot strategy degrades to $O(n^2)$. Always use random pivot or median-of-three.
- **Ignoring stability when it matters**: Sorting by last name then by first name requires a stable sort.
- **Forgetting the recursion stack**: Quick Sort's $O(\log n)$ space is the call stack, not a separate buffer.

## Related Topics
- [See also: Searching Algorithms](searching.md)
- [See also: Complexity Classes](../theory/complexity-classes.md)

## Practice Problems

1. What is the time complexity of inserting $n$ elements one by one into an already-sorted array using Insertion Sort?
   <details><summary>Answer</summary>$O(n)$ — each insertion shifts elements, but with already-sorted input Insertion Sort is linear.</details>

2. Why can't Merge Sort be done in-place easily?
   <details><summary>Answer</summary>The merge step requires a temporary buffer to hold one half while merging, requiring $O(n)$ extra space.</details>

3. Give a case where Quick Sort degrades to $O(n^2)$.
   <details><summary>Answer</summary>Already-sorted input with pivot always chosen as the first element — every partition is maximally unbalanced.</details>
