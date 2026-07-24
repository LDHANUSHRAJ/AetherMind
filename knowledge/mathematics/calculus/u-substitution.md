---
type: technique
title: "U-Substitution"
domain: mathematics
subdomain: calculus
tags: [integration, calculus, u-substitution, antiderivative]
prerequisites: [chain-rule]
difficulty: intermediate
last_updated: 2026-07-24
author: AetherMind OKF
---

# U-Substitution

## Definition
U-substitution (or integration by substitution) is a technique for evaluating integrals. It is the reverse of the chain rule for differentiation.

If $u = g(x)$ is a differentiable function whose range is an interval $I$, and $f$ is continuous on $I$, then:
$$ \int f(g(x)) g'(x) \, dx = \int f(u) \, du $$

## Core Concept
The goal of u-substitution is to transform a complicated integral into a simpler one by substituting a part of the integrand with a new variable, typically $u$.

You want to look for a function $g(x)$ inside the integral whose derivative $g'(x)$ is also present (up to a constant multiple) in the integrand.

## Steps
1. **Choose u**: Let $u = g(x)$, where $g(x)$ is an "inner" function.
2. **Find du**: Compute $du = g'(x) \, dx$.
3. **Substitute**: Replace $g(x)$ with $u$ and $g'(x) \, dx$ with $du$.
4. **Integrate**: Evaluate the simpler integral $\int f(u) \, du$.
5. **Back-substitute**: Replace $u$ back with $g(x)$ to get the final answer in terms of $x$ (for indefinite integrals).

## Examples

**Example 1** — Evaluate $\int 2x \cos(x^2) \, dx$

1. Let $u = x^2$.
2. Then $du = 2x \, dx$.
3. Substitute: $\int \cos(u) \, du$.
4. Integrate: $\sin(u) + C$.
5. Back-substitute: $\sin(x^2) + C$.

**Example 2** — Evaluate $\int x e^{x^2} \, dx$

1. Let $u = x^2$.
2. Then $du = 2x \, dx$, which means $\frac{1}{2} du = x \, dx$.
3. Substitute: $\int \frac{1}{2} e^u \, du$.
4. Integrate: $\frac{1}{2} e^u + C$.
5. Back-substitute: $\frac{1}{2} e^{x^2} + C$.

## Common Mistakes
- **Forgetting the $+ C$**: Always add the constant of integration for indefinite integrals.
- **Forgetting to back-substitute**: If the problem starts in $x$, the answer must be in $x$.
- **Not changing the bounds for definite integrals**: If you don't back-substitute, you must evaluate the new integral at $u(a)$ and $u(b)$ instead of $a$ and $b$.

## Practice Problems

1. Find $\int 3x^2(x^3+1)^4 \, dx$
   <details><summary>Answer</summary>$\frac{1}{5}(x^3+1)^5 + C$</details>

2. Find $\int \frac{\ln(x)}{x} \, dx$
   <details><summary>Answer</summary>$\frac{1}{2}(\ln(x))^2 + C$</details>
