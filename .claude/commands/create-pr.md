You are helping create a professional GitHub pull request to merge a feature branch into `main`.

**Inputs provided:**
- Feature branch: $ARGUMENTS (first word — the branch name, e.g. `feature/expense-crud`)
- Summary: $ARGUMENTS (remaining words — a short description of what this PR does)

Parse $ARGUMENTS as: `<branch-name> "<summary>"` — the branch name is the first token, the rest is the summary.

---

## Step 1 — Analyze the current branch and changes

Run the following to gather context:

```bash
git status
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

Read the output carefully. Note:
- All commits made since diverging from `main`
- Files added, modified, or deleted
- The overall scope and intent of the changes

---

## Step 2 — Propose a PR title and description

Based on your analysis and the inputs provided, draft a **pull request proposal** and display it clearly to the user using this format:

---

### Proposed Pull Request

**Branch:** `<feature-branch>` → `main`

**Title:** `<concise, imperative-mood title under 70 characters>`

**Description:**

```
## Summary
- <bullet 1>
- <bullet 2>
- <bullet 3>

## Changes
- <file or area changed>: <what was done>
- ...

## Test Plan
- [ ] <manual or automated test step>
- [ ] <another step>

## Notes
<Any caveats, known issues, dependencies, or reviewer guidance>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Step 3 — Ask for explicit approval

After displaying the proposal, ask the user:

> "Does this look good? Should I generate the PR file? You can also request changes before I proceed."

**Do NOT proceed until the user explicitly confirms** (e.g., says "yes", "looks good", "go ahead", "approved", etc.). If they request edits, revise the proposal and ask again.

---

## Step 4 — Generate the PR file (only after approval)

Once the user approves, create a Markdown file at:

```
.claude/pull-requests/<branch-name-slugified>-pr.md
```

Where `<branch-name-slugified>` replaces `/` with `-` (e.g., `feature/expense-crud` → `feature-expense-crud`).

The file should contain the full, final PR description in this format:

```markdown
# Pull Request: <Title>

**Branch:** `<feature-branch>` → `main`
**Date:** <today's date in YYYY-MM-DD>
**Author:** <git config user.name if available>

---

## Summary
<bullet points>

## Changes
<list of changed files/areas with descriptions>

## Test Plan
<checklist>

## Notes
<any additional context>

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

After writing the file, confirm to the user:

> "PR file created at `.claude/pull-requests/<filename>.md`. You can copy the description from there when opening the PR on GitHub."

---

## Best Practices to Follow

- PR title must be in **imperative mood** (e.g., "Add", "Fix", "Implement") and under 70 characters
- Summary bullets should describe **what** changed and **why**, not how
- Test plan must be actionable checklist items a reviewer can follow
- Avoid vague entries like "misc fixes" — be specific
- Never fabricate changes — only describe what the diff actually shows
