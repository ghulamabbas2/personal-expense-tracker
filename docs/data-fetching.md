# Data Fetching Specification — Personal Expense Tracker

## Overview

All data fetching for page rendering is performed exclusively in **Server Components**. Pages query the database directly on the server — no `fetch()` calls to internal API routes, no client-side data fetching libraries (SWR, React Query) for initial data, and no API routes created solely to serve page data.

This approach keeps sensitive data server-side at all times, eliminates client-to-server round trips for initial renders, and ensures access control is enforced at the point where data is read — before anything reaches the browser.

---

## The Rule

> **Every page fetches its own data directly in a Server Component. Client Components receive data as props and never fetch it themselves.**

- No `useEffect` + `fetch` inside Client Components for page data
- No `useSWR` or `useQuery` for initial data loads
- No API Route Handlers created solely to serve data to Server Components
- No passing `userId` from the client to the server — identity always comes from the server session

API Route Handlers under `app/api/` exist for external callers and mobile clients. They are never called from within Server Components to retrieve data for rendering.

---

## File Structure

Data fetching logic lives in dedicated query files co-located near the route segments they serve, or in `lib/queries/` for shared queries used across multiple pages.

```
lib/
  queries/
    expenses.ts       # getExpenses, getExpenseById, getExpenseSummary
    budgets.ts        # getBudgets, getBudgetById
    user.ts           # getCurrentUser

app/
  (dashboard)/
    page.tsx          # Server Component — calls getExpenseSummary, getRecentExpenses
  expenses/
    page.tsx          # Server Component — calls getExpenses with filters
    [id]/
      page.tsx        # Server Component — calls getExpenseById
  budgets/
    page.tsx          # Server Component — calls getBudgets
  settings/
    profile/
      page.tsx        # Server Component — calls getCurrentUser
```

Query functions in `lib/queries/` are plain async functions. They are not Server Actions — they have no `"use server"` directive and are never called from Client Components.

---

## Authorization

Every query function begins by verifying the session. Data is never fetched without a confirmed identity, and the user's identity is always derived from the server session — never from URL parameters, query strings, or any client-supplied value.

```ts
// lib/queries/expenses.ts
import { cache } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import Expense from "@/lib/models/expense"
import { redirect } from "next/navigation"

export const getExpenses = cache(async (filters: ExpenseFilters = {}) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  const query: Record<string, unknown> = { userId: session.user.id }
  if (filters.category) query.category = filters.category
  if (filters.from || filters.to) {
    query.date = {}
    if (filters.from) (query.date as Record<string, unknown>).$gte = filters.from
    if (filters.to) (query.date as Record<string, unknown>).$lte = filters.to
  }

  return Expense.find(query)
    .sort({ date: -1 })
    .skip(((filters.page ?? 1) - 1) * (filters.limit ?? 20))
    .limit(filters.limit ?? 20)
    .lean()
})
```

### Authorization rules

- Call `getServerSession(authOptions)` at the top of every query function
- If `!session?.user?.id` → call `redirect("/sign-in")` immediately — do not return partial data
- Always include `{ userId: session.user.id }` as a mandatory filter on every database query
- Never accept a `userId` from outside the function — it is always derived from the session
- For single-document queries, call `notFound()` if the document does not exist **or** if `document.userId` does not match `session.user.id` — both cases look identical to the caller

```ts
// lib/queries/expenses.ts
import { notFound } from "next/navigation"

export const getExpenseById = cache(async (id: string) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  // userId filter in the query is the ownership check
  const expense = await Expense.findOne({
    _id: id,
    userId: session.user.id,
  }).lean()

  // Do not reveal whether the document exists but belongs to another user
  if (!expense) notFound()

  return expense
})
```

---

## Fetching in Server Components

Server Component pages call query functions directly and pass the results as props to child components. No intermediate API call, no serialization gap.

```tsx
// app/expenses/page.tsx
import { getExpenses } from "@/lib/queries/expenses"
import { ExpenseTable } from "./_components/ExpenseTable"

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string; search?: string }
}) {
  const expenses = await getExpenses({
    category: searchParams.category,
    page: Number(searchParams.page ?? 1),
  })

  return (
    <main>
      <h1>Expenses</h1>
      <ExpenseTable expenses={expenses} />
    </main>
  )
}
```

```tsx
// app/expenses/[id]/page.tsx
import { getExpenseById } from "@/lib/queries/expenses"

export default async function ExpensePage({
  params,
}: {
  params: { id: string }
}) {
  const expense = await getExpenseById(params.id)
  // notFound() is called inside getExpenseById if not found or unauthorized
  return <ExpenseDetail expense={expense} />
}
```

---

## Per-Request Deduplication with React.cache()

Wrap every query function in `React.cache()`. This deduplicates identical calls within a single request — if a layout and a page both call `getCurrentUser()`, only one database query runs.

```ts
// lib/queries/user.ts
import { cache } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/user"
import { redirect } from "next/navigation"

export const getCurrentUser = cache(async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  await connectDB()

  return User.findById(session.user.id)
    .select("name email")
    .lean()
})
```

`React.cache()` resets per request — it never leaks data between users. Use it for all query functions that may be called from multiple components in the same render tree.

---

## Parallel Fetching

When a page requires multiple independent datasets, fetch them in parallel using `Promise.all()`. Never await them sequentially.

```tsx
// app/(dashboard)/page.tsx
import { getExpenseSummary } from "@/lib/queries/expenses"
import { getBudgets } from "@/lib/queries/budgets"
import { getCurrentUser } from "@/lib/queries/user"

export default async function DashboardPage() {
  // All three queries start immediately and run in parallel
  const [summary, budgets, user] = await Promise.all([
    getExpenseSummary(),
    getBudgets(),
    getCurrentUser(),
  ])

  return (
    <main>
      <SummaryCards summary={summary} />
      <BudgetProgress budgets={budgets} user={user} />
    </main>
  )
}
```

For queries with partial dependencies, start each as early as possible rather than waiting for a prior query to finish:

```ts
// Correct: session check and config load start together
const sessionPromise = getServerSession(authOptions)
const configPromise = fetchAppConfig()

const session = await sessionPromise
if (!session?.user?.id) redirect("/sign-in")

const [config, expenses] = await Promise.all([
  configPromise,
  getExpenses({ userId: session.user.id }),
])
```

---

## Parallel Fetching via Component Composition

When sibling components fetch independent data, split the fetching into separate async Server Components rather than fetching everything in the parent. React renders sibling Server Components in parallel.

```tsx
// Wrong: RecentExpenses waits for Summary to finish
async function DashboardPage() {
  const summary = await getExpenseSummary()
  return (
    <div>
      <Summary data={summary} />
      <RecentExpenses />
    </div>
  )
}

// Correct: both components fetch independently and in parallel
async function Summary() {
  const data = await getExpenseSummary()
  return <SummaryCards data={data} />
}

async function RecentExpenses() {
  const expenses = await getRecentExpenses()
  return <ExpenseTable data={expenses} />
}

function DashboardPage() {
  return (
    <div>
      <Summary />
      <RecentExpenses />
    </div>
  )
}
```

---

## Suspense Boundaries for Streaming

Wrap async Server Components in `<Suspense>` so the page shell renders immediately while slower data streams in. Use `loading.tsx` for full-page loading states and inline `<Suspense>` for partial loading.

```tsx
// app/expenses/page.tsx — shell renders immediately
import { Suspense } from "react"
import { Spinner } from "@heroui/react"

export default function ExpensesPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string }
}) {
  return (
    <main>
      <h1>Expenses</h1>
      <Suspense fallback={<Spinner />}>
        <ExpenseTableServer searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function ExpenseTableServer({
  searchParams,
}: {
  searchParams: { category?: string; page?: string }
}) {
  const expenses = await getExpenses({
    category: searchParams.category,
    page: Number(searchParams.page ?? 1),
  })
  return <ExpenseTable expenses={expenses} />
}
```

Place `loading.tsx` alongside any `page.tsx` that performs async fetching. Next.js wraps the page in a `<Suspense>` boundary automatically and shows the loading UI during navigation.

Do not use Suspense for:
- SEO-critical content that must be in the initial HTML
- Queries fast enough that the skeleton flash is worse than waiting

---

## Passing Data to Client Components

Client Components receive data as serializable props from their Server Component parent. They never fetch data themselves.

```tsx
// Server Component — fetches data
async function ExpensesPage() {
  const expenses = await getExpenses()
  // Pass only the fields the client needs
  return <ExpenseTable expenses={expenses.map(e => ({
    id: e._id.toString(),
    description: e.description,
    amount: e.amount,
    category: e.category,
    date: e.date.toISOString(),
  }))} />
}

// Client Component — receives data, handles interaction
"use client"

function ExpenseTable({ expenses }: { expenses: SerializedExpense[] }) {
  // Sort and filter happen here on the already-fetched data
  const [sortKey, setSortKey] = useState<keyof SerializedExpense>("date")
  const sorted = useMemo(
    () => expenses.toSorted((a, b) => (a[sortKey] > b[sortKey] ? -1 : 1)),
    [expenses, sortKey]
  )
  // ...
}
```

### Rules for the RSC boundary

- Pass only the fields a Client Component actually uses — every prop crossing the boundary is serialized into the HTML response
- Convert Mongoose documents to plain objects with `.lean()` before passing them as props
- Convert `ObjectId` values to strings (`._id.toString()`) — `ObjectId` is not serializable
- Convert `Date` objects to ISO strings (`.toISOString()`) — `Date` is not serializable
- Do not pass full Mongoose documents, Mongoose model instances, or any non-plain object

---

## Search Params for Filtering and Pagination

Search params (`?key=value`) drive filtering, sorting, and pagination on list pages. They are read server-side from the `searchParams` prop on the page Server Component and passed into query functions.

```ts
// app/expenses/page.tsx
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: {
    category?: string
    from?: string
    to?: string
    page?: string
    search?: string
  }
}) {
  const expenses = await getExpenses({
    category: searchParams.category,
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(searchParams.to) : undefined,
    page: Number(searchParams.page ?? 1),
    search: searchParams.search,
  })

  return <ExpenseTable expenses={expenses} />
}
```

Never use `useSearchParams()` for values that only need to be read on the server. Validate and sanitize search param values before using them in database queries — treat them as untrusted user input.

---

## Caching and Revalidation

Next.js does not automatically cache Mongoose queries. Cached pages are invalidated explicitly after mutations using `revalidatePath` or `revalidateTag` inside Server Actions (see `docs/data-mutations.md`).

To associate a page's data with a cache tag so it can be invalidated across multiple routes:

```ts
// lib/queries/expenses.ts
import { unstable_cache } from "next/cache"

export const getExpenses = unstable_cache(
  async (userId: string, filters: ExpenseFilters) => {
    await connectDB()
    return Expense.find({ userId, ...buildQuery(filters) }).lean()
  },
  ["expenses"],
  { tags: ["expenses"] }
)
```

After a successful mutation, the Server Action calls:

```ts
revalidateTag("expenses")     // invalidates all pages tagged "expenses"
revalidatePath("/expenses")   // or invalidate a specific route
```

For data that changes frequently (per-user, per-request), skip `unstable_cache` and fetch fresh on every request. Use `unstable_cache` only for data shared across users or infrequently updated reference data.

---

## Security Summary

| Rule | Reason |
|---|---|
| Always call `getServerSession` at the top of every query | Identity must be verified before any data is read |
| Always include `{ userId: session.user.id }` in every query filter | Prevents one user from reading another user's data |
| Never accept `userId` as a parameter | Callers cannot supply or override the identity |
| Call `notFound()` for missing **or** unauthorized documents | Avoids leaking whether a document exists |
| Never return full Mongoose documents to Client Components | Avoids exposing internal fields, `__v`, hashed passwords |
| Treat search params as untrusted input | Validate before use in queries to prevent injection |
| Redirect to `/sign-in` if session is missing, not a 401 response | Consistent UX for unauthenticated page requests |

---

## Summary: Data Fetching Flow

```
Request arrives at a protected route
  └── proxy.ts verifies JWT → redirect to /sign-in if missing
        └── Server Component page renders
              ├── Calls query functions from lib/queries/*
              │     ├── getServerSession() → redirect if no session
              │     ├── connectDB()
              │     └── DB query scoped to session.user.id
              ├── Independent queries run in parallel (Promise.all)
              ├── Results passed as serializable props to Client Components
              └── Slow sections wrapped in <Suspense> for streaming

Mutation occurs (Server Action)
  └── revalidatePath / revalidateTag
        └── Next.js purges cached output → fresh fetch on next request
```
