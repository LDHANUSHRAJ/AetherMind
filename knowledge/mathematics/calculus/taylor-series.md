---
type: concept
title: "Taylor Series"
domain: mathematics
subdomain: calculus
tags: [series, calculus, taylor, maclaurin, approximation]
prerequisites: [derivatives]
difficulty: advanced
last_updated: 2026-07-24
author: AetherMind OKF
---

# Taylor Series

## Definition
A Taylor series is an infinite sum of terms that are expressed in terms of the function's derivatives at a single point. 

For a real or complex-valued function $f(x)$ that is infinitely differentiable at a real or complex number $a$, the Taylor series is:
$$ f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!} (x - a)^n $$
Where $f^{(n)}(a)$ denotes the $n$-th derivative of $f$ evaluated at the point $a$.

When $a = 0$, the series is called a **Maclaurin series**.

## Core Concept
The idea behind a Taylor series is to approximate a complex function with a polynomial, which is much easier to evaluate, differentiate, and integrate. By matching the function's value and its derivatives at a point $a$, the polynomial "mimics" the behavior of the function near $a$. 

As you add more terms (higher degree polynomials), the approximation becomes more accurate over a wider interval around $a$.

## Common Maclaurin Series

| Function | Series | Convergence Interval |
|---|---|---|
| $e^x$ | $\sum_{n=0}^{\infty} \frac{x^n}{n!} = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \dots$ | $(-\infty, \infty)$ |
| $\sin(x)$ | $\sum_{n=0}^{\infty} \frac{(-1)^n}{(2n+1)!} x^{2n+1} = x - \frac{x^3}{3!} + \frac{x^5}{5!} - \dots$ | $(-\infty, \infty)$ |
| $\cos(x)$ | $\sum_{n=0}^{\infty} \frac{(-1)^n}{(2n)!} x^{2n} = 1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \dots$ | $(-\infty, \infty)$ |
| $\frac{1}{1-x}$ | $\sum_{n=0}^{\infty} x^n = 1 + x + x^2 + x^3 + \dots$ | $(-1, 1)$ |
| $\ln(1+x)$ | $\sum_{n=1}^{\infty} \frac{(-1)^{n-1}}{n} x^n = x - \frac{x^2}{2} + \frac{x^3}{3} - \dots$ | $(-1, 1]$ |

## Example: Approximating with Taylor Polynomials
To approximate $\sin(x)$ near $x=0$ with a 3rd degree Maclaurin polynomial ($T_3(x)$):
$$ T_3(x) = x - \frac{x^3}{3!} = x - \frac{x^3}{6} $$
If we want to estimate $\sin(0.1)$:
$$ \sin(0.1) \approx 0.1 - \frac{0.1^3}{6} = 0.1 - \frac{0.001}{6} \approx 0.099833 $$
The actual value is $0.0998334...$, showing that even a few terms provide a very accurate approximation near the center point.

## Related Topics
- [See also: Chain Rule](chain-rule.md)
