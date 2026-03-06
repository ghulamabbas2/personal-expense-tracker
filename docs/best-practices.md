# React & Next.js Best Practices

Source: [vercel-labs/agent-skills — react-best-practices/AGENTS.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md)
Adapted for: Personal Expense Tracker (Next.js 16, React 19, App Router, TypeScript)

---

## Table of Contents

1. [Eliminating Waterfalls](#1-eliminating-waterfalls) — **CRITICAL**
2. [Bundle Size Optimization](#2-bundle-size-optimization) — **CRITICAL**
3. [Server-Side Performance](#3-server-side-performance) — **HIGH**
4. [Client-Side Data Fetching](#4-client-side-data-fetching) — **MEDIUM-HIGH**
5. [Re-render Optimization](#5-re-render-optimization) — **MEDIUM**
6. [Rendering Performance](#6-rendering-performance) — **MEDIUM**
7. [JavaScript Performance](#7-javascript-performance) — **LOW-MEDIUM**
8. [Advanced Patterns](#8-advanced-patterns) — **LOW**

---

## 1. Eliminating Waterfalls

**Impact: CRITICAL**

Waterfalls are the #1 performance killer. Each sequential `await` adds a full network round trip. Eliminating them yields the largest gains.

### 1.1 Defer Await Until Needed

Move `await` into the branch where it is actually used. Do not block code paths that never consume the result.

```ts
// Wrong: fetches even when skipping
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  if (skipProcessing) return { skipped: true }
  return processUserData(userData)
}

// Correct: fetches only when needed
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) return { skipped: true }
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### 1.2 Dependency-Based Parallelization

For operations with partial dependencies, start each task at the earliest possible moment rather than awaiting sequentially.

```ts
// Wrong: profile waits for config unnecessarily
const [user, config] = await Promise.all([fetchUser(), fetchConfig()])
const profile = await fetchProfile(user.id)

// Correct: config and profile run in parallel
const userPromise = fetchUser()
const profilePromise = userPromise.then(user => fetchProfile(user.id))
const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
])
```

### 1.3 Prevent Waterfall Chains in Route Handlers and Server Actions

Start all independent operations immediately; only await when the result is required.

```ts
// Wrong: sequential — config waits for auth
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const config = await fetchConfig()
  const data = await fetchData(session.user.id)
  return Response.json({ data, config })
}

// Correct: auth and config start together
export async function GET(request: Request) {
  const sessionPromise = getServerSession(authOptions)
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id),
  ])
  return Response.json({ data, config })
}
```

### 1.4 Promise.all() for Independent Operations

When async operations have no interdependencies, always run them concurrently.

```ts
// Wrong: 3 round trips
const user = await fetchUser()
const expenses = await fetchExpenses()
const budgets = await fetchBudgets()

// Correct: 1 round trip
const [user, expenses, budgets] = await Promise.all([
  fetchUser(),
  fetchExpenses(),
  fetchBudgets(),
])
```

### 1.5 Strategic Suspense Boundaries

Instead of awaiting data in async components before returning JSX, delegate data fetching to child components wrapped in `<Suspense>` so the page shell renders immediately.

```tsx
// Wrong: entire page waits for data
async function ExpensesPage() {
  const expenses = await fetchExpenses()
  return (
    <div>
      <Navbar />
      <ExpenseTable expenses={expenses} />
      <Footer />
    </div>
  )
}

// Correct: shell renders immediately, table streams in
function ExpensesPage() {
  return (
    <div>
      <Navbar />
      <Suspense fallback={<Spinner />}>
        <ExpenseTable />
      </Suspense>
      <Footer />
    </div>
  )
}

async function ExpenseTable() {
  const expenses = await fetchExpenses()
  return <Table data={expenses} />
}
```

Do not use Suspense for SEO-critical content above the fold, or for queries so fast that the skeleton flash is worse than waiting.

---

## 2. Bundle Size Optimization

**Impact: CRITICAL**

Reducing the initial bundle improves Time to Interactive and Largest Contentful Paint.

### 2.1 Avoid Barrel File Imports

Import directly from source files, not from library entry points. Barrel files can load thousands of unused modules.

```ts
// Wrong: loads ~1,583 modules
import { Check, X, Menu } from 'lucide-react'

// Correct: loads only 3 modules
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
```

**Preferred alternative for Next.js 16:** Use `optimizePackageImports` in `next.config.ts` so barrel imports are automatically transformed at build time without changing import syntax:

```ts
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroui/react'],
  },
}
```

Libraries commonly affected in this project: `lucide-react`, `@heroui/react`.

### 2.2 Conditional Module Loading

Load large data or heavy modules only when a feature is activated.

```tsx
function AnimationPlayer({ enabled, setEnabled }) {
  const [frames, setFrames] = useState(null)

  useEffect(() => {
    if (enabled && !frames && typeof window !== 'undefined') {
      import('./animation-frames.js')
        .then(mod => setFrames(mod.frames))
        .catch(() => setEnabled(false))
    }
  }, [enabled, frames, setEnabled])

  if (!frames) return <Spinner />
  return <Canvas frames={frames} />
}
```

### 2.3 Defer Non-Critical Third-Party Libraries

Analytics and error tracking do not need to block the initial bundle. Load them after hydration.

```tsx
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)
```

### 2.4 Dynamic Imports for Heavy Components

Use `next/dynamic` for large components that are not needed on initial render.

```tsx
import dynamic from 'next/dynamic'

const ExpenseChart = dynamic(
  () => import('@/components/ExpenseChart'),
  { ssr: false, loading: () => <Spinner /> }
)
```

### 2.5 Preload Based on User Intent

Preload heavy bundles on hover or focus to reduce perceived latency.

```tsx
function OpenChartButton({ onClick }) {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('@/components/ExpenseChart')
    }
  }
  return (
    <Button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      View Chart
    </Button>
  )
}
```

---

## 3. Server-Side Performance

**Impact: HIGH**

### 3.1 Authenticate Server Actions Like API Routes

**Server Actions are public HTTP endpoints.** Always verify the session inside each action. Never rely solely on middleware or layout guards — those can be bypassed by calling the action directly.

```ts
'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Wrong: no auth check
export async function deleteExpense(id: string) {
  await Expense.findByIdAndDelete(id)
}

// Correct: authenticate and authorize inside the action
export async function deleteExpense(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')

  const expense = await Expense.findOne({ _id: id, userId: session.user.id })
  if (!expense) throw new Error('Not found')

  await expense.deleteOne()
}
```

Always validate inputs with a schema (e.g., `zod`) before authenticating.

### 3.2 Avoid Duplicate Serialization at RSC Boundaries

React Server Component serialization deduplicates by object reference. Transformations like `.filter()` or `.map()` create new references and cause duplicate serialization. Do transformations in the client component, not the server.

```tsx
// Wrong: serializes the array twice
<ExpenseList expenses={expenses} filtered={expenses.filter(e => e.amount > 100)} />

// Correct: pass once, filter in the client
<ExpenseList expenses={expenses} />
// Inside ExpenseList ("use client"):
const filtered = useMemo(() => expenses.filter(e => e.amount > 100), [expenses])
```

Only pass fields the client actually needs. Do not pass full Mongoose documents.

### 3.3 Cross-Request LRU Caching

`React.cache()` only deduplicates within a single request. For data shared across sequential requests, use an LRU cache.

```ts
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, unknown>({ max: 500, ttl: 5 * 60 * 1000 })

export async function getUserById(id: string) {
  const hit = cache.get(id)
  if (hit) return hit
  const user = await User.findById(id).lean()
  cache.set(id, user)
  return user
}
```

### 3.4 Hoist Static I/O to Module Level

Static assets (fonts, config files, templates) loaded in route handlers should be read once at module initialization, not on every request.

```ts
// Wrong: reads file on every request
export async function GET() {
  const font = await fs.readFile('./public/fonts/Inter.woff2')
  // ...
}

// Correct: reads once when module loads
const fontPromise = fs.readFile('./public/fonts/Inter.woff2')

export async function GET() {
  const font = await fontPromise
  // ...
}
```

Do not hoist user-specific, per-request, or frequently changing data.

### 3.5 Minimize Serialization at RSC Boundaries

Only pass the fields a client component actually uses. Every prop crossing the RSC boundary is serialized into the HTML response.

```tsx
// Wrong: serializes all 30+ Mongoose fields
async function Page() {
  const user = await User.findById(id).lean()
  return <ProfileCard user={user} />
}

// Correct: serializes 2 fields
async function Page() {
  const user = await User.findById(id).lean()
  return <ProfileCard name={user.name} email={user.email} />
}
```

### 3.6 Parallel Data Fetching with Component Composition

React Server Components execute sequentially in a tree. Split data fetching into sibling components so fetches run in parallel.

```tsx
// Wrong: Sidebar waits for Page to finish fetching
async function Page() {
  const summary = await fetchSummary()
  return (
    <div>
      <Summary data={summary} />
      <RecentExpenses />
    </div>
  )
}

// Correct: both fetch in parallel
async function Summary() {
  const data = await fetchSummary()
  return <SummaryCards data={data} />
}

async function RecentExpenses() {
  const expenses = await fetchRecentExpenses()
  return <ExpenseTable data={expenses} />
}

function Page() {
  return (
    <div>
      <Summary />
      <RecentExpenses />
    </div>
  )
}
```

### 3.7 Per-Request Deduplication with React.cache()

Use `React.cache()` to deduplicate database queries and auth checks within a single request. Multiple components calling the same function will share one query.

```ts
import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const getCurrentUser = cache(async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return User.findById(session.user.id).lean()
})
```

Note: Next.js automatically deduplicates `fetch()` calls. Use `React.cache()` for Mongoose queries, auth checks, and any non-fetch async work.

### 3.8 Use after() for Non-Blocking Operations

Use `after()` from `next/server` to schedule work (logging, analytics, notifications) after the response is sent.

```ts
import { after } from 'next/server'

export async function POST(request: Request) {
  await createExpense(request)

  after(async () => {
    await logAuditEvent({ action: 'create_expense' })
  })

  return Response.json({ success: true })
}
```

---

## 4. Client-Side Data Fetching

**Impact: MEDIUM-HIGH**

### 4.1 Deduplicate Global Event Listeners

Use `useSWRSubscription` to share a single global listener across multiple component instances instead of registering one per instance.

### 4.2 Use Passive Event Listeners for Scrolling

Add `{ passive: true }` to `touchstart` and `wheel` listeners. Browsers wait for non-passive listeners to check for `preventDefault()`, causing scroll delay.

```ts
document.addEventListener('touchstart', handler, { passive: true })
document.addEventListener('wheel', handler, { passive: true })
```

Only omit `passive` when you need to call `preventDefault()` (e.g., custom swipe/zoom gestures).

### 4.3 Use SWR for Automatic Deduplication

For client-side data fetching, use `swr`. Multiple components using the same key share one request automatically.

```tsx
import useSWR from 'swr'

function ExpenseList() {
  const { data: expenses, isLoading } = useSWR('/api/expenses', fetcher)
  if (isLoading) return <Spinner />
  return <Table data={expenses} />
}
```

For mutations, use `useSWRMutation`.

### 4.4 Version and Minimize localStorage Data

Always wrap `localStorage` in try-catch (throws in private browsing, quota exceeded, or disabled). Store only the fields you need, and version your keys for safe schema evolution.

```ts
const VERSION = 'v1'

function savePrefs(prefs: { theme: string }) {
  try {
    localStorage.setItem(`prefs:${VERSION}`, JSON.stringify(prefs))
  } catch {}
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(`prefs:${VERSION}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
```

Never store tokens, PII, or internal flags in `localStorage`.

---

## 5. Re-render Optimization

**Impact: MEDIUM**

### 5.1 Calculate Derived State During Rendering

If a value can be computed from props or state, do not store it in state or sync it via an effect. Derive it during render.

```tsx
// Wrong: redundant state + effect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// Correct: derived during render
const fullName = `${firstName} ${lastName}`
```

### 5.2 Defer State Reads to Usage Point

Do not subscribe to dynamic values (e.g., `useSearchParams`) if you only read them inside a callback. Read on demand instead.

```tsx
// Wrong: subscribes to all searchParam changes
const searchParams = useSearchParams()
const handleShare = () => {
  const ref = searchParams.get('ref')
  shareExpense(id, { ref })
}

// Correct: reads on demand
const handleShare = () => {
  const ref = new URLSearchParams(window.location.search).get('ref')
  shareExpense(id, { ref })
}
```

### 5.3 Do Not Wrap Simple Primitive Expressions in useMemo

When an expression is simple (a few operators) and returns a primitive (boolean, number, string), do not use `useMemo`. The hook's overhead exceeds any saving.

```tsx
// Wrong
const isLoading = useMemo(
  () => user.isLoading || expenses.isLoading,
  [user.isLoading, expenses.isLoading]
)

// Correct
const isLoading = user.isLoading || expenses.isLoading
```

### 5.4 Extract Default Non-Primitive Parameters to Constants

Inline default values for non-primitives (arrays, objects, functions) break memoization in `memo()` components because a new reference is created on every render.

```tsx
// Wrong: new function reference on every render
const ExpenseRow = memo(function ExpenseRow({ onDelete = () => {} }) { ... })

// Correct: stable reference
const NOOP = () => {}
const ExpenseRow = memo(function ExpenseRow({ onDelete = NOOP }) { ... })
```

### 5.5 Extract to Memoized Components

Extract expensive rendering into a `memo()` component so it can be skipped entirely via early returns.

```tsx
// Wrong: computes avatar even when loading
function Profile({ user, loading }) {
  const avatar = useMemo(() => computeAvatar(user), [user])
  if (loading) return <Skeleton />
  return <div>{avatar}</div>
}

// Correct: computation skipped when loading
const UserAvatar = memo(function UserAvatar({ user }) {
  const id = useMemo(() => computeAvatarId(user), [user])
  return <Avatar id={id} />
})

function Profile({ user, loading }) {
  if (loading) return <Skeleton />
  return <UserAvatar user={user} />
}
```

Note: If React Compiler is enabled, manual `memo()` and `useMemo()` are unnecessary. The compiler handles this automatically.

### 5.6 Narrow Effect Dependencies

Depend on primitive values rather than objects to avoid effects re-running on unrelated object field changes.

```tsx
// Wrong: re-runs on any user field change
useEffect(() => { track(user.id) }, [user])

// Correct: re-runs only when id changes
useEffect(() => { track(user.id) }, [user.id])
```

### 5.7 Put Interaction Logic in Event Handlers

If a side effect is triggered by a user action, run it in the event handler — not in state + effect. Effects re-run on unrelated changes and can duplicate the side effect.

```tsx
// Wrong: state + effect anti-pattern
const [submitted, setSubmitted] = useState(false)
useEffect(() => {
  if (submitted) postExpense()
}, [submitted])

// Correct
function handleSubmit() {
  postExpense()
}
```

### 5.8 Subscribe to Derived Boolean State

Subscribe to a derived boolean (e.g., `isMobile`) rather than a continuous value (e.g., `width`) to reduce re-render frequency.

```tsx
// Wrong: re-renders on every pixel of scroll
const width = useWindowWidth()
const isMobile = width < 768

// Correct: re-renders only when boolean flips
const isMobile = useMediaQuery('(max-width: 767px)')
```

### 5.9 Use Functional setState Updates

When updating state based on its current value, always use the functional form to avoid stale closures and unnecessary callback recreation.

```tsx
// Wrong: stale closure risk, callback recreated on every change
const addExpense = useCallback((expense) => {
  setExpenses([...expenses, expense])
}, [expenses])

// Correct: stable reference, no stale closure
const addExpense = useCallback((expense) => {
  setExpenses(curr => [...curr, expense])
}, [])
```

### 5.10 Use Lazy State Initialization

Pass a function to `useState` for expensive initial values so the computation runs only on the first render.

```tsx
// Wrong: JSON.parse runs on every render
const [settings, setSettings] = useState(
  JSON.parse(localStorage.getItem('settings') || '{}')
)

// Correct: runs only once
const [settings, setSettings] = useState(() => {
  try {
    const raw = localStorage.getItem('settings')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
})
```

### 5.11 Use Transitions for Non-Urgent Updates

Wrap non-urgent state updates (e.g., scroll tracking, search result updates) in `startTransition` to keep the UI responsive.

```tsx
import { startTransition } from 'react'

const handleSearch = (value: string) => {
  setQuery(value) // urgent: update input immediately
  startTransition(() => {
    setResults(filterExpenses(value)) // non-urgent: can be deferred
  })
}
```

### 5.12 Use useRef for Transient Values

Values that change frequently but do not need to trigger a re-render (mouse position, interval IDs, transient flags) belong in `useRef`, not `useState`.

```tsx
// Wrong: re-renders on every mouse move
const [mouseX, setMouseX] = useState(0)
useEffect(() => {
  window.addEventListener('mousemove', e => setMouseX(e.clientX))
}, [])

// Correct: no re-render
const mouseXRef = useRef(0)
useEffect(() => {
  window.addEventListener('mousemove', e => { mouseXRef.current = e.clientX })
}, [])
```

---

## 6. Rendering Performance

**Impact: MEDIUM**

### 6.1 Animate SVG Wrapper Instead of SVG Element

Many browsers do not GPU-accelerate CSS animations on SVG elements. Wrap SVGs in a `<div>` and animate the wrapper.

```tsx
// Wrong: no GPU acceleration
<svg className="animate-spin">...</svg>

// Correct: GPU accelerated
<div className="animate-spin">
  <svg>...</svg>
</div>
```

### 6.2 CSS content-visibility for Long Lists

For long scrollable lists, apply `content-visibility: auto` to defer layout and paint for off-screen items.

```css
.expense-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 56px; /* approximate row height */
}
```

For 1000 rows, the browser skips layout/paint for ~990 off-screen rows, giving a 10× faster initial render.

### 6.3 Hoist Static JSX Elements

Extract JSX that never changes outside the component to avoid recreating the element on every render.

```tsx
// Wrong: creates new element every render
function Container() {
  return <div>{loading && <LoadingSkeleton />}</div>
}

// Correct: reuses the same element
const loadingSkeleton = <div className="animate-pulse h-12 bg-default-100 rounded-xl" />

function Container() {
  return <div>{loading && loadingSkeleton}</div>
}
```

Note: React Compiler handles this automatically if enabled.

### 6.4 Optimize SVG Precision

Reduce SVG path coordinate decimal places to cut file size. Use SVGO to automate:

```bash
npx svgo --precision=1 --multipass icon.svg
```

### 6.5 Prevent Hydration Mismatch Without Flickering

For content that depends on `localStorage` (e.g., theme), inject a synchronous inline script that patches the DOM before React hydrates — avoiding both SSR failure and post-hydration flash.

```tsx
function ThemeWrapper({ children }) {
  return (
    <>
      <div id="theme-root">{children}</div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var t = localStorage.getItem('theme') || 'light';
                document.getElementById('theme-root').className = t;
              } catch(e) {}
            })();
          `,
        }}
      />
    </>
  )
}
```

### 6.6 Suppress Expected Hydration Mismatches

For values that are intentionally different on server vs client (timestamps, random IDs), use `suppressHydrationWarning`. Do not use it to hide real bugs.

```tsx
<span suppressHydrationWarning>{new Date().toLocaleString()}</span>
```

### 6.7 Use Activity Component for Show/Hide

For expensive components that toggle visibility frequently, use React's `<Activity>` to hide without unmounting, preserving state and DOM.

```tsx
import { Activity } from 'react'

function FilterPanel({ isOpen }) {
  return (
    <Activity mode={isOpen ? 'visible' : 'hidden'}>
      <ExpensiveFilterForm />
    </Activity>
  )
}
```

### 6.8 Use Explicit Conditional Rendering

Use ternary (`? :`) instead of `&&` when the condition can be `0`, `NaN`, or another falsy value that renders as text.

```tsx
// Wrong: renders "0" when count is 0
{count && <Badge>{count}</Badge>}

// Correct: renders nothing
{count > 0 ? <Badge>{count}</Badge> : null}
```

### 6.9 Use useTransition Over Manual Loading States

Prefer `useTransition` to manual `isLoading` state. It gives a built-in `isPending` flag and automatically handles error and interrupt cases.

```tsx
const [isPending, startTransition] = useTransition()

const handleSearch = (value: string) => {
  setQuery(value)
  startTransition(async () => {
    const data = await fetchExpenses(value)
    setExpenses(data)
  })
}
```

---

## 7. JavaScript Performance

**Impact: LOW-MEDIUM**

### 7.1 Avoid Layout Thrashing

Never interleave DOM style writes with layout reads. Batch all writes first, then read.

```ts
// Wrong: forces 2 reflows
element.style.width = '100px'
const width = element.offsetWidth  // forced reflow
element.style.height = '200px'

// Correct: batch writes, read once
element.style.width = '100px'
element.style.height = '200px'
const { width, height } = element.getBoundingClientRect()
```

Prefer toggling CSS classes over manipulating inline styles.

### 7.2 Build Index Maps for Repeated Lookups

Multiple `.find()` calls on the same array should use a `Map` instead.

```ts
// Wrong: O(n) per lookup
const user = users.find(u => u.id === expense.userId)

// Correct: O(1) per lookup
const userById = new Map(users.map(u => [u.id, u]))
const user = userById.get(expense.userId)
```

For 1000 expenses × 1000 users: 1 million operations → 2 thousand.

### 7.3 Cache Property Access in Loops

Cache deeply nested property reads outside hot loops.

```ts
// Wrong: 3 lookups × N iterations
for (let i = 0; i < arr.length; i++) {
  process(config.settings.threshold)
}

// Correct: 1 lookup total
const threshold = config.settings.threshold
const len = arr.length
for (let i = 0; i < len; i++) {
  process(threshold)
}
```

### 7.4 Cache Repeated Function Calls

Use a module-level `Map` to memoize pure function results called repeatedly with the same input.

```ts
const slugifyCache = new Map<string, string>()

function cachedSlugify(text: string): string {
  if (slugifyCache.has(text)) return slugifyCache.get(text)!
  const result = slugify(text)
  slugifyCache.set(text, result)
  return result
}
```

### 7.5 Cache Storage API Calls

`localStorage` and `document.cookie` are synchronous and relatively expensive. Cache reads in a module-level `Map` and keep the cache in sync on writes.

```ts
const storageCache = new Map<string, string | null>()

function getLocal(key: string) {
  if (!storageCache.has(key)) {
    try { storageCache.set(key, localStorage.getItem(key)) } catch { storageCache.set(key, null) }
  }
  return storageCache.get(key)
}

function setLocal(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch {}
  storageCache.set(key, value)
}
```

Invalidate the cache on `storage` events and on `visibilitychange` (tab re-focus).

### 7.6 Combine Multiple Array Iterations

Multiple `.filter()` or `.map()` passes over the same array should be merged into a single loop.

```ts
// Wrong: 3 passes
const income = transactions.filter(t => t.type === 'income')
const expenses = transactions.filter(t => t.type === 'expense')
const pending = transactions.filter(t => t.status === 'pending')

// Correct: 1 pass
const income: Transaction[] = []
const expenses: Transaction[] = []
const pending: Transaction[] = []

for (const t of transactions) {
  if (t.type === 'income') income.push(t)
  if (t.type === 'expense') expenses.push(t)
  if (t.status === 'pending') pending.push(t)
}
```

### 7.7 Early Length Check for Array Comparisons

When comparing arrays with expensive operations, check lengths first. Arrays of different lengths cannot be equal.

```ts
function hasChanges(current: string[], original: string[]) {
  if (current.length !== original.length) return true
  const a = current.toSorted()
  const b = original.toSorted()
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true
  }
  return false
}
```

### 7.8 Early Return from Functions

Return as soon as the result is determined. Do not continue processing when the answer is already known.

```ts
// Wrong: checks every user even after finding an error
function validateExpenses(expenses: Expense[]) {
  let hasError = false
  for (const e of expenses) {
    if (!e.amount) hasError = true
  }
  return hasError
}

// Correct: returns on first error
function validateExpenses(expenses: Expense[]) {
  for (const e of expenses) {
    if (!e.amount) return { valid: false, error: 'Amount required' }
  }
  return { valid: true }
}
```

### 7.9 Hoist RegExp Creation

Do not create `RegExp` objects inside render. Hoist static patterns to module scope; memoize dynamic patterns with `useMemo`.

```tsx
// Wrong: new RegExp every render
function Highlighter({ text, query }) {
  const regex = new RegExp(`(${query})`, 'gi')
  // ...
}

// Correct: static at module scope, dynamic memoized
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/

function Highlighter({ text, query }) {
  const regex = useMemo(
    () => new RegExp(`(${escapeRegex(query)})`, 'gi'),
    [query]
  )
  // ...
}
```

Caution: global regex (`/g`) has mutable `lastIndex` state — reset it or avoid hoisting when state matters.

### 7.10 Use Loop for Min/Max Instead of Sort

Finding a min or max value requires only a single pass. Sorting just to get the first or last element is wasteful.

```ts
// Wrong: O(n log n)
const latest = expenses.sort((a, b) => b.date - a.date)[0]

// Correct: O(n)
function getLatest(expenses: Expense[]) {
  if (!expenses.length) return null
  let latest = expenses[0]
  for (let i = 1; i < expenses.length; i++) {
    if (expenses[i].date > latest.date) latest = expenses[i]
  }
  return latest
}
```

### 7.11 Use Set/Map for O(1) Lookups

Convert arrays to `Set` or `Map` when performing repeated membership checks.

```ts
// Wrong: O(n) per check
const allowedCategories = ['food', 'transport', 'housing']
expenses.filter(e => allowedCategories.includes(e.category))

// Correct: O(1) per check
const allowedCategories = new Set(['food', 'transport', 'housing'])
expenses.filter(e => allowedCategories.has(e.category))
```

### 7.12 Use toSorted() Instead of sort() for Immutability

`.sort()` mutates the array in place — a bug in React where props and state must be treated as read-only. Always use `.toSorted()` for a new sorted copy.

```tsx
// Wrong: mutates the expenses prop
const sorted = useMemo(
  () => expenses.sort((a, b) => b.amount - a.amount),
  [expenses]
)

// Correct: creates a new array
const sorted = useMemo(
  () => expenses.toSorted((a, b) => b.amount - a.amount),
  [expenses]
)
```

Also prefer `.toReversed()`, `.toSpliced()`, and `.with()` for other immutable array operations.

---

## 8. Advanced Patterns

**Impact: LOW**

### 8.1 Initialize App Once, Not Per Mount

App-wide initialization that must run exactly once (loading config, checking tokens) does not belong in `useEffect([])`. Components can remount and effects re-run. Use a module-level guard instead.

```tsx
// Wrong: re-runs on remount, runs twice in dev
function App() {
  useEffect(() => {
    loadConfig()
    checkAuthToken()
  }, [])
}

// Correct: runs once per app load
let didInit = false

function App() {
  useEffect(() => {
    if (didInit) return
    didInit = true
    loadConfig()
    checkAuthToken()
  }, [])
}
```

### 8.2 Store Event Handlers in Refs

When a callback is used inside an effect that should not re-subscribe on every render, use `useEffectEvent` to get a stable reference.

```tsx
import { useEffectEvent } from 'react'

function useWindowEvent(event: string, handler: (e: Event) => void) {
  const onEvent = useEffectEvent(handler)

  useEffect(() => {
    window.addEventListener(event, onEvent)
    return () => window.removeEventListener(event, onEvent)
  }, [event]) // handler intentionally omitted
}
```

### 8.3 useEffectEvent for Stable Callback Refs

Access the latest value of a callback inside an effect without adding it to the dependency array, preventing effect re-subscription while also avoiding stale closures.

```tsx
import { useEffectEvent } from 'react'

function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('')
  const onSearchEvent = useEffectEvent(onSearch)

  useEffect(() => {
    const timeout = setTimeout(() => onSearchEvent(query), 300)
    return () => clearTimeout(timeout)
  }, [query]) // onSearch is not a dependency
}
```

---

## References

1. [react.dev](https://react.dev)
2. [nextjs.org](https://nextjs.org)
3. [swr.vercel.app](https://swr.vercel.app)
4. [vercel-labs/agent-skills — AGENTS.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md)
5. [Vercel: How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
6. [Vercel: How we made the Vercel dashboard twice as fast](https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast)
7. [lru-cache](https://github.com/isaacs/node-lru-cache)
