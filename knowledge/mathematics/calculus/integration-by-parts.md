---
type: technique
title: "Integration by Parts"
domain: mathematics
subdomain: calculus
tags: [integration, calculus, antiderivative, product-rule, technique]
prerequisites: [chain-rule]
difficulty: intermediate
last_updated: 2026-06-30
author: AetherMind OKF
---

# Integration by Parts

## Definition
Integration by parts is a technique for evaluating integrals of products of functions. It reverses the product rule of differentiation and is the integral analogue of the product rule.

## Core Concept
When you need to integrate a product of two functions and substitution doesn't work, integration by parts often does. The idea is to split the integrand into two parts: one you differentiate (u) and one you integrate (dv).

Choose u and dv using the **LIATE** priority rule:
- **L**ogarithmic functions (ln x, log x)
- **I**nverse trig (arctan x, arcsin x)
- **A**lgebraic/polynomial (x², 3x, x)
- **T**rigonometric (sin x, cos x)
- **E**xponential (eˣ, 2ˣ)

Pick u from higher in the list (it should become simpler when differentiated); pick dv from lower (it should be easy to integrate).

## Key Formulas
$$\int u \, dv = uv - \int v \, du$$

For definite integrals:
$$\int_a^b u \, dv = \left[uv\right]_a^b - \int_a^b v \, du$$

## Examples

**Example 1** — Integrate $\int x e^x \, dx$

Choose: $u = x$, $dv = e^x \, dx$  
Then: $du = dx$, $v = e^x$

$$\int x e^x \, dx = x e^x - \int e^x \, dx = x e^x - e^x + C = e^x(x - 1) + C$$

**Example 2** — Integrate $\int x \ln x \, dx$

Choose: $u = \ln x$, $dv = x \, dx$ (L before A in LIATE)  
Then: $du = \frac{1}{x} dx$, $v = \frac{x^2}{2}$

$$\int x \ln x \, dx = \frac{x^2}{2} \ln x - \int \frac{x^2}{2} \cdot \frac{1}{x} \, dx = \frac{x^2}{2} \ln x - \frac{x^2}{4} + C$$

**Example 3** — Repeated application: $\int x^2 e^x \, dx$

Apply integration by parts twice:  
First pass: $u = x^2$, $dv = e^x dx$ → $x^2 e^x - 2\int x e^x dx$  
Second pass (from Example 1): $\int x e^x dx = e^x(x-1) + C$

$$\int x^2 e^x \, dx = x^2 e^x - 2e^x(x-1) + C = e^x(x^2 - 2x + 2) + C$$

## Common Mistakes
- **Wrong LIATE choice**: Choosing u = eˣ and dv = x dx creates a harder integral. Always put logs/inverse trig as u.
- **Forgetting the minus sign**: The formula is $uv \mathbf{-} \int v\,du$, not plus.
- **Not adding +C** for indefinite integrals.
- **Circular integrals**: Sometimes you get back the original integral — this is not a mistake! Add the repeated integral to both sides and solve algebraically. Example: $\int e^x \cos x \, dx$ requires this trick.

## Related Topics
- [See also: Chain Rule](chain-rule.md)
- [See also: Taylor Series](taylor-series.md)

## Practice Problems

1. Evaluate $\int x \sin x \, dx$
   <details><summary>Answer</summary>$-x\cos x + \sin x + C$</details>

2. Evaluate $\int \ln x \, dx$ (hint: write as $\int \ln x \cdot 1 \, dx$, let $u = \ln x$, $dv = dx$)
   <details><summary>Answer</summary>$x \ln x - x + C$</details>

3. Evaluate $\int x^2 \sin x \, dx$
   <details><summary>Answer</summary>$-x^2\cos x + 2x\sin x + 2\cos x + C$</details>
