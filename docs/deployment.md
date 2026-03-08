# Deployment Specification — Personal Expense Tracker

## Overview

This document defines how the application is built, containerized, and deployed. Deployments are fully automated through a GitHub Actions CI/CD pipeline. Two deployment flows exist:

- **Feature branches** — every pull request targeting `main` triggers a preview deployment to Vercel, giving developers a live URL to review changes before merge.
- **Main branch** — every merge to `main` triggers a production deployment to Vercel.

Docker is used to produce a consistent, reproducible build artifact. The container is built in CI and used to validate the production build before Vercel takes ownership of the actual hosting.

---

## Deployment Flows

### Feature Branch → Preview Deployment

```
Developer pushes feature branch
        ↓
Opens pull request → GitHub Actions triggered
        ↓
CI pipeline runs:
  1. Install dependencies
  2. Lint (ESLint)
  3. Type-check (tsc --noEmit)
  4. Build Docker image (validates production build)
  5. Run tests (if present)
        ↓
All checks pass → Vercel Preview deployment created
        ↓
PR comment posted with preview URL
        ↓
Developer reviews live preview before requesting review
```

**Purpose:** Catch build failures, type errors, and lint violations before code reaches `main`. Preview deployments are isolated per-PR — each PR gets its own URL that updates on every push.

---

### Main Branch → Production Deployment

```
PR merged to main
        ↓
GitHub Actions triggered on push to main
        ↓
CI pipeline runs:
  1. Install dependencies
  2. Lint
  3. Type-check
  4. Build Docker image
  5. Run tests
        ↓
All checks pass → Vercel Production deployment promoted
        ↓
Live at production domain
```

**Rule:** Nothing is deployed to production without passing the full CI pipeline. Direct pushes to `main` are blocked — all changes must go through a pull request.

---

## Docker Configuration

Docker produces a minimal, production-ready image using Next.js standalone output mode.

### `Dockerfile`

```dockerfile
# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args are injected at build time for NEXT_PUBLIC_ variables only.
# Server-side secrets are never baked into the image.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# ─── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only what Next.js needs at runtime (standalone output)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### `.dockerignore`

```
node_modules
.next
.env
.env.local
.env.production
.env.*.local
*.log
.git
.gitignore
README.md
```

### `next.config.ts` — Standalone Output

Next.js must be configured to emit a standalone build so Docker can copy only the necessary runtime files:

```ts
const nextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

---

## GitHub Actions Workflows

### Preview Deployment — `.github/workflows/preview.yml`

Runs on every pull request targeting `main`.

```yaml
name: Preview Deployment

on:
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Build & Validate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npx tsc --noEmit

      - name: Build Docker image
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_APP_URL=${{ vars.NEXT_PUBLIC_APP_URL }} \
            -t expense-tracker:pr-${{ github.event.pull_request.number }} \
            .

  deploy-preview:
    name: Deploy Preview to Vercel
    runs-on: ubuntu-latest
    needs: ci

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Deploy Preview
        id: deploy
        run: |
          url=$(vercel deploy \
            --token=${{ secrets.VERCEL_TOKEN }} \
            --env MONGODB_URI=${{ secrets.MONGODB_URI_PREVIEW }} \
            --env NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }} \
            --env NEXTAUTH_URL=${{ vars.NEXTAUTH_URL_PREVIEW }})
          echo "preview_url=$url" >> $GITHUB_OUTPUT

      - name: Post Preview URL to PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `**Preview deployment ready**\n\n${{ steps.deploy.outputs.preview_url }}`
            })
```

---

### Production Deployment — `.github/workflows/production.yml`

Runs on every push to `main` (i.e., after a PR is merged).

```yaml
name: Production Deployment

on:
  push:
    branches: [main]

jobs:
  ci:
    name: Build & Validate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npx tsc --noEmit

      - name: Build Docker image
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_APP_URL=${{ vars.NEXT_PUBLIC_APP_URL }} \
            -t expense-tracker:${{ github.sha }} \
            .

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: ci
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Deploy to Production
        run: |
          vercel deploy --prod \
            --token=${{ secrets.VERCEL_TOKEN }} \
            --env MONGODB_URI=${{ secrets.MONGODB_URI }} \
            --env NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }} \
            --env NEXTAUTH_URL=${{ vars.NEXTAUTH_URL }}
```

---

## Required Secrets and Variables

All secrets are stored in GitHub repository settings under **Settings → Secrets and variables → Actions**. They are never committed to source code or `.env` files.

### Secrets (`secrets.*`) — encrypted, never visible in logs

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel personal access token with deploy scope |
| `MONGODB_URI` | MongoDB connection string for the production database |
| `MONGODB_URI_PREVIEW` | MongoDB connection string for the preview/staging database |
| `NEXTAUTH_SECRET` | 32+ random bytes; signs and verifies JWTs |

### Variables (`vars.*`) — non-sensitive configuration

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://expense-tracker.vercel.app`) |
| `NEXTAUTH_URL` | Production canonical URL for NextAuth callbacks |
| `NEXTAUTH_URL_PREVIEW` | Base URL pattern for preview deployments |

### Vercel Project Variables

Vercel environment variables are set separately per environment (Preview / Production) in the Vercel dashboard under **Project → Settings → Environment Variables**. The GitHub Actions pipeline injects the secrets at deploy time via `--env` flags; the Vercel dashboard variables serve as a fallback and for local Vercel CLI development.

---

## Security Rules

These rules apply without exception:

1. **Secrets are never baked into Docker images.** `NEXT_PUBLIC_` build args are the only values injected at image build time. All server-side secrets (`MONGODB_URI`, `NEXTAUTH_SECRET`) are injected at runtime via `--env` flags during `vercel deploy`.
2. **No `.env` files in the image.** The `.dockerignore` excludes all `.env*` files. The `Dockerfile` does not `COPY` any `.env` file.
3. **Preview and production databases are separate.** `MONGODB_URI_PREVIEW` and `MONGODB_URI` must point to different databases. A preview deployment must never read from or write to production data.
4. **`main` is branch-protected.** Direct pushes to `main` are disabled. All changes must go through a pull request. CI must pass before merge is allowed.
5. **Production deployments require environment approval.** The `production` GitHub environment (used in `deploy-production`) should be configured with a required reviewer so production deploys are auditable.
6. **The runner never logs secrets.** Workflow steps must not `echo` or `cat` any secret variable. GitHub Actions masks known secrets automatically, but avoid constructing strings that could leak fragments.

---

## Local Development vs. Production

| Concern | Local | Production |
|---|---|---|
| Environment variables | `.env.local` (gitignored) | GitHub Secrets + Vercel env vars |
| Database | Local MongoDB or MongoDB Atlas dev cluster | MongoDB Atlas production cluster |
| Auth callback URL | `http://localhost:3000` | `https://expense-tracker.vercel.app` |
| Build | `npm run dev` (Turbopack) | `npm run build` → standalone output |
| Docker | Optional — use `docker build` + `docker run` to replicate prod locally | Required in CI to validate build |

To replicate the production build locally with Docker:

```bash
# Build
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -t expense-tracker:local .

# Run (inject secrets at runtime, never at build time)
docker run -p 3000:3000 \
  -e MONGODB_URI="your-local-uri" \
  -e NEXTAUTH_SECRET="your-local-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  expense-tracker:local
```

---

## Deployment Checklist

Before merging a PR that touches deployment configuration:

- [ ] `.dockerignore` excludes all `.env*` files
- [ ] `next.config.ts` has `output: 'standalone'`
- [ ] No secrets are hardcoded in any workflow `.yml` file
- [ ] Preview and production use separate database URIs
- [ ] `main` branch protection rules are enforced in GitHub repository settings
- [ ] All required GitHub secrets are set for both environments
- [ ] Vercel project is linked and `VERCEL_TOKEN` has the correct scope
