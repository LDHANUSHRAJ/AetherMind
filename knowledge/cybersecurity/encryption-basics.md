---
type: concept
title: "Encryption Basics"
domain: cybersecurity
subdomain: cryptography
tags: [encryption, cryptography, symmetric, asymmetric, AES, RSA, hashing, cybersecurity, security]
prerequisites: []
difficulty: beginner
last_updated: 2026-06-30
author: AetherMind OKF
---

# Encryption Basics

## Definition
Encryption is the process of transforming readable data (plaintext) into an unreadable form (ciphertext) using a mathematical algorithm and a key, such that only parties with the correct key can reverse the transformation. It is the foundation of data confidentiality.

## Core Concept

### Three Cryptographic Primitives

**1. Symmetric Encryption** — the same key encrypts and decrypts.

Fast — suitable for bulk data. Problem: how do you securely share the key?

- **AES (Advanced Encryption Standard)**: the current standard. Block cipher with 128, 192, or 256-bit keys. Used in TLS, disk encryption, VPNs.
- **ChaCha20**: stream cipher alternative to AES, efficient on devices without hardware AES acceleration.

**2. Asymmetric Encryption** — a mathematically linked key pair: a **public key** (shared freely) and a **private key** (kept secret). Anything encrypted with the public key can only be decrypted with the private key, and vice versa.

Slow — only used for small data or to exchange symmetric keys.

- **RSA**: based on the difficulty of factoring large integers. Common key sizes: 2048 or 4096 bits.
- **ECC (Elliptic Curve Cryptography)**: smaller keys with equivalent security. ECDH and ECDSA are common.

**3. Cryptographic Hash Functions** — one-way transformation. No key, not reversible. Given the same input, always produces the same fixed-length output.

Used for: password storage, data integrity checks, digital signatures.

- **SHA-256**: 256-bit output. Standard for most uses.
- **bcrypt / Argon2**: slow-by-design password hashing functions. Never store passwords with SHA-256 alone.
- **MD5 / SHA-1**: **broken** for security purposes — collision attacks exist. Do not use.

### How TLS Uses All Three

```
1. Client connects → server sends its public key (in a certificate)
2. Client verifies certificate against a trusted CA
3. Client generates a random session key (symmetric)
4. Client encrypts session key with server's public key → sends it
5. Both sides now share the session key → all traffic encrypted with AES
```
This is the **hybrid encryption** pattern: asymmetric for key exchange, symmetric for bulk data.

## Key Formulas

**RSA encryption** (simplified):
$$c = m^e \mod n \quad \text{(encrypt)}$$
$$m = c^d \mod n \quad \text{(decrypt)}$$
where $(e, n)$ is the public key and $(d, n)$ is the private key.

**Key length vs security level:**

| Symmetric bits | RSA bits (equivalent) | ECC bits (equivalent) |
|---|---|---|
| 80 | 1024 | 160 |
| 128 | 3072 | 256 |
| 256 | 15360 | 512 |

## Examples

**Correct password hashing (Python):**
```python
import bcrypt

# When user registers
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

# When user logs in
bcrypt.checkpw(password.encode(), hashed)  # True/False
```

**AES encryption (Python, using cryptography library):**
```python
from cryptography.fernet import Fernet
key = Fernet.generate_key()
f = Fernet(key)
token = f.encrypt(b"secret message")
plaintext = f.decrypt(token)
```

**SHA-256 hash:**
```python
import hashlib
digest = hashlib.sha256(b"data").hexdigest()  # 64-char hex string
```

## Common Mistakes
- **Using MD5/SHA-1 for passwords**: Both are broken. Always use bcrypt, scrypt, or Argon2 with a salt.
- **Encrypting instead of hashing passwords**: You don't need to recover a password, only verify it. Hash, don't encrypt.
- **Using ECB mode with AES**: ECB encrypts identical plaintext blocks identically, leaking patterns. Use AES-GCM or AES-CBC with a random IV.
- **Reusing nonces/IVs**: Never reuse an Initialization Vector with the same key. Generate a fresh random IV per encryption.
- **Rolling your own crypto**: Do not implement encryption algorithms from scratch. Use well-audited libraries.

## Related Topics
- [See also: Common Vulnerabilities](common-vulnerabilities.md)
- [See also: Secure Coding](secure-coding.md)
- [See also: Network Security](network-security.md)

## Practice Problems

1. What is the key difference between encryption and hashing?
   <details><summary>Answer</summary>Encryption is reversible (with the key); hashing is one-way. Encryption protects data in transit/at rest; hashing verifies integrity and stores passwords.</details>

2. Why is bcrypt preferred over SHA-256 for password storage?
   <details><summary>Answer</summary>bcrypt is intentionally slow (configurable work factor), making brute-force attacks computationally expensive. SHA-256 is fast — an attacker can compute billions per second on a GPU.</details>

3. In TLS, why is asymmetric encryption not used to encrypt all traffic?
   <details><summary>Answer</summary>Asymmetric encryption (RSA/ECC) is orders of magnitude slower than symmetric encryption (AES). It is only used to securely exchange the fast symmetric session key.</details>
