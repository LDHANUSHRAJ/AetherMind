---
type: concept
title: "Trees and Binary Search Trees"
domain: computer-science
subdomain: data-structures
tags: [tree, binary-tree, BST, binary-search-tree, traversal, data-structure, recursion]
prerequisites: [recursion]
difficulty: intermediate
last_updated: 2026-06-30
author: AetherMind OKF
---

# Trees and Binary Search Trees

## Definition
A **tree** is a hierarchical data structure consisting of nodes connected by edges, with one designated **root** node. Each node (except the root) has exactly one parent and zero or more children. A **binary tree** restricts each node to at most two children (left and right). A **binary search tree (BST)** adds the invariant: for every node, all values in the left subtree are smaller, and all values in the right subtree are larger.

## Core Concept

### Tree Terminology
- **Root**: top-most node (no parent)
- **Leaf**: node with no children
- **Height**: longest path from root to a leaf
- **Depth**: distance from root to a given node
- **Subtree**: any node and all its descendants

### Binary Search Tree Invariant
For every node $N$ with value $v$:
- All nodes in `N.left` subtree have values $< v$
- All nodes in `N.right` subtree have values $> v$

This invariant enables $O(\log n)$ search, insert, and delete on a **balanced** BST.

### Tree Traversals
Four standard ways to visit every node:

| Traversal | Order | Use Case |
|---|---|---|
| **Inorder** (L, Root, R) | Sorted ascending in BST | Print sorted values |
| **Preorder** (Root, L, R) | Root before children | Copy/serialize a tree |
| **Postorder** (L, R, Root) | Children before root | Delete a tree, evaluate expressions |
| **Level-order (BFS)** | Top to bottom, left to right | Shortest path, level-by-level processing |

### Time Complexity (BST)

| Operation | Average | Worst (unbalanced) |
|---|---|---|
| Search | $O(\log n)$ | $O(n)$ |
| Insert | $O(\log n)$ | $O(n)$ |
| Delete | $O(\log n)$ | $O(n)$ |

A degenerate BST (all nodes on one side) is effectively a linked list.

**Balanced BST variants** (AVL, Red-Black, B-Tree) maintain height $O(\log n)$ automatically, guaranteeing $O(\log n)$ in the worst case.

## Key Formulas

$$\text{Height of complete binary tree with } n \text{ nodes} = \lfloor \log_2 n \rfloor$$
$$\text{Max nodes at height } h = 2^{h+1} - 1$$
$$\text{Max leaf nodes at height } h = 2^h$$

## Examples

**BST Search for 7** in the tree below:
```
        8
       / \
      3   10
     / \    \
    1   6    14
       / \   /
      4   7 13
```
Path: 8 → 3 → 6 → 7. Found in 4 comparisons.

**Inorder traversal** of above tree: 1, 3, 4, 6, 7, 8, 10, 13, 14 (sorted!)

**Python BST insert (recursive):**
```python
def insert(root, val):
    if root is None:
        return Node(val)
    if val < root.val:
        root.left = insert(root.left, val)
    elif val > root.val:
        root.right = insert(root.right, val)
    return root
```

## Common Mistakes
- **Confusing height and depth**: Height is measured from a node **down** to its deepest leaf; depth is from the **root down** to the node.
- **BST delete is complex**: Deleting a node with two children requires replacing it with either the inorder successor (smallest value in the right subtree) or inorder predecessor.
- **Unbalanced trees losing $O(\log n)$**: Inserting sorted data into a plain BST creates a linear chain. Use a self-balancing variant for production.
- **Recursion stack overflow on large trees**: Deep recursion on a degenerate tree can overflow the stack. Use iterative traversal with an explicit stack for large inputs.

## Related Topics
- [See also: Recursion](../theory/recursion.md)
- [See also: Hash Tables](hash-tables.md)
- [See also: Graph Algorithms](../algorithms/graph-algorithms.md)

## Practice Problems

1. What is the inorder traversal of a BST containing {5, 3, 7, 1, 4}?
   <details><summary>Answer</summary>1, 3, 4, 5, 7 — inorder traversal of a BST always gives sorted order.</details>

2. How many nodes can a binary tree of height 4 contain at most?
   <details><summary>Answer</summary>$2^{4+1} - 1 = 31$ nodes (a perfect binary tree).</details>

3. After deleting node 3 from the tree above, what replaces it?
   <details><summary>Answer</summary>The inorder successor of 3 is 4 (smallest value in 3's right subtree). Replace node 3's value with 4, then delete the original 4 node.</details>
