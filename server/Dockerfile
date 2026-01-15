# ============================================================================
# Server Backend Dockerfile - Production-ready multi-stage build
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:24-alpine AS dependencies

# Install security updates and enable yarn
RUN apk update && \
    apk upgrade && \
    corepack enable && \
    corepack prepare yarn@stable --activate && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and yarn config first for better layer caching
# For workspaces, we need to copy all workspace package.json files
COPY package.json yarn.lock .yarnrc.yml ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install only production dependencies
RUN yarn install --immutable && \
    yarn cache clean && \
    rm -rf /tmp/*

# ============================================================================
# Stage 2: Build
# ============================================================================
FROM node:24-alpine AS build

# Enable yarn
RUN corepack enable && \
    corepack prepare yarn@stable --activate

WORKDIR /app

# Copy package files and yarn config
# For workspaces, we need to copy all workspace package.json files
COPY package.json yarn.lock .yarnrc.yml ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install all dependencies (including dev dependencies for TypeScript)
RUN yarn install --immutable && yarn cache clean

# Copy server source code and shared dependencies
COPY server/ ./server/
COPY shared/ ./shared/


COPY tsconfig.base.json tsconfig.json turbo.json ./

# Build the TypeScript code
RUN yarn build:backend && \
    test -f server/dist/server/server.js && echo "Build successful - server.js found" || (echo "Build failed - server.js not found" && exit 1) && \
    ls -la server/dist/server/server.js

# ============================================================================
# Stage 3: Production
# ============================================================================
FROM node:24-alpine AS production

# Install security updates, dumb-init, and wget (for health checks)
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init wget && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Copy package files for proper module resolution
COPY --chown=nodejs:nodejs package.json yarn.lock .yarnrc.yml ./
COPY --chown=nodejs:nodejs server/package.json ./server/
COPY --chown=nodejs:nodejs shared/package.json ./shared/

# Copy production node_modules from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy compiled JavaScript from build stage
COPY --from=build --chown=nodejs:nodejs /app/server/dist ./server/dist
COPY --from=build --chown=nodejs:nodejs /app/shared ./shared

# Set NODE_ENV to production
ENV NODE_ENV=production

# Switch to non-root user
USER nodejs

# Expose port (can be overridden via environment variable)
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --timeout=5 http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly (SIGTERM, SIGINT, etc.)
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server/dist/server/server.js"]
