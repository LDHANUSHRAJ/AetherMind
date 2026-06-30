---
type: reference
title: "Probability Distributions"
domain: statistics
subdomain: probability
tags: [probability, distribution, normal, binomial, poisson, statistics, random-variable]
prerequisites: []
difficulty: beginner
last_updated: 2026-06-30
author: AetherMind OKF
---

# Probability Distributions

## Definition
A probability distribution describes how probabilities are assigned to the possible outcomes of a random variable. For discrete variables it lists the probability of each outcome; for continuous variables it gives a probability density function (PDF).

## Core Concept
There are two families:
- **Discrete distributions**: outcomes are countable (e.g. number of heads in 10 flips)
- **Continuous distributions**: outcomes form a continuous range (e.g. height of a person)

The key properties every distribution must satisfy:
1. All probabilities are between 0 and 1
2. All probabilities sum to 1 (discrete) or integrate to 1 (continuous)

### The Three Most Important Distributions

**1. Normal (Gaussian) Distribution** — continuous, bell-shaped, symmetric around the mean.

Describes: heights, IQ scores, measurement errors, exam scores — anything that is the sum of many small independent effects (Central Limit Theorem).

**2. Binomial Distribution** — discrete, counts successes in $n$ independent yes/no trials each with probability $p$.

Describes: number of heads in $n$ coin flips, number of defective items in a batch.

**3. Poisson Distribution** — discrete, counts events that occur at a constant average rate $\lambda$ over a fixed interval.

Describes: number of calls to a call centre per hour, number of typos per page.

## Key Formulas

**Normal Distribution** $X \sim N(\mu, \sigma^2)$
$$f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}$$
Mean = $\mu$, Variance = $\sigma^2$

**Binomial Distribution** $X \sim B(n, p)$
$$P(X = k) = \binom{n}{k} p^k (1-p)^{n-k}$$
Mean = $np$, Variance = $np(1-p)$

**Poisson Distribution** $X \sim \text{Pois}(\lambda)$
$$P(X = k) = \frac{\lambda^k e^{-\lambda}}{k!}$$
Mean = $\lambda$, Variance = $\lambda$

**Standard Normal (Z-score)**
$$Z = \frac{X - \mu}{\sigma}$$

## Examples

**Example 1 — Binomial**: A fair coin is flipped 10 times. What is the probability of exactly 6 heads?

$n=10$, $p=0.5$, $k=6$:
$$P(X=6) = \binom{10}{6}(0.5)^6(0.5)^4 = 210 \times \frac{1}{1024} \approx 0.205$$

**Example 2 — Poisson**: A website averages 3 visits per minute. What is the probability of exactly 5 visits in the next minute?

$\lambda=3$, $k=5$:
$$P(X=5) = \frac{3^5 e^{-3}}{5!} = \frac{243 \times 0.0498}{120} \approx 0.101$$

**Example 3 — Normal Z-score**: Exam scores are $N(70, 100)$ (mean 70, std 10). What fraction scores above 85?

$$Z = \frac{85-70}{10} = 1.5 \implies P(X > 85) = P(Z > 1.5) \approx 6.7\%$$

## Common Mistakes
- **Confusing variance and standard deviation**: $\sigma^2$ is variance, $\sigma$ is std dev. The normal formula uses $\sigma$ (std dev), not $\sigma^2$.
- **Using Poisson when Binomial is correct**: Poisson requires a constant rate; Binomial requires a fixed n and independent trials.
- **Forgetting to standardize**: You cannot look up probabilities in a normal table without converting to Z-scores.
- **Off-by-one in Binomial**: $P(X \leq 5)$ includes $k=0,1,2,3,4,5$. Be careful with strict vs. non-strict inequalities.

## Related Topics
- [See also: Hypothesis Testing](hypothesis-testing.md)
- [See also: Bayesian Inference](bayesian-inference.md)

## Practice Problems

1. $X \sim B(8, 0.3)$. Find $P(X = 2)$.
   <details><summary>Answer</summary>$\binom{8}{2}(0.3)^2(0.7)^6 = 28 \times 0.09 \times 0.1176 \approx 0.296$</details>

2. $X \sim \text{Pois}(2)$. Find $P(X = 0)$.
   <details><summary>Answer</summary>$e^{-2} \approx 0.135$</details>

3. Heights are $N(175, 49)$ cm. What Z-score corresponds to 168 cm?
   <details><summary>Answer</summary>$Z = (168 - 175)/7 = -1.0$</details>
