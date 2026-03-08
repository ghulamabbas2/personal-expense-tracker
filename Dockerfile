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
# Server-side secrets are NEVER baked in here — only NEXT_PUBLIC_ vars
# (non-sensitive, public config) are set as build args.
ENV DOCKER_BUILD=true

ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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
