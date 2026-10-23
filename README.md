# Blog API – backend development with a security focus

A REST API for a blog platform (posts, comments, users) built with **Node.js, Fastify and MongoDB**, with JWT authentication using short-lived access tokens and rotating refresh tokens. Built as a course project in *Backend development and API design with a security focus* (Swedish vocational higher education). A small PHP version of the posts CRUD is included for comparison.

> Kursprojekt i Backendutveckling och API-design med säkerhetsfokus. Koden och kommentarerna är på svenska.

## Contents

| Path | What |
| --- | --- |
| [`kodprojekt/`](kodprojekt/) | The main Node.js API – setup guide, endpoints and error format in [`kodprojekt/README.md`](kodprojekt/README.md) (Swedish) |
| [`php-kod/`](php-kod/) | Minimal PHP 8 + SQLite version of the posts CRUD (no authentication – it only demonstrates routing and parameterised queries) |
| [`SKRIFTLIG.md`](SKRIFTLIG.md) | Written course report (Swedish): database choice, architecture, threats and mitigations, Node.js vs PHP |

## Quick start

Requires Node.js 20+ and Docker (or your own MongoDB).

```bash
cd kodprojekt
cp .env.example .env      # then replace both JWT secrets with long random strings
npm install
docker compose up -d      # MongoDB on 127.0.0.1:27017
npm run seed              # demo users: anna@example.com / bob@example.com, password "password123"
npm run dev               # http://localhost:3000
```

A Postman collection is included: `kodprojekt/blog-api.postman_collection.json`.

## API overview

Base URL `/api/v1`. Every response is `{ "data": ... }` on success or `{ "error": { "code", "message", "details?" } }` on failure.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `GET|POST /posts`, `GET|PUT|DELETE /posts/:id`, `GET|POST /posts/:id/comments`
- `GET|PUT|DELETE /comments/:id`

Reading is public; creating requires a valid access token; updating and deleting requires being the author of the resource.

## Security measures

| Area | Implementation |
| --- | --- |
| Password storage | bcrypt, cost factor 12; password length 8–72 (bcrypt's input limit) |
| Login | Generic `INVALID_CREDENTIALS` error and a dummy bcrypt comparison for unknown e-mails, so neither the message nor the timing reveals which accounts exist |
| JWT | HS256 pinned on both sign and verify; separate secrets for access and refresh tokens (startup fails if they are equal or shorter than 32 characters); access token 15 min, refresh token 7 days |
| Refresh tokens | Rotated on every use, stored as a SHA-256 hash, unique `jti`; reuse of an old token revokes the user's session; logout revokes it |
| Authorization | `checkOwner` on every update/delete – being logged in is not enough, the resource must be yours (prevents IDOR) |
| Input validation | JSON Schema on every body, param and query; `additionalProperties: false`; ObjectId format check on `:id`; length limits on all strings |
| NoSQL injection / XSS | A `preValidation` hook strips keys starting with `$` or containing `.` and removes HTML tags from all string input |
| Rate limiting | 100 requests/min per IP globally, 5/min on login and register |
| HTTP headers / CORS | `@fastify/helmet` defaults; CORS only for origins listed in `CORS_ORIGIN` (none if unset) |
| Errors | One central error handler; unknown errors are logged server-side and returned as a generic 500 without stack traces |
| Secrets | Read from `.env` (git-ignored); the server refuses to start if any are missing, and in production if the `.env.example` placeholders are still in use |
| Database | The Docker Compose MongoDB is bound to `127.0.0.1` only |

### Known limitations

- Refresh tokens are returned in the JSON body rather than an `HttpOnly` cookie, so a client must store them safely.
- Access tokens cannot be revoked before they expire (max 15 minutes after logout).
- Rate limit counters are per IP and in memory (reset on restart, not shared between instances).
- `POST /auth/register` returns `409` for an existing e-mail or username, which reveals that it is taken – a usability trade-off.
- No automated test suite; the Postman collection documents the manual test flow, including injection and authorization checks.

## License

[MIT](LICENSE)
