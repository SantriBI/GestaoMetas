# 🚀 SIP - Gestao de Metas

Sistema de inteligencia comercial para acompanhamento de metas, ranking de vendedores, leitura gerencial e ativacao de carteira.

<img width="1342" height="931" alt="image" src="https://github.com/user-attachments/assets/c99beb15-bb7f-43e5-87f1-8403de413baa" />

## ✨ Visao geral

O projeto foi construido para apoiar dois perfis principais:

- `GERENTE`: acompanha a performance consolidada da equipe.
- `VENDEDOR`: acompanha sua meta, ranking, oportunidades e carteira.

Hoje o sistema entrega:

- 📊 Dashboard gerencial com leitura mensal e diaria
- 🧑‍💼 Dashboard do vendedor com meta, posicao e oportunidades
- 🏆 Ranking de vendedores alimentado por views do DW
- 🎯 Area de ataque com priorizacao de carteira via RFV
- 🔎 Investigacao de cliente por nome, CPF ou CNPJ
- 💬 Central de ativacao com templates e links de WhatsApp
- 📰 Feed interno com posts, curtidas, comentarios e destaque
- 🚨 Alertas de ranking e leitura de tendencia comercial
- 🤖 Assistente comercial para sugerir proximas acoes
- 🔐 Login, perfil e alteracao de senha

## 🧱 Arquitetura

O projeto esta dividido em dois blocos:

- `Front/`: aplicacao web em `Next.js 16`, `React 19`, `TypeScript` e `Tailwind CSS v4`
- `Back/`: API REST em `Node.js` + `Express`

Fluxo resumido:

1. O usuario acessa o frontend em `Next.js`
2. O frontend chama `/api/*`
3. O `next.config.mjs` reescreve essas chamadas para o backend
4. O backend consulta principalmente o `Oracle`
5. Parte da infraestrutura local tambem possui `MySQL` via Docker Compose

## 🗂️ Estrutura do projeto

```text
Projeto/
├─ Front/
│  ├─ app/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  └─ styles/
├─ Back/
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ db/
│  │  ├─ routes/
│  │  └─ services/
│  └─ sql/
├─ docker-compose.yml
└─ .env.docker.example
```

## 🖥️ Frontend

O frontend usa `App Router` e esta organizado por dominios de negocio.

### Rotas principais

- `/`: landing page do sistema
- `/login`: autenticacao
- `/dashboard`: visao do gerente
- `/vendedor`: visao individual do vendedor
- `/area-ataque`: carteira priorizada
- `/investigar-cliente`: leitura detalhada de cliente
- `/ativacao-clientes`: fluxo de campanha e reativacao
- `/feed`: mural interno da equipe
- `/perfil`: dados do usuario
- `/alterar-senha`: atualizacao de senha

### Pastas mais importantes

- `Front/app/`: paginas da aplicacao
- `Front/components/`: componentes visuais e modulos por area
- `Front/hooks/`: hooks de estado e consumo
- `Front/lib/`: tipos, sessao, helpers e clientes da API
- `Front/styles/`: tema e estilos auxiliares

## ⚙️ Backend

O backend concentra as regras de negocio e a integracao com os bancos.

### Rotas principais da API

- `/api/login` e `/api/alterar-senha`: autenticacao
- `/api/ranking-vendedores`: ranking mensal e diario
- `/api/vendedor/:sk_vendedor`: resumo do vendedor
- `/api/vendedor/:sk_vendedor/oportunidades`: oportunidades comerciais
- `/api/vendedor-panorama/:sk_vendedor`: panorama detalhado do vendedor
- `/api/area-ataque/:vendedor_id`: carteira priorizada por RFV
- `/api/investigar-cliente`: consulta detalhada de cliente
- `/api/alertas-ranking`: alertas para gerente e vendedor
- `/api/radar-vendas`: sinais e tendencias comerciais
- `/api/assistente-vendas/*`: apoio comercial e proximas acoes
- `/api/usuarios/*`: perfil, senha e foto do usuario
- `/api/ativacao-clientes/*`: segmentos, resumo, preview e campanhas
- `/api/templates-mensagens/*`: templates da ativacao
- `/api/feed/*`: posts, comentarios, curtidas, destaque e atividade
- `/api/health`: health-check basico

### Pastas mais importantes

- `Back/src/routes/`: definicao dos endpoints
- `Back/src/controllers/`: camada HTTP
- `Back/src/services/`: regra de negocio e consultas
- `Back/src/db/`: conexoes com Oracle e MySQL
- `Back/sql/`: scripts auxiliares de banco

## 🧩 Modulos do sistema

### 📊 Dashboard do gerente

Centraliza KPIs, ranking, podio, alertas, radar e leitura da equipe em modo diario e mensal.

### 🧑‍💼 Dashboard do vendedor

Mostra posicao, percentual de atingimento, meta do dia, vendas do dia e oportunidades abertas.

### 🎯 Area de ataque

Ajuda o vendedor a focar em clientes campeoes, fieis e em risco com base em RFV.

### 🔎 Investigacao de cliente

Permite buscar cliente por nome, CPF ou CNPJ e devolve perfil, RFV, historico financeiro e itens mais relevantes.

### 💬 Central de ativacao

Organiza campanhas com segmentacao, templates, preview de clientes e links prontos de WhatsApp.

### 📰 Feed

Espaco interno para compartilhar vitorias, movimentar a cultura do time e destacar posts importantes.

### 🚨 Alertas, radar e assistente

Camada complementar que aponta mudancas no ranking, tendencias comerciais e sugestoes de acao.

## 🗄️ Fontes de dados e persistencia

Pelo codigo atual, as fontes mais importantes sao:

- `Oracle`: principal base de leitura e persistencia observada no sistema
- `MySQL`: conexao configurada para a infraestrutura local e evolucao do projeto

### Objetos Oracle mais relevantes

- `DM_VENDAS.GM_VW_RANKING_VENDEDORES`: ranking mensal
- `DM_VENDAS.GM_VW_RANKING_VENDEDORES_DIA`: ranking diario
- `DM_VENDAS.FATO_RFV_VENDEDOR`: RFV por vendedor
- `DM_VENDAS.FATO_RFV_CLIENTE`: RFV por cliente
- `DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE`: historico de vendas e analises
- `DM_VENDAS.DIM_CLIENTE`: dados de clientes
- `DM_VENDAS.DIM_VENDEDOR`: dados de vendedores
- `DM_VENDAS.DIM_PRODUTOS`: produtos e categorias
- `VW_ORCAMENTOS_GESTAO_METAS`: oportunidades e orcamentos
- `USUARIOS_APP`: autenticacao de usuarios
- `FEED_POSTS`, `FEED_CURTIDAS`, `FEED_COMENTARIOS`: feed interno

## 🛠️ Stack

### Frontend

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Radix UI`
- `Recharts`
- `Sonner`
- `lucide-react`

### Backend

- `Node.js`
- `Express`
- `bcrypt`
- `oracledb`
- `mysql2`
- `dotenv`
- `cors`

## 🔤 Fontes usadas na interface

As fontes tipograficas usadas hoje sao estas:

- `Space Grotesk`: fonte principal da interface. Passa uma sensacao mais moderna, tecnologica e forte para o produto.
- `Geist Mono`: fonte mono usada em contextos tecnicos, numericos ou utilitarios, onde alinhamento e legibilidade ajudam.
- `Geist`: aparece como fallback sans no tema. Serve como reserva quando a principal nao estiver aplicada.

### Resumo do papel de cada uma

- 🟢 `Space Grotesk`: identidade visual principal
- 🔵 `Geist Mono`: numeros, leitura tecnica e apoio visual
- ⚪ `Geist`: fallback tipografico do sistema

### Observacao importante

Existe uma configuracao antiga em `Front/styles/globals.css` priorizando `Geist`, mas o layout principal ativo usa `Front/app/globals.css` com `Space Grotesk` como fonte sans padrao.

## ▶️ Como rodar localmente

## Pre-requisitos

Antes de subir o projeto, garanta estes itens:

- `Node.js 22` e `npm`
- Acesso a uma base `Oracle`, que hoje e a dependencia principal do sistema
- Variaveis de ambiente configuradas para backend e frontend
- Portas `3000` e `3001` livres para o modo padrao

### Pre-requisitos principais

- `Node.js 22`: referencia mais segura para desenvolvimento local
- `npm`: usado para instalar dependencias e rodar frontend e backend
- `Oracle` acessivel: o backend depende dele para autenticacao, ranking, vendedor, carteira e outras leituras de negocio

### Variaveis de ambiente mais importantes

As variaveis abaixo sao as principais para o ambiente funcionar sem surpresas:

- `DB_USER`
- `DB_PASSWORD`
- `DB_CONNECT_STRING`
- `ADMIN_RESET_TOKEN`
- `NEXT_PUBLIC_API_URL`

### Variaveis adicionais por funcionalidade

Dependendo dos modulos usados, estas tambem podem ser necessarias:

- `DB_NAME`
- `DB_HOST`
- `DB_PORT`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

### Observacoes praticas

- Sem acesso ao `Oracle`, boa parte das telas e APIs nao vai responder com os dados esperados
- O `MySQL` aparece como apoio de infraestrutura local, mas o `Oracle` segue como a dependencia mais critica
- No modo padrao, o frontend roda em `http://localhost:3000` e o backend em `http://localhost:3001`

### Opcao 1: manual

#### Backend

```bash
cd Back
npm install
npm start
```

Backend padrao em:

```bash
http://localhost:3001
```

#### Jobs Prefect

O projeto tambem possui uma camada opcional de jobs em `Back/jobs/` para diagnostico operacional das organizacoes. Ela valida conexao Oracle, views obrigatorias e contagens basicas de dados por cliente, gravando o resultado em `organizacoes_diagnosticos` no MySQL central.

Instale as dependencias Python:

```bash
cd Back
python -m pip install -r requirements-prefect.txt
```

Rodar uma validacao pontual:

```bash
npm run prefect:validate
```

Validar uma organizacao especifica:

```bash
python -m jobs.run_prefect validate --empresa-id 6
```

Servir o flow agendado localmente:

```bash
npm run prefect:serve
```

#### Frontend

```bash
cd Front
npm install
npm run dev
```

Frontend padrao em:

```bash
http://localhost:3000
```

Por padrao, o frontend reescreve `/api/*` para:

```bash
http://localhost:3001/api/*
```

### Opcao 2: Docker Compose

Existe suporte local com:

- `frontend`
- `backend`
- `mysql`

Arquivos de apoio:

- `docker-compose.yml`
- `.env.docker.example`

Fluxo sugerido:

```bash
copy .env.docker.example .env
docker compose up --build
```

#### Como trocar as portas

Se quiser mudar as portas do ambiente Docker no futuro, ajuste o arquivo `.env` na raiz usando estas variaveis:

```bash
FRONTEND_PORT=3000
FRONTEND_HOST_PORT=3000
BACKEND_PORT=3001
BACKEND_HOST_PORT=3001
MYSQL_HOST_PORT=3306
```

Exemplo:

```bash
FRONTEND_PORT=4000
FRONTEND_HOST_PORT=4000
BACKEND_PORT=4001
BACKEND_HOST_PORT=4001
MYSQL_HOST_PORT=3307
```

Depois disso, suba novamente:

```bash
docker compose up --build
```

## 🔐 Variaveis esperadas

Pelo codigo atual e pelos arquivos de infraestrutura, o projeto espera ao menos:

- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_CONNECT_STRING`
- `DB_HOST`
- `DB_PORT`
- `ADMIN_RESET_TOKEN`
- `NEXT_PUBLIC_API_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `N8N_ATIVACAO_WEBHOOK`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

## 📝 Observacoes tecnicas

- O backend usa pool de conexoes Oracle
- Leituras Oracle possuem tentativa de retry para alguns erros transitorios
- O frontend armazena a sessao do usuario em `sessionStorage`
- O `next.config.mjs` esta com `ignoreBuildErrors: true`, o que acelera iteracao, mas pede revisao antes de endurecer deploy

## 🚀 Resumo final

O SIP e uma plataforma para acompanhar performance comercial com foco em meta, ranking, carteira, ativacao e cultura do time. A base tecnica combina `Next.js` no frontend com `Express` no backend e forte dependencia de dados vindos do `Oracle`.

