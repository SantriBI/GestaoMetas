# syntax=docker/dockerfile:1

# Base unica para reduzir divergencia entre dev e producao.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Dependencias completas para permitir build e modo dev.
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Container voltado para desenvolvimento local com hot reload.
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "npm run dev -- --hostname 0.0.0.0 --port ${PORT:-3000}"]

# Build de producao com saida standalone do Next.js.
FROM deps AS builder
ENV NODE_ENV=production
COPY . .
RUN npm run build

# Runtime final enxuto para producao.
FROM node:22-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
