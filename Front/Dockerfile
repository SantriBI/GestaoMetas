# syntax=docker/dockerfile:1

# Base unica para reduzir divergencia entre dev e producao.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Dependencias completas para permitir build e modo dev.
FROM base AS deps
COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm ci \
  && npm cache clean --force

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
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_PORT
ARG BACKEND_PORT
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BACKEND_PORT=${NEXT_PUBLIC_BACKEND_PORT}
ENV BACKEND_PORT=${BACKEND_PORT}
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
