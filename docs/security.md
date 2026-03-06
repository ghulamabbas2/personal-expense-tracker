# Security Specification — Personal Expense Tracker

## Overview

This document defines the security rules for this project. The rules here are non-negotiable. No feature, deadline, or convenience justifies bypassing them. Security failures in this category — hardcoded secrets, committed credentials, exposed keys — are irreversible once a repository is public or a secret is rotated into a breach.

---

## The Absolute Rules

These are hard rules. There are no exceptions.

1. **Never hardcode a secret in source code.** No API keys, tokens, passwords, connection strings, or private keys in any `.ts`, `.js`, `.json`, `.yaml`, or any other tracked file.
2. **Never commit a `.env` file to Git.** Not `.env`, not `.env.local`, not `.env.production`. Not even once in history.
3. **Never log sensitive values.** No `console.log(process.env.MONGODB_URI)`, no logging session tokens, no logging request headers that may contain credentials.
4. **Never expose server secrets to the client.** Any variable not prefixed with `NEXT_PUBLIC_` is server-only. Prefixing a secret with `NEXT_PUBLIC_` exposes it in the browser bundle — never do this.
5. **Never store secrets in client-side storage.** No secret values in `localStorage`, `sessionStorage`, or cookies accessible to JavaScript.

Violation of any of the above requires an immediate secret rotation — assume the secret is compromised.

---

## Environment Variables

### How Next.js handles environment variables

Next.js separates environment variables into two categories:

| Prefix | Available in | Use for |
|---|---|---|
| No prefix (e.g. `MONGODB_URI`) | Server only (Server Components, Route Handlers, Server Actions, middleware) | Secrets, credentials, private keys |
| `NEXT_PUBLIC_` (e.g. `NEXT_PUBLIC_APP_URL`) | Server and browser bundle | Non-sensitive public configuration only |

The browser bundle is readable by anyone. A `NEXT_PUBLIC_` variable appears in plain text in the JavaScript sent to the browser. Treat it as fully public.

### Required environment variables

```bash
# Authentication — required in all environments
NEXTAUTH_SECRET=        # 32+ random bytes; signs and verifies JWTs and CSRF tokens
NEXTAUTH_URL=           # Full URL of the app (e.g. https://yourapp.com); required in production

# Database — required in all environments
MONGODB_URI=            # Full MongoDB connection string including credentials
```

None of these variables are ever prefixed with `NEXT_PUBLIC_`. None of them are ever logged or returned in an API response.

### Local development setup

Every developer runs the app locally using a `.env.local` file. This file is created manually — it is never checked into the repository.

```bash
# .env.local (never committed — already in .gitignore)
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/expense-tracker-dev
```

Generating a secure `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### `.env.example` — the only committed env file

A `.env.example` file is committed to the repository. It contains every variable name the project needs, with placeholder values and comments. It contains **no real values**.

```bash
# .env.example
# Copy this file to .env.local and fill in real values.
# Never put real values in this file.

# Authentication
NEXTAUTH_SECRET=        # Required: run `openssl rand -base64 32` to generate
NEXTAUTH_URL=           # Required in production: https://your-domain.com

# Database
MONGODB_URI=            # Required: MongoDB connection string
```

This file is the handoff document between repository and developer. It documents what is needed without containing what is sensitive.

### `.gitignore` rules

The following patterns must exist in `.gitignore`. Verify they are present before the first commit.

```
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production
.env.staging
```

A broad pattern `*.local` and `.env*` (excluding `.env.example`) is acceptable but must be confirmed to not accidentally exclude `.env.example`:

```gitignore
# Environment variable files — never commit these
.env*
!.env.example
```

### Checking for accidental exposure

Before pushing, verify no secrets are staged:

```bash
git diff --cached | grep -iE "(secret|password|token|key|uri|mongodb|nextauth)"
```

Run this as a habit before every `git push` that touches configuration files.

---

## Secret Management

### Development

- Use `.env.local` for all local secrets
- Each developer generates their own `NEXTAUTH_SECRET` — never share secrets between developers
- Use a separate MongoDB database for development (e.g., `expense-tracker-dev`) — never point a local environment at the production database
- If a developer accidentally commits a secret, rotate it immediately — do not simply delete the commit; the secret is in Git history

### Production and staging

Production secrets are stored in the hosting platform's environment variable system (e.g., Vercel Environment Variables, AWS Secrets Manager, Doppler). They are never stored in:
- The repository
- Deployment scripts checked into Git
- CI/CD pipeline YAML files as plain text (use the platform's secret store)
- Slack, email, or any communication tool
- Notes apps, wikis, or shared documents

Set production environment variables through the hosting platform's dashboard or CLI — never in code.

**Vercel example (CLI):**

```bash
vercel env add NEXTAUTH_SECRET production
vercel env add MONGODB_URI production
vercel env add NEXTAUTH_URL production
```

**Vercel example (dashboard):** Settings → Environment Variables → add each variable for the Production environment only. Do not reuse production secrets in Preview or Development environments.

### Secret rotation

Rotate secrets immediately when:
- A secret is accidentally committed to the repository (even in a branch)
- A team member with access to secrets leaves the project
- A deployment platform is decommissioned
- A breach or suspected breach occurs
- Secrets have not been rotated in more than 90 days (as routine hygiene)

After rotating `NEXTAUTH_SECRET`, all existing sessions are invalidated. Users will need to sign in again. This is expected and correct.

After rotating `MONGODB_URI` credentials, update the value in every environment (production, staging, local `.env.local` per developer) and redeploy.

---

## Server-Only Code

### The `server-only` package

Any module that imports environment variables or contains sensitive logic (database connections, auth config, encryption) must import `server-only` at the top. This causes a build error if the module is accidentally imported by a Client Component, preventing secret leakage into the browser bundle.

```ts
// lib/db.ts
import 'server-only'
import mongoose from 'mongoose'

// lib/auth.ts
import 'server-only'
import NextAuth from 'next-auth'
```

### What belongs server-only

| Module | Reason |
|---|---|
| `lib/db.ts` | Contains `MONGODB_URI` |
| `lib/auth.ts` | Contains `NEXTAUTH_SECRET`, adapter config |
| `lib/schemas/` | Safe on either side, but validation logic is repeated on server |
| `app/api/**/route.ts` | Route Handlers are server-only by default |
| `app/**/actions.ts` | Server Actions are server-only by default (`"use server"`) |

### `NEXT_PUBLIC_` — the safe list

Only values that are genuinely public and non-sensitive may be prefixed `NEXT_PUBLIC_`. For this project, the expected list is:

```bash
# Currently no NEXT_PUBLIC_ variables are required.
# If one is added, document why it is safe to be public here.
```

If you are tempted to add `NEXT_PUBLIC_MONGODB_URI` or `NEXT_PUBLIC_NEXTAUTH_SECRET`, the answer is no. There is no context in which those are appropriate.

---

## Sensitive Data in Logs

### What must never be logged

- `process.env.*` values
- `session.user` objects beyond `{ id, name, email }`
- Request headers (`Authorization`, `Cookie`)
- Passwords, hashes, or anything related to credentials
- Full MongoDB documents that may contain sensitive user data
- Stack traces in responses sent to the client (server-side logging of stack traces is fine)

### Safe logging pattern

```ts
// Wrong: logs connection string
console.log('Connecting to DB:', process.env.MONGODB_URI)

// Wrong: logs full session object
console.log('Session:', session)

// Wrong: logs request headers
console.log('Headers:', request.headers)

// Correct: log only safe identifiers
console.log('[db] Connected to database')
console.log('[auth] Session established for user:', session.user.id)
console.error('[createExpense] Failed for user:', session.user.id, err.message)
```

Log the **context** (what was happening), the **user id** (for tracing), and the **error message** (not the full error object in production). Never log the full `err` object to a public logging service — it may contain query details, file paths, or credential fragments.

---

## Database Security

### Connection string hygiene

- The MongoDB connection string contains credentials — treat it as a password
- Use a dedicated database user with the minimum required permissions (read/write on the application database only — no admin, no `listDatabases`, no `createCollection` on other databases)
- Use a separate user per environment (development, staging, production)
- Enable MongoDB Atlas IP allowlisting: only allow connections from your hosting platform's IP range (Vercel, AWS, etc.) and developer IPs for local access

### Query-level protection

- Always scope queries to the authenticated user's `userId` — see `docs/auth.md`
- Never accept a `userId` from the request body or query string and use it in a database query
- Never use `eval`, string interpolation, or `$where` in MongoDB queries — these open injection vectors
- Mongoose sanitizes inputs by default for standard queries; do not bypass this with raw `db.collection()` calls unless necessary and reviewed

### Mongoose schema defaults

Every schema that stores user data sets `userId` as required and indexed. No document is ever readable without a `userId` filter derived from the server session:

```ts
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
  index: true,
}
```

---

## Authentication Security

Refer to `docs/auth.md` for the full authentication specification. Security highlights:

- Passwords are hashed with `bcryptjs` at `saltRounds: 12` — never stored in plain text
- JWTs are stored in `httpOnly`, `Secure`, `SameSite=lax` cookies — inaccessible to JavaScript
- CSRF protection is provided by NextAuth's built-in token system
- Session tokens are never returned in API responses or logged
- Sign-in and sign-up return identical error messages for invalid credentials or duplicate email — no user enumeration
- `callbackUrl` redirects are validated to be same-origin — no open redirect

---

## Client-Side Security

### What the browser must never receive

- Any environment variable that is not `NEXT_PUBLIC_`
- Database IDs beyond what the user needs to interact with their own data
- Other users' data in any form
- Internal error messages, stack traces, or query details
- `bcrypt` hashes or any password-related fields from the database

### Props and API responses — whitelist, not passthrough

When passing data from the server to a Client Component or returning it from an API route, explicitly select the fields to include. Never spread a full Mongoose document or database object:

```ts
// Wrong: passes all fields including internal ones
return Response.json({ data: user })

// Correct: whitelist only what the client needs
return Response.json({
  data: {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  },
})
```

This applies to RSC props, Route Handler responses, and Server Action return values equally.

### Content Security Policy

The production deployment should set a `Content-Security-Policy` header to mitigate XSS. Configure it in `next.config.ts`:

```ts
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}
```

---

## Dependency Security

- Run `npm audit` regularly and after adding any new dependency
- Do not install dependencies with a high or critical vulnerability without a confirmed mitigation or alternative
- Pin major versions for security-sensitive packages (`next-auth`, `mongoose`, `bcryptjs`, `zod`)
- Review the source or reputation of any new package before adding it — supply chain attacks via npm are a real threat
- Keep dependencies updated — set a recurring reminder to run `npm outdated` monthly

---

## Pre-deployment Checklist

Run through this list before every production deployment:

```
Environment variables
  [ ] All required variables are set in the hosting platform (not in code)
  [ ] NEXTAUTH_SECRET is at least 32 random bytes
  [ ] NEXTAUTH_URL matches the production domain exactly
  [ ] MONGODB_URI points to the production database cluster
  [ ] No .env files are present in the repository

Code review
  [ ] No hardcoded secrets, tokens, or connection strings anywhere in the diff
  [ ] No console.log statements that print environment variables or full session objects
  [ ] No NEXT_PUBLIC_ variables added that expose sensitive values
  [ ] All Server Actions call getServerSession before any database operation
  [ ] All API Route Handlers check the session before processing the request

Database
  [ ] MongoDB Atlas IP allowlist is configured for production IPs only
  [ ] The database user has minimum required permissions
  [ ] Production DB is not the same as development DB

Dependencies
  [ ] npm audit shows no high or critical vulnerabilities
  [ ] No new dependencies were added without review
```

---

## If a Secret Is Compromised

If a secret is ever accidentally committed, logged, shared, or exposed — follow these steps immediately:

1. **Rotate the secret now.** Do not wait. Assume it has been seen by a third party.
   - Generate a new `NEXTAUTH_SECRET` and update it in the hosting platform
   - Rotate the MongoDB credentials in Atlas and update `MONGODB_URI` everywhere
2. **Remove from Git history.** Use `git filter-repo` (preferred) or `BFG Repo Cleaner` to scrub the secret from every commit. Force-push to all remotes.
3. **Revoke any issued tokens.** Rotating `NEXTAUTH_SECRET` immediately invalidates all active sessions.
4. **Audit access logs.** Check MongoDB Atlas and hosting platform logs for any unexpected access during the window of exposure.
5. **Notify affected users** if there is any indication that user data was accessed.

Deleting the commit that introduced the secret is not sufficient — the secret remains in `git reflog` and any clones made before deletion.
