# Errors & Validation Specification — Personal Expense Tracker

## Overview

All input validation is handled with [Zod](https://zod.dev). All user-visible error messages are rendered with HeroUI `Alert` components. Technical details, stack traces, and internal error messages are never exposed to the client. Every layer of the stack — Server Actions, Route Handlers, and Client Components — follows a consistent pattern for producing and consuming errors.

---

## Principles

- **Validate at every boundary.** Validate on the client for fast feedback. Re-validate on the server unconditionally — client validation can be bypassed.
- **Never expose internals.** Database errors, stack traces, and Mongoose/Zod internals are logged server-side only. The client receives safe, human-readable messages.
- **Use one validation library.** Zod is the single source of truth for all schemas. No ad-hoc manual checks alongside Zod.
- **Consistent shape.** All server errors follow the same response structure so the client always knows how to read them.
- **Accessible errors.** HeroUI `Alert` communicates errors. HeroUI `Input` `isInvalid` and `errorMessage` props communicate field-level errors. Never use `alert()` or `console.error` for user-facing messages.

---

## Zod Schemas

### Location

All Zod schemas live in `lib/schemas/`. One file per resource. Schemas are shared between Client Components (for client-side validation) and Server Actions / Route Handlers (for server-side validation).

```
lib/
  schemas/
    expense.ts      # Expense create and update schemas
    budget.ts       # Budget create and update schemas
    user.ts         # Sign-up, profile update, password change schemas
    auth.ts         # Sign-in schema
```

### Naming convention

| Schema | Purpose |
|---|---|
| `createExpenseSchema` | Validates the body of a create request |
| `updateExpenseSchema` | Validates the body of an update request (all fields optional via `.partial()`) |
| `signInSchema` | Validates sign-in credentials |
| `signUpSchema` | Validates registration input including password confirmation |
| `updateProfileSchema` | Validates profile field updates |
| `changePasswordSchema` | Validates current + new + confirm password |

### Example schemas

```ts
// lib/schemas/expense.ts
import { z } from 'zod'

export const createExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than zero')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  category: z.enum(
    ['food', 'transport', 'housing', 'entertainment', 'health', 'shopping', 'other'],
    { errorMap: () => ({ message: 'Please select a valid category' }) }
  ),
  date: z.coerce.date({ errorMap: () => ({ message: 'Please enter a valid date' }) }),
  type: z.enum(['expense', 'income']),
  notes: z.string().max(500).optional(),
})

export const updateExpenseSchema = createExpenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
```

```ts
// lib/schemas/auth.ts
import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Please enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
```

---

## Error Response Shape

All Route Handlers and Server Actions that return errors use this consistent shape:

### Route Handler errors

```ts
// Success
Response.json({ data: <result> }, { status: 200 })

// Validation error (client sent bad data)
Response.json(
  { error: 'Validation failed', fields: <ZodFieldErrors> },
  { status: 400 }
)

// Auth error
Response.json({ error: 'Unauthorized' }, { status: 401 })

// Ownership / not found error
Response.json({ error: 'Not found' }, { status: 404 })

// Unexpected server error
Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
```

### Server Action errors (returned, not thrown)

Server Actions return a result object instead of throwing, so the Client Component can handle the error inline without crashing:

```ts
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fields?: Record<string, string[]> }
```

---

## Server-Side Validation Pattern

### In Route Handlers

```ts
// app/api/expenses/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createExpenseSchema } from '@/lib/schemas/expense'
import { ZodError } from 'zod'

export async function POST(request: Request) {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 3. Validate with Zod
  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // 4. Business logic
  try {
    const expense = await Expense.create({
      ...parsed.data,
      userId: session.user.id,
    })
    return Response.json({ data: expense }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/expenses]', err) // server-side only
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
```

### In Server Actions

```ts
// app/expenses/actions.ts
'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createExpenseSchema } from '@/lib/schemas/expense'
import type { ActionResult } from '@/lib/types'

export async function createExpense(
  data: unknown
): Promise<ActionResult<{ id: string }>> {
  // 1. Authenticate
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to do this.' }
  }

  // 2. Validate
  const parsed = createExpenseSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please fix the errors below.',
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 3. Business logic
  try {
    const expense = await Expense.create({
      ...parsed.data,
      userId: session.user.id,
    })
    return { success: true, data: { id: expense._id.toString() } }
  } catch (err) {
    console.error('[createExpense]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
}
```

**Order is always: authenticate → validate → business logic.** Never run a database query before both checks pass.

---

## Client-Side Validation Pattern

Client-side validation runs before the form is submitted to provide immediate feedback. It uses the same Zod schema as the server — import it directly.

Use `react-hook-form` with `@hookform/resolvers/zod` to wire Zod into form state. This eliminates manual `onChange` validation logic.

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input, Button, Select, SelectItem, Alert } from '@heroui/react'
import { createExpenseSchema, type CreateExpenseInput } from '@/lib/schemas/expense'
import { createExpense } from './actions'
import { useState, useTransition } from 'react'

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
        // Map field errors back into react-hook-form
        if (result.fields) {
          for (const [field, messages] of Object.entries(result.fields)) {
            setError(field as keyof CreateExpenseInput, {
              message: messages[0],
            })
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
      {/* Server-level error — shown above the form */}
      {serverError && (
        <Alert color="danger" title="Error" description={serverError} className="mb-4" />
      )}

      <Input
        {...register('description')}
        label="Description"
        labelPlacement="outside"
        isInvalid={!!errors.description}
        errorMessage={errors.description?.message}
        isRequired
      />

      <Input
        {...register('amount', { valueAsNumber: true })}
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

### Rules for client-side validation

- Always pass `noValidate` to `<form>` to disable native browser validation — it is less consistent and less accessible than custom error messages
- Use `isInvalid` and `errorMessage` props on HeroUI `Input`, `Select`, `Textarea`, and `DatePicker` — never display field errors in a separate `<p>` tag
- Field errors appear beneath the field they belong to, in red, immediately on blur or after first submit attempt
- Do not disable the submit button based on form validity — let the user submit and show errors; disabling submit is an accessibility anti-pattern

---

## User-Facing Error Display

### HeroUI Alert — for form-level and page-level errors

All non-field errors (server errors, auth errors, unexpected failures) are displayed using the HeroUI `Alert` component. Never use native `alert()`, `window.confirm()`, toast libraries, or raw `<p>` tags styled in red.

```tsx
import { Alert } from '@heroui/react'

// Server error above a form
<Alert
  color="danger"
  title="Unable to save expense"
  description="Something went wrong. Please try again."
/>

// Success confirmation
<Alert
  color="success"
  title="Expense added"
  description="Your expense has been saved."
/>

// Warning (e.g. over budget)
<Alert
  color="warning"
  title="Over budget"
  description="This expense puts you over your monthly budget for Food."
/>

// Informational
<Alert
  color="default"
  title="No expenses yet"
  description="Add your first expense to get started."
/>
```

### Alert placement rules

| Context | Where to place the Alert |
|---|---|
| Form submission error | Above the form, below the modal/page header |
| Page-level data fetch error | At the top of the page content area, replacing the data section |
| Inline action error (e.g. delete failed) | Inside the modal or panel where the action was triggered |
| Success after form submit | Replace the form or show above the form before closing the modal |

### HeroUI Input error — for field-level errors

Field-level validation errors are shown inline using `Input` props, not `Alert`:

```tsx
<Input
  label="Email"
  labelPlacement="outside"
  isInvalid={!!errors.email}
  errorMessage={errors.email?.message}
/>
```

---

## Error Boundary (`error.tsx`)

Every route segment that fetches data should have a sibling `error.tsx` file. This file is the last line of defence for unexpected rendering errors — it prevents the entire app from crashing and shows a recoverable UI.

```tsx
// app/expenses/error.tsx
'use client'

import { Alert, Button } from '@heroui/react'

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Alert
        color="danger"
        title="Something went wrong"
        description="We couldn't load your expenses. Please try again."
      />
      <Button color="primary" variant="flat" onPress={reset}>
        Try again
      </Button>
    </div>
  )
}
```

### Rules for `error.tsx`

- Must be a Client Component (`"use client"`)
- Never render `error.message` or any property of the `error` object to the user — it may contain internal details
- Always offer a `reset()` button so the user can recover without a full page reload
- Log the error server-side if possible; in Client Components use a logging service (e.g., Sentry) rather than `console.error`

---

## Not-Found Pages (`not-found.tsx`)

Used when `notFound()` is called — for example, when a requested expense does not exist or does not belong to the authenticated user. The response is always the same regardless of the real reason (does not exist vs. not owned), to avoid leaking ownership information.

```tsx
// app/expenses/[id]/not-found.tsx
import { Alert, Button } from '@heroui/react'
import Link from 'next/link'

export default function ExpenseNotFound() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Alert
        color="default"
        title="Expense not found"
        description="This expense doesn't exist or you don't have access to it."
      />
      <Button as={Link} href="/expenses" color="primary" variant="flat">
        Back to expenses
      </Button>
    </div>
  )
}
```

---

## HTTP Status Code Reference

Route Handlers always return the correct HTTP status. The client reads `response.ok` or the status code to determine how to display the error.

| Status | When to use |
|---|---|
| `200 OK` | Successful GET, PATCH, DELETE |
| `201 Created` | Successful POST that creates a resource |
| `204 No Content` | Successful DELETE with no body |
| `400 Bad Request` | Invalid JSON body or Zod validation failure |
| `401 Unauthorized` | No session or invalid session |
| `403 Forbidden` | Authenticated but not allowed (e.g., wrong role) |
| `404 Not Found` | Resource does not exist or does not belong to the user |
| `409 Conflict` | Duplicate resource (e.g., budget for a category already exists) |
| `500 Internal Server Error` | Unexpected error — always use the generic message |

---

## Server-Side Logging

All unexpected errors are logged on the server with enough context to debug without exposing anything to the client.

```ts
// Pattern: [context] message, then the raw error
console.error('[createExpense] Failed to create expense for user', session.user.id, err)
```

Log format includes:
- `[context]` — the function or route where the error occurred
- A plain-English description of what was attempted
- The raw `err` object (only visible in server logs, never sent to the client)

In production, replace `console.error` with a structured logging service or error tracker (e.g., Sentry, Axiom). The pattern stays the same — only the destination changes.

---

## What Never Goes to the Client

The following must never appear in any response body, error message, or UI element shown to the user:

- Mongoose error messages (e.g., `E11000 duplicate key error`)
- Zod internal error objects (use `.flatten().fieldErrors` and pick only `message`)
- Stack traces
- File paths
- Database collection names or query details
- Environment variable names or values
- Internal user IDs in error messages
- The word "MongoDB", "Mongoose", "Zod", "Prisma", or any library name

---

## Summary: Error Flow by Layer

```
User fills form
  └── react-hook-form + Zod resolver
        ├── Field error → Input isInvalid + errorMessage (inline under field)
        └── Valid → submit

Server Action / Route Handler receives request
  ├── No session → 401 / { success: false, error: "You must be signed in." }
  ├── Zod fails → 400 / { success: false, error: "...", fields: { ... } }
  │     └── Client maps fields back into form via setError()
  ├── Business logic error (not found, conflict) → 404 / 409
  └── Unexpected error
        ├── console.error (server only)
        └── { success: false, error: "Something went wrong. Please try again." }
              └── Client displays <Alert color="danger" ... /> above the form
```
