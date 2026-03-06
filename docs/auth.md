# Authentication Specification — Personal Expense Tracker

## Overview

Authentication is handled exclusively by [NextAuth.js](https://next-auth.js.org) (v4 — latest stable). NextAuth owns the full auth lifecycle: sign-in, sign-up, session management, token rotation, and sign-out. No custom auth logic is written outside of NextAuth's configuration.

All routes under `/app/*` are **protected by default**. Unauthenticated users are redirected to `/sign-in` regardless of which route they attempt to access.

---

## Stack

| Concern | Solution |
|---|---|
| Authentication library | `next-auth` v4 (latest stable) |
| Session strategy | JWT (stored in an `httpOnly` cookie) |
| Credential provider | Email + password |
| Password hashing | `bcryptjs` |
| Database adapter | `@next-auth/mongodb-adapter` |
| Database | MongoDB via Mongoose |
| Route protection | `withAuth` middleware from `next-auth/middleware` |
| Server-side identity | `getServerSession(authOptions)` in Server Components and Route Handlers |

---

## File Structure

```
app/
  (auth)/
    sign-in/
      page.tsx          # Sign-in UI (public)
    sign-up/
      page.tsx          # Sign-up UI (public)
  api/
    auth/
      [...nextauth]/
        route.ts        # NextAuth route handler
lib/
  auth.ts               # NextAuth config (providers, callbacks, adapter)
  db.ts                 # MongoDB connection
middleware.ts           # Route protection (runs on every request)
```

---

## NextAuth Configuration (`lib/auth.ts`)

The NextAuth config is a plain `NextAuthOptions` object exported as `authOptions`. It is passed to the `NextAuth()` handler and also imported directly anywhere `getServerSession` is called.

```ts
// lib/auth.ts
import NextAuth, { type NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = { ... }
export default NextAuth(authOptions)
```

The route handler at `app/api/auth/[...nextauth]/route.ts` re-exports the default handler as `GET` and `POST`:

```ts
// app/api/auth/[...nextauth]/route.ts
import handler from "@/lib/auth"
export { handler as GET, handler as POST }
```

### Providers

Only the `Credentials` provider is used:

- Accepts `email` and `password`
- On `authorize`:
  1. Look up the user in MongoDB by email
  2. Reject immediately if no user found (no timing hint)
  3. Compare submitted password against the stored `bcryptjs` hash
  4. Return the user object (`{ id, name, email }`) on success, or `null` on failure
- Never return raw passwords or sensitive fields from `authorize`

### Session Strategy

```
session: { strategy: "jwt" }
```

- The JWT is stored in a secure, `httpOnly`, `SameSite=lax` cookie managed by NextAuth
- The JWT is never accessible to client-side JavaScript
- Token expiry: 30 days (configurable via `session.maxAge`)
- Refresh: NextAuth rotates the JWT on each request automatically

### Callbacks

**`jwt` callback** — runs when the token is created or updated:
- On sign-in: embed `user.id` into the token payload
- Subsequent requests: pass the token through unchanged

**`session` callback** — runs when a session is read:
- Copy `token.sub` (the user's MongoDB `_id` as string) into `session.user.id`
- This makes `session.user.id` available everywhere `getServerSession` is called
- Never expose password hash, internal flags, or any field beyond `{ id, name, email }`

### TypeScript: Extending the Session Type

NextAuth v4 does not include `user.id` in its default `Session` type. Extend it via module augmentation in `types/next-auth.d.ts`:

```ts
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
    }
  }
}
```

### Pages

```
pages: {
  signIn: "/sign-in",
  error: "/sign-in",    // auth errors redirect back to sign-in with ?error=
}
```

---

## Route Protection (`middleware.ts`)

A single `middleware.ts` at the project root uses NextAuth's `withAuth` wrapper to protect all app routes:

```ts
// middleware.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Redirect authenticated users away from auth pages
    const isAuthPage = req.nextUrl.pathname.startsWith("/sign-in") ||
                       req.nextUrl.pathname.startsWith("/sign-up")
    if (isAuthPage && req.nextauth.token) {
      return NextResponse.redirect(new URL("/", req.url))
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ["/((?!sign-in|sign-up|api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

```
Public routes  →  /sign-in, /sign-up, /api/auth/*
Protected routes  →  everything else (matched via the config matcher above)
```

Behavior:
- Unauthenticated request to any protected route → redirect to `/sign-in?callbackUrl=<original-url>`
- Authenticated request to `/sign-in` or `/sign-up` → redirect to `/` (dashboard)
- After successful sign-in, NextAuth automatically redirects to `callbackUrl` if present and same-origin

The middleware runs at the edge and never touches the database — it only verifies the JWT signature via `authorized`, which is fast and stateless.

---

## Sign-Up Flow

NextAuth does not handle user registration, so sign-up is implemented as a Server Action or API Route Handler:

1. Validate inputs server-side (required fields, email format, password strength)
2. Check for existing user by email — return a generic error if found (no user enumeration)
3. Hash the password with `bcryptjs` (`saltRounds: 12`)
4. Insert the new user document into MongoDB
5. Call NextAuth's `signIn("credentials", { email, password })` programmatically to create a session immediately after registration
6. Redirect to `/` on success

Password requirements (enforced server-side):
- Minimum 8 characters
- At least one uppercase letter, one number, and one special character

---

## Identity Enforcement

### Principle

Every authenticated user can only read, create, update, and delete **their own data**. This is enforced at two levels: the server (before any DB query) and the database query itself (as a hard filter).

### Server Level

In every Server Component, Route Handler, and Server Action that accesses user data:

1. Call `const session = await getServerSession(authOptions)` at the top
2. If `!session?.user?.id` → return a 401 response or redirect to sign-in
3. Use `session.user.id` as the `userId` filter for all database operations — never accept a `userId` from request parameters, query strings, or request bodies

```ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Correct — identity comes from the verified session
const session = await getServerSession(authOptions)
if (!session?.user?.id) redirect("/sign-in")
const expenses = await Expense.find({ userId: session.user.id })

// Wrong — never do this
const expenses = await Expense.find({ userId: params.userId })
```

### Database Level

Every document schema that belongs to a user (e.g., `Expense`, `Budget`) includes a `userId` field indexed for query performance:

```ts
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
  index: true,
}
```

All queries are scoped with `{ userId: new ObjectId(session.user.id) }` as a mandatory filter. There is no query path that returns documents without this filter applied.

---

## Session Access Patterns

| Context | How to get the session |
|---|---|
| Server Component | `const session = await getServerSession(authOptions)` |
| Route Handler | `const session = await getServerSession(authOptions)` |
| Server Action | `const session = await getServerSession(authOptions)` |
| Client Component | `useSession()` hook from `next-auth/react` (after wrapping in `SessionProvider`) |

`SessionProvider` is added once in the root layout so `useSession()` is available app-wide. Client Components should use the session only for UI state (e.g., showing the user's name) — never for access control decisions.

---

## Security Practices

| Practice | Implementation |
|---|---|
| Passwords never stored in plain text | `bcryptjs` hash with `saltRounds: 12` |
| JWT stored in `httpOnly` cookie | NextAuth default; inaccessible to JS |
| CSRF protection | NextAuth's built-in CSRF token on all POST auth endpoints |
| No user enumeration | Sign-in and sign-up return identical generic errors for invalid credentials or duplicate email |
| `callbackUrl` restricted to same-origin | NextAuth validates the URL before redirect |
| Session user ID from JWT only | `session.user.id` is set exclusively in the `session` callback from `token.sub` |
| No sensitive fields in session | `session` callback whitelists only `id`, `name`, `email` |
| All data queries scoped by `userId` | No query runs without a `userId` filter derived from the server session |
| HTTPS in production | Enforced via deployment config; NextAuth sets `Secure` cookie flag automatically in production |

---

## Error Handling

- Invalid credentials → NextAuth returns a `CredentialsSignin` error; the sign-in page reads `?error=CredentialsSignin` from the URL and displays a generic "Invalid email or password" message
- Session expired → middleware redirects to `/sign-in?callbackUrl=...`
- Unauthorized access attempt inside a Server Component or Action → redirect to `/sign-in` (never a data leak)
- All auth errors are logged server-side; no stack traces are exposed to the client

---

## Environment Variables

```
NEXTAUTH_SECRET=        # Required in all environments; 32+ random bytes
NEXTAUTH_URL=           # Required in production (e.g. https://yourdomain.com)
MONGODB_URI=            # MongoDB connection string
```

`NEXTAUTH_SECRET` must never be committed to source control. It is used to sign and verify JWTs and CSRF tokens.
