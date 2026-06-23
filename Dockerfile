# =============================================================================
# ReviewPulse — Multi-stage Dockerfile for Next.js standalone
# =============================================================================
# Produces a minimal ~150 MB image running the Next.js standalone server.
#
# Stages:
#   1. deps    — install node_modules (cached layer)
#   2. builder — prisma generate + next build → .next/standalone
#   3. runner  — copy standalone output only, run `node server.js`
#
# Build:
#   docker build -t reviewpulse .
#
# Run:
#   docker run -p 3000:3000 \
#     -e DATABASE_URL='postgresql://...' \
#     -e JWT_SECRET="$(openssl rand -hex 32)" \
#     reviewpulse
#
# Notes:
#   - Uses Bun for install (faster, smaller node_modules) and Node 20 to
#     run the standalone server (matches `node server.js` in package.json
#     start script when Bun is unavailable).
#   - The build script in package.json already copies .next/static and
#     public/ into .next/standalone/ after `next build`, so the runner
#     stage only needs to copy the standalone directory.
#   - Prisma client is generated at build time. The standalone trace
#     bundles @prisma/client and its engine binary into .next/standalone.
#   - @xenova/transformers downloads model weights on first call to
#     `pipeline()`. In a containerized deploy this means the first
#     /api/embed or /api/chat call after cold start will download ~25 MB
#     to /tmp. For production, pre-bake the model into the image (see
#     the optional step below) or mount a persistent volume.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — deps
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Bun is used for installs (faster than npm/yarn). Alpine needs musl-compatible bun.
RUN apk add --no-cache libc6-compat \
  && npm install -g bun

WORKDIR /app

# Copy only manifests so this layer is cached when source changes.
COPY package.json bun.lock* ./

# Install with frozen lockfile (reproducible). --ignore-scripts avoids
# running package postinstall scripts that might fail in this stage.
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2 — builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat \
  && npm install -g bun

WORKDIR /app

# Bring over the installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source.
COPY . .

# Environment during build. Next.js reads NODE_ENV=production to enable
# production optimizations, but we set it explicitly so the standalone
# output is correctly traced.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate the Prisma client so the build can type-check imports from
# @prisma/client (next.config.ts has ignoreBuildErrors:true, but the
# standalone tracer still needs the generated client present).
RUN bunx prisma generate

# Build. The package.json `build` script runs:
#   next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
# so .next/standalone/ ends up fully self-contained.
RUN bun run build

# OPTIONAL: pre-download the @xenova/transformers model so the first
# /api/embed or /api/chat call doesn't pay the ~25 MB download cost.
# Uncomment to bake the model into the image (adds ~25 MB).
# RUN bun -e "const {pipeline} = require('@xenova/transformers'); pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2').then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })"

# -----------------------------------------------------------------------------
# Stage 3 — runner (minimal runtime image)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Run as a non-root user for defense-in-depth.
RUN addgroup --system --gid 1001 nodejs \
  && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone server output. Next.js traces all required deps
# into .next/standalone/node_modules so we don't need a separate
# node_modules install in the runner.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy the static assets and public folder (the build script already
# copies these into .next/standalone, but we copy again to be explicit
# and resilient to changes in the build script).
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to the non-root user.
USER nextjs

# Expose the port the standalone server listens on.
EXPOSE 3000

# Healthcheck — poll /api/health every 30s after a 10s grace period.
# Marks the container unhealthy after 3 consecutive failures.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run the standalone Next.js server. Equivalent to `node server.js` in
# the .next/standalone directory.
CMD ["node", "server.js"]
