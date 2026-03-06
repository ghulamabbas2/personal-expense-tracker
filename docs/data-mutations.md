# Data Mutations Specification — Personal Expense Tracker

## Overview

All data mutations (create, update, delete) are performed exclusively through **Next.js Server Actions**. No mutation logic lives on the client. No additional API Route Handlers are created for mutating data — Route Handlers are reserved for `GET` requests that external callers or client-side data-fetching libraries need to reach.

This constraint simplifies the stack: there is one place to look for any write operation, every mutation is always server-executed and never exposed as a raw HTTP endpoint that could be hit without the Server Action's built-in protections, and TypeScript types flow end-to-end from the form to the database without any serialization gap.

---

## The Rule

> **Every write to the database goes through a Server Action. No exceptions.**

- No `fetch('/api/...')` calls that mutate state from Client Components
- No `POST`, `PATCH`, or `DELETE` Route Handlers for app-internal mutations
- No mutation logic inside Client Components beyond calling a Server Action
- No `FormData` — inputs are typed objects validated by Zod before reaching any business logic

---

## File Structure

Server Actions are co-located with the route segment they serve. One `actions.ts` file per feature.

```
app/
  (auth)/
    sign-up/
      actions.ts          # registerUser
  expenses/
    actions.ts            # createExpense, updateExpense, deleteExpense
  budgets/
    actions.ts            # upsertBudget, deleteBudget
  settings/
    profile/
      actions.ts          # updateProfile, changePassword
```

Every `actions.ts` file begins with `"use server"`. No other directive is required.

---

## Typed Inputs — Never FormData

Server Actions accept **strongly typed arguments**, not `FormData`. This keeps the function signature explicit, enables TypeScript inference on the call site, and makes Zod validation straightforward.

```ts
// Wrong: opaque, untyped, no static analysis possible
export async function createExpense(formData: FormData) {
  const description = formData.get('description') as string
  // ...
}

// Correct: typed, validated, statically analysable
export async function createExpense(data: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createExpenseSchema.safeParse(data)
  // ...
}
```

Accept `unknown` as the parameter type for the raw input so TypeScript enforces that Zod validation is the gate through which all data must pass before any field is accessed.

---

## The ActionResult Type

All Server Actions return a discriminated union — never throw. Throwing from a Server Action sends an opaque error to the client and makes it impossible for the Client Component to handle the failure gracefully.

```ts
// lib/types.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fields?: Record<string, string[]> }
```

- `success: true` — the action completed; optional `data` carries any response payload
- `success: false, error` — a form-level or general error message the UI can show in an `Alert`
- `success: false, fields` — field-level validation errors keyed by field name; the Client Component maps these back into `react-hook-form` via `setError`

---

## The Canonical Action Pattern

Every Server Action follows this exact order: **authenticate → validate → business logic**. No step is skipped or reordered.

```ts
// app/expenses/actions.ts
"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import { createExpenseSchema } from "@/lib/schemas/expense"
import Expense from "@/lib/models/expense"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/lib/types"

export async function createExpense(data: unknown): Promise<ActionResult<{ id: string }>> {
  // 1. Authenticate — identity comes from the server session, never from the input
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  // 2. Validate — parse and validate with Zod before touching any field
  const parsed = createExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 3. Business logic — userId is always from the session, never from the input
  try {
    await connectDB()
    const expense = await Expense.create({
      ...parsed.data,
      userId: session.user.id,
    })

    revalidatePath("/expenses")
    return { success: true, data: { id: expense._id.toString() } }
  } catch (err) {
    console.error("[createExpense] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
```

### Rules that apply to every action

- `getServerSession` is called first — the session is the only source of the user's identity
- `userId` is **never** accepted from `data` or any parameter — it is always derived from `session.user.id`
- Zod validation runs before any database operation, even if authentication already passed
- Database errors are caught, logged with context (not exposed), and returned as a generic message
- `revalidatePath` or `revalidateTag` is called on success to invalidate cached data for the affected route

---

## Update and Delete Actions

Update and delete actions follow the same pattern with one additional step: ownership verification. The query itself enforces it by including `userId` as a filter — if the document does not exist or does not belong to the user, the query returns nothing.

```ts
// app/expenses/actions.ts
export async function updateExpense(
  id: string,
  data: unknown
): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  const parsed = updateExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  try {
    await connectDB()
    // userId filter in the query is the ownership check — no separate lookup needed
    const expense = await Expense.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { $set: parsed.data },
      { new: true }
    )

    if (!expense) {
      // Do not reveal whether the document exists but belongs to another user
      return { success: false, error: "Expense not found." }
    }

    revalidatePath("/expenses")
    return { success: true }
  } catch (err) {
    console.error("[updateExpense] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in to do this." }
  }

  try {
    await connectDB()
    const deleted = await Expense.findOneAndDelete({
      _id: id,
      userId: session.user.id,
    })

    if (!deleted) {
      return { success: false, error: "Expense not found." }
    }

    revalidatePath("/expenses")
    return { success: true }
  } catch (err) {
    console.error("[deleteExpense] Failed for user:", session.user.id, err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}
```

---

## Client Integration

Client Components call Server Actions using `useTransition`. The `isPending` flag drives loading state. Field errors returned from the action are mapped back into `react-hook-form` using `setError`. Form-level errors are shown with a HeroUI `Alert`.

```tsx
// app/expenses/_components/AddExpenseForm.tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input, Button, Alert } from "@heroui/react"
import { createExpenseSchema, type CreateExpenseInput } from "@/lib/schemas/expense"
import { createExpense } from "../actions"

export function AddExpenseForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
  })

  function onSubmit(data: CreateExpenseInput) {
    setServerError(null)

    startTransition(async () => {
      const result = await createExpense(data)

      if (!result.success) {
        if (result.fields) {
          // Map server field errors back into react-hook-form
          for (const [field, messages] of Object.entries(result.fields)) {
            setError(field as keyof CreateExpenseInput, { message: messages[0] })
          }
        } else {
          setServerError(result.error)
        }
        return
      }

      reset()
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && (
        <Alert color="danger" title="Error" description={serverError} className="mb-4" />
      )}

      <Input
        {...register("description")}
        label="Description"
        labelPlacement="outside"
        isInvalid={!!errors.description}
        errorMessage={errors.description?.message}
        isRequired
      />

      <Input
        {...register("amount", { valueAsNumber: true })}
        type="number"
        label="Amount"
        labelPlacement="outside"
        startContent="$"
        isInvalid={!!errors.amount}
        errorMessage={errors.amount?.message}
        isRequired
      />

      <Button type="submit" color="primary" isLoading={isPending}>
        Add Expense
      </Button>
    </form>
  )
}
```

### Rules for client-side action calls

- Always use `useTransition` — never `useState` + manual `isLoading` flags for async actions
- Always call `setServerError(null)` at the start of `onSubmit` to clear stale errors
- Never pass `userId`, `session`, or any identity information as part of the action's input — the action derives identity from the session itself
- Never call a mutation action outside of a user-initiated event handler (no `useEffect` calling mutations)

---

## Optimistic Updates

For actions where the outcome is highly predictable (e.g., deleting an item, toggling a flag), use `useOptimistic` to update the UI immediately before the server responds.

```tsx
"use client"

import { useOptimistic, useTransition } from "react"
import { deleteExpense } from "../actions"
import type { Expense } from "@/lib/types"

export function ExpenseList({ initialExpenses }: { initialExpenses: Expense[] }) {
  const [isPending, startTransition] = useTransition()
  const [expenses, removeOptimistically] = useOptimistic(
    initialExpenses,
    (current, idToRemove: string) => current.filter((e) => e.id !== idToRemove)
  )

  function handleDelete(id: string) {
    startTransition(async () => {
      removeOptimistically(id)
      const result = await deleteExpense(id)
      if (!result.success) {
        // On failure, React automatically reverts the optimistic state
        // Show an error to the user here
      }
    })
  }

  return (
    <ul>
      {expenses.map((expense) => (
        <li key={expense.id}>
          {expense.description}
          <button onClick={() => handleDelete(expense.id)} disabled={isPending}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

Only use optimistic updates for actions that are unlikely to fail (e.g., deletes and simple toggles). Do not use them for creates where the server generates required data (like an `_id`) that the UI needs immediately.

---

## Cache Invalidation

After a successful mutation, call `revalidatePath` or `revalidateTag` to purge Next.js's full-route cache for the affected pages. This triggers a fresh server render the next time those routes are visited.

```ts
import { revalidatePath, revalidateTag } from "next/cache"

// Invalidate a specific page
revalidatePath("/expenses")

// Invalidate a specific dynamic route
revalidatePath(`/expenses/${id}`)

// Invalidate all routes that depend on a tag
revalidateTag("expenses")
```

### When to use which

| Situation | Use |
|---|---|
| Mutation affects a list page | `revalidatePath("/expenses")` |
| Mutation affects a single detail page | `revalidatePath(\`/expenses/${id}\`)` |
| Mutation affects multiple pages (e.g., dashboard + expenses) | `revalidateTag("expenses")` — tag queries with `{ next: { tags: ["expenses"] } }` |
| Mutation affects the user's profile data shown in the navbar | `revalidatePath("/", "layout")` |

Always call `revalidatePath` / `revalidateTag` **after** the database write succeeds and **before** returning `{ success: true }`. Never call it in error branches.

---

## What Never Goes in a Server Action's Input

The following values must never be accepted as action parameters and used in database queries:

| Value | Why |
|---|---|
| `userId` | Always derived from `session.user.id` — accepting it as input allows any authenticated user to mutate another user's data |
| `createdAt`, `updatedAt` | Set by the database or Mongoose timestamps — never by the client |
| `_id` for the document being created | Generated by MongoDB — never accepted as input |
| Raw Mongoose/MongoDB operators | Never construct queries from user-supplied strings or objects |

```ts
// Wrong: accepts userId from input
export async function createExpense(data: { userId: string; amount: number }) {
  await Expense.create(data) // any authenticated user can set any userId
}

// Correct: userId is locked to the session
export async function createExpense(data: unknown) {
  const session = await getServerSession(authOptions)
  const parsed = createExpenseSchema.safeParse(data)
  await Expense.create({ ...parsed.data, userId: session.user.id })
}
```

---

## Summary: Mutation Flow

```
User interaction (button click, form submit)
  └── Client Component calls Server Action via useTransition
        ├── Server Action: getServerSession → reject if no session
        ├── Server Action: Zod safeParse → return field errors if invalid
        ├── Server Action: DB write scoped to session.user.id
        │     ├── Success → revalidatePath → return { success: true }
        │     └── Failure → console.error (server only) → return { success: false, error: "..." }
        └── Client Component reads result
              ├── success: true → reset form / close modal / show success state
              ├── success: false, fields → setError per field (react-hook-form)
              └── success: false, error → setServerError → <Alert color="danger" />
```
