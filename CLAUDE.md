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
