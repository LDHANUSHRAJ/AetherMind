---
type: technique
title: "Chain Rule"
domain: mathematics
subdomain: calculus
tags: [derivative, calculus, differentiation, composition, chain-rule]
prerequisites: []
difficulty: beginner
last_updated: 2026-06-30
author: AetherMind OKF
---

# Chain Rule

## Definition
The chain rule is the differentiation rule for composite functions. If a function $h(x) = f(g(x))$ is a composition of two functions, then $h'(x) = f'(g(x)) \cdot g'(x)$.

## Core Concept
Think of it as peeling layers. A composite function has an "outer" function and an "inner" function. The chain rule says: **differentiate the outer function (leaving the inner alone), then multiply by the derivative of the inner function**.

The name "chain rule" comes from the fact that with multiple compositions — $f(g(h(x)))$ — you form a chain of multiplied derivatives.

Using Leibniz notation, if $y = f(u)$ and $u = g(x)$:
$$\frac{dy}{dx} = \frac{dy}{du} \cdot \frac{du}{dx}$$

This notation makes the chain rule feel like fraction cancellation (though it is not literally that — it is a formal consequence of the limit definition of the derivative).

## Key Formulas

$$\frac{d}{dx}[f(g(x))] = f'(g(x)) \cdot g'(x)$$

Common chain rule results:

| Composition | Derivative |
|---|---|
| $\sin(u)$ | $\cos(u) \cdot u'$ |
| $e^{u}$ | $e^{u} \cdot u'$ |
| $\ln(u)$ | $\frac{u'}{u}$ |
| $u^n$ | $n u^{n-1} \cdot u'$ |
| $\sqrt{u}$ | $\frac{u'}{2\sqrt{u}}$ |

## Examples

**Example 1** — Differentiate $y = \sin(x^2)$

Outer: $\sin(\cdot)$, Inner: $x^2$

$$\frac{dy}{dx} = \cos(x^2) \cdot 2x = 2x\cos(x^2)$$

**Example 2** — Differentiate $y = e^{3x+1}$

Outer: $e^{(\cdot)}$, Inner: $3x+1$

$$\frac{dy}{dx} = e^{3x+1} \cdot 3 = 3e^{3x+1}$$

**Example 3** — Differentiate $y = \ln(\cos x)$

Outer: $\ln(\cdot)$, Inner: $\cos x$

$$\frac{dy}{dx} = \frac{1}{\cos x} \cdot (-\sin x) = -\tan x$$

**Example 4** — Triple composition: $y = e^{\sin(x^2)}$

$$\frac{dy}{dx} = e^{\sin(x^2)} \cdot \cos(x^2) \cdot 2x$$

## Common Mistakes
- **Forgetting to multiply by the inner derivative**: $\frac{d}{dx}[\sin(x^2)] \neq \cos(x^2)$. You must also multiply by $2x$.
- **Differentiating the inner function incorrectly**: Take your time on complex inner functions.
- **Confusing composition with multiplication**: $\sin(x^2)$ is a composition; $\sin(x) \cdot x^2$ is a product (use the product rule for that).

## Related Topics
- [See also: Integration by Parts](integration-by-parts.md)
- [See also: Taylor Series](taylor-series.md)

## Practice Problems

1. Find $\frac{d}{dx}[(3x^2 + 1)^5]$
   <details><summary>Answer</summary>$5(3x^2+1)^4 \cdot 6x = 30x(3x^2+1)^4$</details>

2. Find $\frac{d}{dx}[\sqrt{1 - x^2}]$
   <details><summary>Answer</summary>$\frac{-x}{\sqrt{1-x^2}}$</details>

3. Find $\frac{d}{dx}[\cos^3(x)]$ (hint: write as $[\cos(x)]^3$)
   <details><summary>Answer</summary>$-3\cos^2(x)\sin(x)$</details>
