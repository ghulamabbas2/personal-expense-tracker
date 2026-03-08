# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc compatibility for native addons (sharp, bcrypt, etc.)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./

# Install all deps (devDependencies needed for the build step)
RUN npm ci

# ─── Stage 2: Build the application ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Tell next.config.ts to emit standalone output for this Docker build.
ENV DOCKER_BUILD=true

# Public config — safe to bake into the bundle.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Next.js executes server modules during page-data collection at build time.
# These placeholder values satisfy env-var guards AND pass Mongoose/NextAuth
# URI validation so the build succeeds without real secrets.
# They exist ONLY in this builder stage — they are NOT copied to the runner
# image (only the standalone output files are copied across).
ENV MONGODB_URI=mongodb://build:placeholder@localhost:27017/build
# hadolint ignore=DL3025
ENV NEXTAUTH_SECRET=build-placeholder-secret-at-least-32-chars-long
ENV NEXTAUTH_URL=http://localhost:3000

RUN npm run build

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what Next.js needs at runtime from the standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is emitted by Next.js standalone output
CMD ["node", "server.js"]
