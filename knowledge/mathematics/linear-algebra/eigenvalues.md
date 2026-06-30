---
type: concept
title: "Eigenvalues and Eigenvectors"
domain: mathematics
subdomain: linear-algebra
tags: [eigenvalue, eigenvector, linear-algebra, matrix, determinant, characteristic-polynomial]
prerequisites: [matrix-operations]
difficulty: intermediate
last_updated: 2026-06-30
author: AetherMind OKF
---

# Eigenvalues and Eigenvectors

## Definition
Given a square matrix $A$, a non-zero vector $\mathbf{v}$ is an **eigenvector** of $A$ with **eigenvalue** $\lambda$ if multiplying $A$ by $\mathbf{v}$ only scales the vector — it does not change its direction:
$$A\mathbf{v} = \lambda\mathbf{v}$$

## Core Concept
Geometrically, most vectors get rotated when a matrix is applied to them. Eigenvectors are the special directions that only get stretched or shrunk (by the factor $\lambda$), never rotated. They are the "backbone" directions of the linear transformation.

**Finding eigenvalues** — rearrange the definition:
$$A\mathbf{v} = \lambda\mathbf{v} \implies (A - \lambda I)\mathbf{v} = \mathbf{0}$$

For a non-zero solution $\mathbf{v}$ to exist, the matrix $(A - \lambda I)$ must be singular (non-invertible), so its determinant must be zero:
$$\det(A - \lambda I) = 0$$

This is called the **characteristic equation**. Solving it gives the eigenvalues $\lambda_1, \lambda_2, \ldots$

**Finding eigenvectors** — once $\lambda$ is known, substitute back and solve $(A - \lambda I)\mathbf{v} = \mathbf{0}$ for $\mathbf{v}$.

## Key Formulas

$$\det(A - \lambda I) = 0 \quad \text{(characteristic equation)}$$

For a $2 \times 2$ matrix $A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$:

$$\lambda^2 - (a+d)\lambda + (ad - bc) = 0$$
$$\lambda^2 - \text{tr}(A)\lambda + \det(A) = 0$$

**Key properties:**
- The **trace** (sum of diagonal) equals the sum of eigenvalues: $\text{tr}(A) = \sum \lambda_i$
- The **determinant** equals the product of eigenvalues: $\det(A) = \prod \lambda_i$
- The **characteristic polynomial** of an $n \times n$ matrix has degree $n$, giving up to $n$ eigenvalues

## Examples

**Example** — Find eigenvalues and eigenvectors of $A = \begin{pmatrix} 4 & 1 \\ 2 & 3 \end{pmatrix}$

**Step 1** — Characteristic equation:
$$\det\begin{pmatrix} 4-\lambda & 1 \\ 2 & 3-\lambda \end{pmatrix} = (4-\lambda)(3-\lambda) - 2 = 0$$
$$\lambda^2 - 7\lambda + 10 = 0 \implies (\lambda-5)(\lambda-2) = 0$$
$$\lambda_1 = 5, \quad \lambda_2 = 2$$

**Step 2** — Eigenvector for $\lambda_1 = 5$:
$$(A - 5I)\mathbf{v} = \begin{pmatrix} -1 & 1 \\ 2 & -2 \end{pmatrix}\mathbf{v} = \mathbf{0} \implies \mathbf{v}_1 = \begin{pmatrix} 1 \\ 1 \end{pmatrix}$$

**Step 3** — Eigenvector for $\lambda_2 = 2$:
$$(A - 2I)\mathbf{v} = \begin{pmatrix} 2 & 1 \\ 2 & 1 \end{pmatrix}\mathbf{v} = \mathbf{0} \implies \mathbf{v}_2 = \begin{pmatrix} 1 \\ -2 \end{pmatrix}$$

**Verification:** $\det(A) = 12 - 2 = 10 = 5 \times 2$ ✓, $\text{tr}(A) = 7 = 5 + 2$ ✓

## Common Mistakes
- **Setting det(A) = 0 instead of det(A − λI) = 0**: You must subtract λ from the diagonal.
- **Giving a specific eigenvector when any scalar multiple works**: Eigenvectors form a subspace; any non-zero multiple is equally valid.
- **Complex eigenvalues**: Real matrices can have complex eigenvalues (they come in conjugate pairs). This is normal.
- **Repeated eigenvalues**: A repeated eigenvalue may have fewer independent eigenvectors than its multiplicity (defective matrix).

## Related Topics
- [See also: Matrix Operations](matrix-operations.md)
- [See also: Vector Spaces](vector-spaces.md)

## Practice Problems

1. Find eigenvalues of $B = \begin{pmatrix} 3 & 0 \\ 0 & -1 \end{pmatrix}$
   <details><summary>Answer</summary>$\lambda_1 = 3$, $\lambda_2 = -1$ (diagonal matrix — eigenvalues are the diagonal entries)</details>

2. Find eigenvalues of $C = \begin{pmatrix} 2 & 1 \\ -1 & 4 \end{pmatrix}$
   <details><summary>Answer</summary>$\lambda^2 - 6\lambda + 9 = 0$, so $\lambda = 3$ (repeated)</details>

3. What does a zero eigenvalue tell you about the matrix?
   <details><summary>Answer</summary>The matrix is singular (non-invertible) — det(A) = 0 since the product of eigenvalues is zero.</details>
