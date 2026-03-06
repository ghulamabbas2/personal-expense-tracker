# AI-Assisted Development Workflow

## Overview

This document defines how AI-assisted development works in this project. The goal is to keep humans in control of every architectural and implementation decision. AI generates no code until a plan has been proposed, reviewed, and explicitly approved.

---

## The Rule

> **Plan first. Code only after approval.**

When given any task that involves writing or modifying code, the AI must stop after the planning phase and wait. It does not proceed to implementation until the user responds with explicit approval.

---

## Workflow Phases

### Phase 1 — Understand the Task

Before proposing anything, the AI must:

- Read and fully understand the request
- Re-read any relevant files in `/docs` that apply to the task (e.g., `ui.md` for UI work, `auth.md` for anything auth-related)
- Identify which existing files, components, or modules are affected
- Ask clarifying questions if the requirement is ambiguous — do not assume and proceed

### Phase 2 — Propose the Plan

The AI presents a structured plan covering all three of the following sections. Nothing is omitted.

#### 1. Technical Summary

A short plain-English explanation of what will be built or changed and why. No jargon. This should be understandable without reading the rest of the plan.

#### 2. Architecture

- Which files will be created and which will be modified
- How the new code fits into the existing project structure
- Data flow: how data moves between components, server actions, API routes, and the database
- Any new dependencies required (package name and reason)
- How the change interacts with auth, the database schema, or other subsystems

#### 3. Implementation Steps

A numbered, sequential list of concrete steps the AI will take. Each step must:

- Reference the specific file(s) it touches
- State clearly what will be added, changed, or removed
- Be granular enough that each step could be reviewed independently

Example format:

```
1. Create `app/expenses/page.tsx` — server component that fetches the authenticated user's expenses and renders the ExpenseTable component
2. Create `app/expenses/actions.ts` — server actions for createExpense, updateExpense, deleteExpense; each scoped to session.user.id
3. Update `lib/db/schemas/expense.ts` — add the `notes` field (String, optional)
4. Create `components/ExpenseTable.tsx` — client component using HeroUI Table with sort and pagination state
```

### Phase 3 — Wait for Approval

After presenting the plan, the AI stops and waits.

The AI must not:
- Write any code
- Create or edit any files
- Make assumptions about approval based on prior context
- Interpret silence or partial responses as approval

The AI must wait for one of the following before proceeding:

| Signal | Meaning |
|---|---|
| "approved", "looks good", "go ahead", "yes", "proceed" | Proceed with full implementation as planned |
| Specific feedback or modifications | Revise the plan, then wait for approval again |
| "cancel" or "stop" | Abandon the task |

If the user asks a question instead of approving, the AI answers the question and continues to wait.

### Phase 4 — Implement

Once approval is given, the AI implements exactly what was described in the approved plan — no more, no less.

- Follow all relevant `/docs` specifications throughout implementation
- Do not introduce features, abstractions, or changes that were not in the plan
- If an unexpected blocker or ambiguity arises mid-implementation, stop and report it before continuing
- After implementation, provide a brief summary of what was done and flag anything the user should verify or test

---

## Scope Rules

These rules apply at all times, regardless of phase:

- **No speculative changes.** Only touch files mentioned in the approved plan.
- **No scope creep.** If something adjacent looks like it could be improved, note it separately — do not fix it unasked.
- **No framework upgrades or dependency changes** beyond what the plan explicitly listed.
- **Always check `/docs` first.** If the task touches UI, auth, or any other documented subsystem, re-read the relevant doc before writing the plan. The docs are the source of truth.

---

## Amending an Approved Plan

If during implementation the AI discovers that the plan needs to change (e.g., a file doesn't exist as expected, or a dependency has a conflicting API), it must:

1. Stop immediately
2. Describe the discrepancy clearly
3. Propose the amendment
4. Wait for approval before continuing

---

## Example Interaction

**User:** Add the ability to delete an expense from the expenses list.

**AI (Phase 1 + 2):**

> Before writing any code, here is the proposed plan:
>
> **Technical Summary**
> Add a delete action to each row in the expenses table. Clicking delete will show a confirmation modal, then call a server action to remove the expense from the database. Only the owner of the expense can delete it.
>
> **Architecture**
> - New server action `deleteExpense(id)` in `app/expenses/actions.ts`
> - Server action verifies `session.user.id` matches the expense's `userId` before deleting
> - Client component `ExpenseTable` opens a HeroUI `Modal` to confirm before calling the action
> - No new dependencies required
>
> **Implementation Steps**
> 1. Open `app/expenses/actions.ts` — add `deleteExpense(id: string)` server action; fetch the expense by `_id` and `userId: session.user.id`, return a 403 error if not found
> 2. Update `components/ExpenseTable.tsx` — add a delete icon button per row (HeroUI `Button`, `isIconOnly`, `variant="light"`, `color="danger"`), wire it to open a confirmation `Modal`
> 3. Update the `Modal` confirm button to call `deleteExpense` and refresh the list on success
>
> **Waiting for your approval before writing any code.**

**User:** Approved.

**AI (Phase 4):** *(begins implementation)*

---

## Rationale

This workflow exists because:

- Unreviewed code generation leads to architectural drift and hard-to-reverse mistakes
- Plans are cheap to change; code is expensive to undo
- Explicit approval keeps the human in control of what goes into the codebase
- Reviewing a plan takes seconds; reviewing unexpected code takes much longer
