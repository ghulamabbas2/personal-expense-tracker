# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run ESLint
```

## Architecture

This is a Next.js 16 app using the App Router with React 19, TypeScript, and Tailwind CSS v4.

- `app/layout.tsx` — Root layout with Geist font variables and global metadata
- `app/page.tsx` — Home page (currently the default Next.js scaffold; the expense tracker UI goes here)
- `app/globals.css` — Global styles with Tailwind imports

The project is in its initial scaffold state — no expense tracker functionality has been implemented yet. New pages/routes should be added under `app/` following Next.js App Router conventions (e.g., `app/expenses/page.tsx`). Server Components are the default; add `"use client"` only when needed for interactivity or browser APIs.

## Documentation

Before implementing any feature, always read the relevant files in the `/docs` directory and follow their specifications exactly. The docs are the source of truth for design decisions, component choices, and conventions.

- `docs/ui.md` — UI design spec: HeroUI components, layout, theming, accessibility, and per-page component details
- `docs/auth.md` — Authentication spec: NextAuth config, route protection, session handling, identity enforcement, and security practices
- `docs/ai-workflow.md` — AI development workflow: mandatory plan-before-code process, approval gates, and scope rules. Follow this for every coding task.
- `docs/best-practices.md` — React & Next.js best practices (sourced from Vercel Engineering): performance rules covering waterfalls, bundle size, server rendering, re-renders, and JavaScript optimizations.
- `docs/routing.md` — Routing spec: full App Router route map, middleware protection, route groups, layouts, API handler conventions, dynamic segments, and naming rules.
- `docs/errors-and-validation.md` — Error handling and validation spec: Zod schemas, Server Action and Route Handler error patterns, HeroUI Alert usage, error boundaries, not-found pages, and logging rules.
- `docs/security.md` — Security spec: absolute rules for secrets and credentials, environment variable management, server-only code, logging hygiene, database security, client-side data exposure prevention, and incident response.
- `docs/data-fetching.md` — Data fetching spec: Server Component-only fetching, authorization checks, React.cache() deduplication, parallel fetching patterns, Suspense boundaries, RSC boundary rules, and cache invalidation.
- `docs/charts.md` — Charts & visualizations spec: react-chartjs-2 setup, dynamic imports, theme integration, responsive sizing, dark mode, accessibility, and per-chart configuration details.
