# syntax=docker/dockerfile:1

# Imagem base comum para desenvolvimento e producao.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Oracle Instant Client: habilita o modo thick do node-oracledb, necessario
# para bancos que exigem Native Network Encryption/Data Integrity no
# sqlnet.ora (erro NJS-533 no modo thin padrao).
FROM base AS oracle-client
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget unzip \
  && rm -rf /var/lib/apt/lists/* \
  && wget -q https://download.oracle.com/otn_software/linux/instantclient/2113000/instantclient-basiclite-linux.x64-21.13.0.0.0dbru.zip -O /tmp/instantclient.zip \
  && unzip -q /tmp/instantclient.zip -d /opt/oracle \
  && rm /tmp/instantclient.zip \
  && mv /opt/oracle/instantclient_* /opt/oracle/instantclient \
  && rm -f /opt/oracle/instantclient/*jdbc* /opt/oracle/instantclient/*occi* /opt/oracle/instantclient/*mysql* /opt/oracle/instantclient/*README /opt/oracle/instantclient/*.jar

# Instala dependencias em camada separada para aproveitar cache.
FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci \
    --fetch-retries=5 \
    --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=600000 \
    --prefer-offline \
    --no-audit \
    --fund=false

# Ambiente de desenvolvimento com reload usando `node --watch`.
FROM deps AS dev
ENV NODE_ENV=development
RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=oracle-client /opt/oracle/instantclient /opt/oracle/instantclient
ENV ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Imagem final de producao, mais simples e previsivel.
FROM base AS prod
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=oracle-client /opt/oracle/instantclient /opt/oracle/instantclient
ENV ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
