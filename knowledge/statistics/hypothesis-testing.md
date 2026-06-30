---
type: technique
title: "Hypothesis Testing"
domain: statistics
subdomain: inferential-statistics
tags: [hypothesis-testing, p-value, null-hypothesis, significance, t-test, statistics, inference]
prerequisites: [probability-distributions]
difficulty: intermediate
last_updated: 2026-06-30
author: AetherMind OKF
---

# Hypothesis Testing

## Definition
Hypothesis testing is a formal statistical procedure for deciding whether observed data provide enough evidence to reject a baseline assumption (the null hypothesis) in favour of an alternative. It answers: "could this result have arisen by chance?"

## Core Concept
Every hypothesis test follows the same five-step logic:

1. **State hypotheses**
   - $H_0$ (null): the default claim — "no effect", "no difference", "equal to baseline"
   - $H_1$ (alternative): what you want to detect

2. **Choose significance level $\alpha$** — the maximum acceptable probability of falsely rejecting a true $H_0$. Typically $\alpha = 0.05$ (5%).

3. **Compute the test statistic** — a number summarising how far the data are from what $H_0$ predicts. Common statistics: Z, t, $\chi^2$, F.

4. **Compute the p-value** — the probability of observing a test statistic at least as extreme as the one observed, assuming $H_0$ is true.

5. **Decision rule**:
   - If $p \leq \alpha$: **reject $H_0$** (result is statistically significant)
   - If $p > \alpha$: **fail to reject $H_0$** (insufficient evidence)

**The p-value is NOT** the probability that $H_0$ is true. It is the probability of the data (or more extreme) given $H_0$.

### Common Test Types

| Scenario | Test |
|---|---|
| One sample mean, σ known | Z-test |
| One sample mean, σ unknown | One-sample t-test |
| Two independent group means | Two-sample t-test |
| Paired measurements | Paired t-test |
| Proportions | Z-test for proportions |
| Category frequencies | Chi-square test |

## Key Formulas

**One-sample Z-test** (known $\sigma$):
$$Z = \frac{\bar{x} - \mu_0}{\sigma / \sqrt{n}}$$

**One-sample t-test** (unknown $\sigma$):
$$t = \frac{\bar{x} - \mu_0}{s / \sqrt{n}}, \quad df = n-1$$

**Two-sample t-test** (equal variances):
$$t = \frac{\bar{x}_1 - \bar{x}_2}{s_p\sqrt{\frac{1}{n_1}+\frac{1}{n_2}}}, \quad s_p = \sqrt{\frac{(n_1-1)s_1^2+(n_2-1)s_2^2}{n_1+n_2-2}}$$

**Type I error** (false positive): reject $H_0$ when it is true — probability = $\alpha$  
**Type II error** (false negative): fail to reject $H_0$ when it is false — probability = $\beta$  
**Power** = $1 - \beta$ (probability of correctly detecting a real effect)

## Examples

**Example** — A machine should fill bottles to 500 mL. A sample of $n=25$ gives $\bar{x}=497$ mL, $s=6$ mL. Is the machine under-filling? ($\alpha=0.05$, two-tailed)

$H_0: \mu = 500$, $H_1: \mu \neq 500$

$$t = \frac{497 - 500}{6/\sqrt{25}} = \frac{-3}{1.2} = -2.5$$

$df = 24$. Critical value: $t_{0.025, 24} = 2.064$.

Since $|{-2.5}| = 2.5 > 2.064$, reject $H_0$. The machine is significantly under-filling ($p \approx 0.019$).

## Common Mistakes
- **Accepting $H_0$**: You never "accept" $H_0$ — you only fail to reject it. Absence of evidence is not evidence of absence.
- **$p > 0.05$ means no effect**: It means insufficient evidence at that sample size. Increase $n$ and you may find significance.
- **Multiple comparisons inflation**: Running 20 tests at $\alpha=0.05$ expects one false positive by chance. Use Bonferroni correction: $\alpha^* = \alpha / m$.
- **One-tailed vs two-tailed**: Use two-tailed unless you had a specific directional prediction before seeing the data.

## Related Topics
- [See also: Probability Distributions](probability-distributions.md)
- [See also: Regression](regression.md)

## Practice Problems

1. $n=36$, $\bar{x}=52$, $\sigma=12$, $H_0: \mu=50$. Compute the Z-statistic.
   <details><summary>Answer</summary>$Z = (52-50)/(12/\sqrt{36}) = 2/2 = 1.0$. With $\alpha=0.05$ two-tailed (critical Z=1.96), fail to reject $H_0$.</details>

2. What is the difference between $\alpha$ and the p-value?
   <details><summary>Answer</summary>$\alpha$ is the threshold you set before the test; the p-value is computed from the data. You compare them to decide.</details>

3. A study finds $p=0.049$. What changes if $\alpha$ was set to 0.01?
   <details><summary>Answer</summary>Fail to reject $H_0$ — $0.049 > 0.01$. Significance depends entirely on the pre-chosen $\alpha$.</details>
