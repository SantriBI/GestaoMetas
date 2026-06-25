# syntax=docker/dockerfile:1

# Imagem base comum para desenvolvimento e producao.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Instala dependencias em camada separada para aproveitar cache.
FROM base AS deps
COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm ci \
  && npm cache clean --force

# Ambiente de desenvolvimento com reload usando `node --watch`.
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Imagem final de producao, mais simples e previsivel.
FROM base AS prod
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
