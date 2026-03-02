FROM node:22-slim

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Install dependencies first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend with self-hosted flag so Socket.IO uses same-origin
ARG VITE_SELF_HOSTED=true
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
RUN pnpm build

ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV PORT=3021

EXPOSE 3021

CMD ["npx", "ts-node", "-P", "server/tsconfig.json", "server/server.ts"]
