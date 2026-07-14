# Multi-stage Dockerfile for high-performance Node.js LMS API application
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Use the package manager declared by package.json.
RUN corepack enable

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only runtime dependencies from the checked-in lockfile.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --shamefully-hoist

# Rebuild the source code only when needed
FROM base AS builder

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY webpack.config.js ./

# Install the complete build toolchain from the checked-in lockfile.
RUN pnpm install --frozen-lockfile --ignore-scripts --shamefully-hoist

# Copy source code
COPY app/ ./app/
COPY config/ ./config/
COPY helper/ ./helper/
COPY middleware/ ./middleware/
COPY utils/ ./utils/
COPY zod/ ./zod/
COPY prisma/ ./prisma/
COPY docs/ ./docs/
COPY scripts/ ./scripts/
COPY assets/ ./assets/
COPY errors/ ./errors/
COPY cron/ ./cron/
COPY index.ts ./

# Generate Prisma client (schema folder includes all .prisma models)
RUN npx prisma generate --schema prisma/schema
RUN npx prisma generate --schema prisma/pats/schema.prisma
RUN npm run export-docs

# Build TypeScript with webpack
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner

# Install system dependencies for Prisma
RUN apk add --no-cache libc6-compat openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

# Copy built application
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodeuser:nodejs /app/generated ./generated
COPY --from=builder --chown=nodeuser:nodejs /app/assets ./assets
COPY --from=builder --chown=nodeuser:nodejs /app/app ./app
COPY --from=builder --chown=nodeuser:nodejs /app/docs ./docs

# Winston creates its file-log directory during module initialization.
RUN mkdir -p /app/logs && chown nodeuser:nodejs /app/logs

# All runtime artifacts are copied with non-root ownership above.
USER nodeuser

# Expose port
EXPOSE 3000

# Health check (TCP port check)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('net').connect(process.env.PORT||3000,'localhost').once('connect',()=>process.exit(0)).once('error',()=>process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]
