# syntax=docker/dockerfile:1

# Imagem base comum para desenvolvimento e producao.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Instala dependencias em camada separada para aproveitar cache.
FROM base AS deps
COPY package*.json ./
RUN npm ci

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
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
