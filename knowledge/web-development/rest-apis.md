---
type: concept
title: "REST APIs"
domain: web-development
subdomain: apis
tags: [REST, API, HTTP, JSON, web-development, endpoints, status-codes, CRUD]
prerequisites: []
difficulty: beginner
last_updated: 2026-06-30
author: AetherMind OKF
---

# REST APIs

## Definition
REST (Representational State Transfer) is an architectural style for designing network APIs. A RESTful API uses HTTP as its transport, organises functionality around **resources** (nouns, not verbs), and communicates in stateless request-response cycles — typically using JSON.

## Core Concept

### The Six REST Constraints
1. **Client-Server**: UI and data storage are separate concerns
2. **Stateless**: Each request contains all context; the server holds no session
3. **Cacheable**: Responses declare whether they can be cached
4. **Uniform Interface**: Standard HTTP methods + resource URLs
5. **Layered System**: Clients don't know if they're talking to the origin or a proxy
6. **Code on Demand** (optional): Servers can return executable code (rarely used)

### HTTP Methods → CRUD Operations

| Method | CRUD | Idempotent? | Safe? |
|---|---|---|---|
| GET | Read | Yes | Yes |
| POST | Create | No | No |
| PUT | Replace (full update) | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Delete | Yes | No |

**Idempotent** = calling it multiple times has the same effect as calling it once.  
**Safe** = does not modify server state.

### Resource URL Design
URLs identify **things** (resources), not **actions**:

```
GET    /users           → list all users
POST   /users           → create a user
GET    /users/{id}      → get one user
PUT    /users/{id}      → replace one user
PATCH  /users/{id}      → partially update one user
DELETE /users/{id}      → delete one user
GET    /users/{id}/posts → list posts by this user
```

Never use verbs in REST URLs: `/getUser` is wrong; `/users/{id}` is correct.

### HTTP Status Codes

| Range | Meaning | Examples |
|---|---|---|
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301 Moved, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable |
| 5xx | Server error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable |

## Key Formulas

**Typical request/response cycle (JSON):**

Request:
```http
POST /api/users HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{"name": "Alice", "email": "alice@example.com"}
```

Response:
```http
HTTP/1.1 201 Created
Content-Type: application/json

{"id": 42, "name": "Alice", "email": "alice@example.com", "created_at": "2026-06-30T12:00:00Z"}
```

## Examples

**GET with query parameters:**
```
GET /products?category=books&sort=price&page=2&limit=20
```

**Versioned API (best practice):**
```
GET /api/v1/users
GET /api/v2/users   ← breaking change? bump the version
```

**Error response body (consistent format):**
```json
{
  "error": "validation_failed",
  "message": "Email is already taken",
  "field": "email"
}
```

**Python fetch example (requests library):**
```python
import requests

r = requests.get("https://api.example.com/users/42",
                 headers={"Authorization": "Bearer token123"})
r.raise_for_status()   # raises if 4xx/5xx
user = r.json()
```

## Common Mistakes
- **Using GET for operations that modify data**: GET must be safe (no side effects). Use POST/PUT/PATCH/DELETE.
- **Returning 200 for errors**: Return the correct 4xx/5xx status code — don't hide errors inside a 200 body.
- **Putting verbs in URLs**: `/deleteUser/42` is not RESTful. Use `DELETE /users/42`.
- **Skipping authentication on DELETE/PATCH**: Any state-changing endpoint must require auth.
- **Huge response payloads**: Always paginate list endpoints. Return a `meta` object with `total`, `page`, `limit`.

## Related Topics
- [See also: Authentication Patterns](authentication-patterns.md)
- [See also: Database Design](database-design.md)

## Practice Problems

1. Which HTTP method should create a new resource and return its URL?
   <details><summary>Answer</summary>POST. The response should include a `Location` header pointing to the new resource URL and return status 201 Created.</details>

2. What status code means the client sent a valid request but lacks permission?
   <details><summary>Answer</summary>403 Forbidden (vs 401 Unauthorized, which means "not authenticated at all").</details>

3. Design the URL pattern for getting a specific comment on a specific post.
   <details><summary>Answer</summary>`GET /posts/{postId}/comments/{commentId}`</details>
