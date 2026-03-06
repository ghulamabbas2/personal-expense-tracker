# Routing Specification — Personal Expense Tracker

## Overview

All routing follows Next.js App Router conventions. Routes are organized by resource and feature using the filesystem. Every route under `app/` is protected by default and requires an authenticated session — enforced by `middleware.ts` before the request ever reaches a page or handler. Public routes (sign-in, sign-up, NextAuth endpoints) are explicitly opted out of protection via the middleware matcher.

---

## Conventions

| Convention | Rule |
|---|---|
| Folders = routes | Each folder under `app/` maps to a URL segment |
| `page.tsx` | Makes a segment publicly routable (renders the UI) |
| `layout.tsx` | Wraps all children in a shared UI shell |
| `loading.tsx` | Automatic Suspense fallback for the segment |
| `error.tsx` | Error boundary for the segment (`"use client"` required) |
| `not-found.tsx` | Rendered when `notFound()` is called from the segment |
| `route.ts` | API Route Handler — no UI, returns `Response` |
| `(group)` | Route group — organises files without adding a URL segment |
| `[param]` | Dynamic segment — value available via `params.param` |
| `[...slug]` | Catch-all dynamic segment |
| `_folder` | Private folder — excluded from routing entirely |

Route and folder names are always lowercase, hyphen-separated (kebab-case). No camelCase or underscores in URL segments.

---

## Full Route Map

```
app/
│
├── (auth)/                          # Route group — no URL prefix
│   ├── sign-in/
│   │   └── page.tsx                 # GET /sign-in  (public)
│   └── sign-up/
│       └── page.tsx                 # GET /sign-up  (public)
│
├── (dashboard)/                     # Route group — no URL prefix
│   ├── layout.tsx                   # Shared shell: Navbar, Sidebar
│   └── page.tsx                     # GET /  (dashboard home)
│
├── expenses/
│   ├── page.tsx                     # GET /expenses
│   └── [id]/
│       └── page.tsx                 # GET /expenses/:id
│
├── budgets/
│   └── page.tsx                     # GET /budgets
│
├── settings/
│   ├── layout.tsx                   # Settings shell with tab nav
│   ├── profile/
│   │   └── page.tsx                 # GET /settings/profile
│   └── budget/
│       └── page.tsx                 # GET /settings/budget
│
└── api/
    ├── auth/
    │   └── [...nextauth]/
    │       └── route.ts             # NextAuth handler (public)
    ├── expenses/
    │   ├── route.ts                 # GET, POST /api/expenses
    │   └── [id]/
    │       └── route.ts             # GET, PATCH, DELETE /api/expenses/:id
    ├── budgets/
    │   ├── route.ts                 # GET, POST /api/budgets
    │   └── [id]/
    │       └── route.ts             # GET, PATCH, DELETE /api/budgets/:id
    └── user/
        └── route.ts                 # GET, PATCH /api/user
```

---

## Route Protection via Middleware

A single `middleware.ts` at the project root intercepts every request before it reaches any page or API handler. It uses NextAuth's `withAuth` wrapper to verify the JWT cookie.

### How it works

1. The middleware matcher excludes public routes and Next.js internals from interception
2. For all other routes, `withAuth` checks the JWT — if absent or invalid, it redirects to `/sign-in?callbackUrl=<original-url>`
3. Authenticated users visiting `/sign-in` or `/sign-up` are redirected to `/` (dashboard)
4. The middleware never hits the database — it only verifies the JWT signature at the edge

### Public routes (no auth required)

```
/sign-in
/sign-up
/api/auth/*        (NextAuth endpoints)
/_next/static/*    (static assets)
/_next/image/*     (image optimization)
/favicon.ico
```

Everything else is protected.

### middleware.ts

```ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const isAuthPage =
      req.nextUrl.pathname.startsWith('/sign-in') ||
      req.nextUrl.pathname.startsWith('/sign-up')

    // Redirect authenticated users away from auth pages
    if (isAuthPage && req.nextauth.token) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/((?!sign-in|sign-up|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

---

## Route Groups

Route groups use the `(name)` folder convention. They organise files and apply shared layouts without contributing a segment to the URL.

### `(auth)` group

Contains the public authentication pages. No layout is applied — these pages render standalone.

```
app/(auth)/sign-in/page.tsx  →  /sign-in
app/(auth)/sign-up/page.tsx  →  /sign-up
```

### `(dashboard)` group

Wraps the main app pages in the shared application shell (Navbar, Sidebar). The `layout.tsx` inside this group renders for `/` and all pages that do not define their own top-level layout.

```
app/(dashboard)/layout.tsx   →  shell for / and future top-level pages
app/(dashboard)/page.tsx     →  /
```

---

## Layouts

Layouts persist across navigation — they do not re-render when child routes change.

### Root layout (`app/layout.tsx`)

- Renders `<html>` and `<body>`
- Mounts `HeroUIProvider`, `NextThemesProvider`, and `SessionProvider`
- Applies the Geist font variables
- No navigation UI — that lives inside `(dashboard)/layout.tsx`

### Dashboard layout (`app/(dashboard)/layout.tsx`)

- Renders the `Navbar` and main content area
- Wraps `{children}` in the page shell
- Server Component — reads session via `getServerSession` to pass user data to Navbar

### Settings layout (`app/settings/layout.tsx`)

- Renders the settings page header and tab navigation (`/settings/profile`, `/settings/budget`)
- Highlights the active tab based on the current pathname

---

## Pages

### Dashboard (`app/(dashboard)/page.tsx`)

- URL: `/`
- Server Component
- Fetches summary stats, recent expenses, and category breakdown in parallel
- Renders summary cards, recent transactions table, and spending-by-category list

### Expenses list (`app/expenses/page.tsx`)

- URL: `/expenses`
- Server Component (shell) + Client Component (table with sort, filter, pagination)
- Accepts `?search=`, `?category=`, `?page=` search params for filtering and pagination
- Search params are read server-side via the `searchParams` prop

### Expense detail (`app/expenses/[id]/page.tsx`)

- URL: `/expenses/:id`
- Server Component
- Fetches the expense by `id`, verifies `userId` matches session before rendering
- Calls `notFound()` if the expense does not exist or does not belong to the user

### Budgets (`app/budgets/page.tsx`)

- URL: `/budgets`
- Server Component
- Fetches all budget documents for the authenticated user
- Renders a card per category with spend vs budget progress

### Settings — Profile (`app/settings/profile/page.tsx`)

- URL: `/settings/profile`
- Server Component (shell) + Client Components (form fields, password update)

### Settings — Budget (`app/settings/budget/page.tsx`)

- URL: `/settings/budget`
- Server Component (shell) + Client Components (budget amount inputs)

---

## API Route Handlers

API routes live under `app/api/`. They return `Response` objects and are never rendered as pages.

### Rules for all Route Handlers

- Always call `getServerSession(authOptions)` at the top — return `401` immediately if no session
- Validate path params and request body before any database operation
- Return consistent JSON shapes: `{ data }` for success, `{ error }` for failures
- Use appropriate HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`)
- Never expose internal error messages or stack traces to the client

### `GET /api/expenses` — list expenses

Returns the authenticated user's expenses, filtered by query params (`?category=`, `?from=`, `?to=`, `?page=`, `?limit=`).

### `POST /api/expenses` — create expense

Validates the request body, creates a new `Expense` document with `userId` set to `session.user.id`.

### `GET /api/expenses/:id` — get one expense

Returns the expense only if `expense.userId === session.user.id`. Returns `404` otherwise (no ownership leak).

### `PATCH /api/expenses/:id` — update expense

Validates the request body, updates only fields that are provided. Verifies ownership before updating.

### `DELETE /api/expenses/:id` — delete expense

Verifies ownership, then deletes. Returns `204 No Content`.

### `GET /api/budgets` — list budgets

Returns all budget documents for the authenticated user.

### `POST /api/budgets` — create or upsert budget

Creates a budget for a category. Uses upsert by `{ userId, category }` to avoid duplicate categories per user.

### `PATCH /api/budgets/:id` — update budget

Updates the `amount` for a budget. Verifies ownership.

### `DELETE /api/budgets/:id` — delete budget

Verifies ownership, then deletes.

### `GET /api/user` — get current user

Returns `{ id, name, email }` for the authenticated user from the database.

### `PATCH /api/user` — update profile

Updates `name`, `email`, or `password` for the authenticated user. Password updates require the current password to be verified first.

---

## Dynamic Segments

Dynamic segments use `[param]` folders. The param value is available in:

- **Page / Layout**: `props.params.param` (Server Component)
- **Route Handler**: `context.params.param` (second argument to the handler)

```ts
// app/expenses/[id]/page.tsx
export default async function ExpensePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  const expense = await Expense.findOne({ _id: params.id, userId: session.user.id })
  if (!expense) notFound()
  // ...
}

// app/api/expenses/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // ...
}
```

---

## Loading and Error States

### `loading.tsx`

Place a `loading.tsx` file alongside any `page.tsx` that performs async data fetching. Next.js wraps the page in a `<Suspense>` boundary automatically and shows the loading UI during navigation.

```
app/expenses/loading.tsx   →  shown while /expenses page fetches data
app/budgets/loading.tsx    →  shown while /budgets page fetches data
```

Loading UIs use HeroUI `Spinner` or skeleton cards — see `docs/ui.md`.

### `error.tsx`

Place an `error.tsx` alongside any segment that may throw. Must be a Client Component (`"use client"`). Receives `error` and `reset` props.

```
app/expenses/error.tsx
app/expenses/[id]/error.tsx
```

### `not-found.tsx`

Called automatically when `notFound()` is thrown inside the segment. Used on detail pages where ownership verification may result in a missing resource.

```
app/expenses/[id]/not-found.tsx
```

---

## Navigation

- Use Next.js `<Link>` for all internal navigation — never `<a>` tags
- Programmatic navigation uses `useRouter()` from `next/navigation` (Client Components only)
- After a Server Action mutates data, call `revalidatePath('/expenses')` or `revalidateTag(...)` to invalidate cached data and trigger a re-fetch

---

## Search Params

Search params (`?key=value`) are used for filtering, sorting, and pagination on list pages. They are read server-side from the `searchParams` prop on Server Component pages.

```ts
// app/expenses/page.tsx
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string; search?: string }
}) {
  const page = Number(searchParams.page ?? 1)
  const category = searchParams.category
  // ...
}
```

Never use `useSearchParams()` for values that only need to be read server-side. Use it only in Client Components that reactively respond to param changes.

---

## Naming Rules Summary

| What | Convention | Example |
|---|---|---|
| Route folders | lowercase, kebab-case | `expenses/`, `sign-in/`, `budget-categories/` |
| Route groups | lowercase, kebab-case in `()` | `(auth)`, `(dashboard)` |
| Dynamic segments | camelCase in `[]` | `[id]`, `[expenseId]` |
| Files | camelCase | `page.tsx`, `layout.tsx`, `route.ts` |
| Private folders | prefixed with `_` | `_components/`, `_lib/` |
| API segments | lowercase, kebab-case, plural nouns | `/api/expenses`, `/api/budgets` |
| HTTP verbs | uppercase named exports in `route.ts` | `export async function GET(...)` |
