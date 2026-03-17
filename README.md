# 🚀 SIP — Gestão de Metas

Sistema inteligente de acompanhamento de performance comercial, focado em execução de metas, ranking de vendedores, leitura estratégica e acionamento inteligente da carteira de clientes para transformar dados em ações práticas para vendedores e gestores.

## Visao geral

O projeto e dividido em dois blocos principais:

- `Front/`: aplicacao web em Next.js 16 + React 19.
- `Back/`: API em Node.js + Express.

O sistema atende dois perfis principais:

- `GERENTE`: acompanha o desempenho consolidado da equipe.
- `VENDEDOR`: acompanha sua propria meta, oportunidades e carteira.

## O que o sistema entrega

- Dashboard gerencial com leitura mensal e diaria.
- Dashboard do vendedor com meta, posicao no ranking e oportunidades.
- Ranking de vendedores baseado em views do DW.
- Area de ataque com priorizacao de carteira por RFV.
- Investigacao de cliente com historico, RFV e top produtos/categorias.
- Central de ativacao de clientes com segmentacao, templates e links de WhatsApp.
- Feed interno para compartilhamento de resultados e engajamento da equipe.
- Alertas de ranking com leitura comparativa entre referencias.
- Radar de vendas com sinais de risco, destaque e tendencia comercial.
- Gestao basica de usuarios, perfil e alteracao de senha.
- Assistente comercial para sugerir proximas acoes.
- Fluxo de login e alteracao de senha.

## Arquitetura resumida

### Frontend

O frontend usa `Next.js` com `App Router`, `TypeScript`, `Tailwind CSS v4`, componentes `Radix UI` e icones `lucide-react`.

Principais rotas da interface:

- `/`: landing page institucional do sistema.
- `/login`: autenticacao.
- `/dashboard`: visao do gerente.
- `/vendedor`: visao individual do vendedor.
- `/area-ataque`: priorizacao de clientes da carteira.
- `/investigar-cliente`: consulta detalhada de cliente.
- `/ativacao-clientes`: fluxo de campanha/reativacao.
- `/feed`: mural interno de posts, curtidas e comentarios.
- `/perfil` e `/alterar-senha`: dados e manutencao da conta.

O frontend consome a API usando rewrite de `/api/*` para o backend configurado em `NEXT_PUBLIC_API_URL`.

### Backend

O backend expõe uma API REST em `Express` centralizada em `Back/index.js`.

Principais grupos de rota:

- `/api/login` e `/api/alterar-senha`: autenticacao e senha.
- `/api/ranking-vendedores`: ranking mensal e diario.
- `/api/vendedor/:sk_vendedor`: resumo do vendedor.
- `/api/vendedor/:sk_vendedor/oportunidades`: oportunidades e orcamentos.
- `/api/vendedor-panorama/:sk_vendedor`: panorama detalhado do vendedor.
- `/api/area-ataque/:vendedor_id`: carteira priorizada por RFV.
- `/api/investigar-cliente`: consulta detalhada de cliente.
- `/api/alertas-ranking`: alertas para gerente e vendedor.
- `/api/radar-vendas`: leitura resumida de tendencia comercial.
- `/api/assistente-vendas/*`: recomendacoes e apoio comercial.
- `/api/usuarios/*`: perfil, senha e foto do usuario.
- `/api/ativacao-clientes/*`: segmentos, resumo, preview e campanhas.
- `/api/templates-mensagens/*`: templates da central de ativacao.
- `/api/feed/*`: posts, comentarios, curtidas, destaque e atividade.
- `/api/health`: health-check basico.

## Fontes de dados e persistencia

O projeto trabalha com duas fontes principais de dados:

- `Oracle`: base principal de leitura analitica e operacional. Alimenta ranking, vendedor, area de ataque, investigacao de cliente, ativacao e tambem o feed.
- `MySQL`: existe conexao configurada no backend, mas o uso principal observado no codigo atual esta concentrado no Oracle.

Objetos Oracle importantes no projeto:

- `DM_VENDAS.VW_RANKING_VENDEDORES`: ranking mensal.
- `DM_VENDAS.VW_RANKING_VENDEDORES_DIA`: ranking diario.
- `DM_VENDAS.FATO_RFV_VENDEDOR` e `DM_VENDAS.FATO_RFV_CLIENTE`: classificacao RFV.
- `DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE`: historico de vendas, ticket e analises.
- `DM_VENDAS.DIM_CLIENTE`, `DIM_VENDEDOR`, `DIM_PRODUTOS`: dimensoes de apoio.
- `VW_ORCAMENTOS_GESTAO_METAS`: orcamentos e oportunidades comerciais.
- `USUARIOS_APP`: autenticacao de usuarios.
- `FEED_POSTS`, `FEED_CURTIDAS`, `FEED_COMENTARIOS`: feed interno.

## Estrutura resumida

### `Front/`

- `app/`: paginas principais da aplicacao.
- `components/`: componentes de interface e modulos por dominio.
- `hooks/`: hooks de consumo e estado.
- `lib/`: tipos, servicos de cliente, sessao e utilitarios.
- `styles/`: tema visual e estilos globais auxiliares.

### `Back/`

- `src/routes/`: definicao das rotas da API.
- `src/controllers/`: camada HTTP.
- `src/services/`: regras de negocio e consultas.
- `src/db/`: conexoes com Oracle e MySQL.
- `sql/`: scripts de criacao/alteracao de estruturas.

## Modulos principais

### Dashboard do gerente

Consolida a performance da equipe, mostra KPIs, ranking, alertas, radar de vendas e leitura diaria/mensal.

### Dashboard do vendedor

Mostra posicao do vendedor, percentual de atingimento, meta diaria, vendas do dia, oportunidades em aberto e sinais visuais de destaque no ranking.

### Area de ataque

Prioriza clientes campeoes, fieis e em risco com base em RFV, ajudando o vendedor a agir na carteira com mais foco.

### Investigacao de cliente

Permite buscar um cliente por nome, CPF ou CNPJ e retorna perfil, classificacao RFV, historico financeiro e itens mais relevantes.

### Central de ativacao

Organiza campanhas de contato com segmentacao, templates de mensagem, preview de clientes e abertura de links de WhatsApp.

### Feed

Funciona como um espaco interno de comunicacao comercial, com posts, comentarios, curtidas e destaque gerencial.

### Alertas, radar e assistente

Complementam a leitura principal com avisos de mudanca no ranking, sinais de tendencia comercial e sugestoes de acao para acelerar resultado.

## Fontes tipograficas usadas

O frontend hoje trabalha principalmente com estas fontes:

- `Space Grotesk`: fonte principal da aplicacao. E a base visual do produto e reforca a proposta mais moderna/tecnologica da interface.
- `Geist Mono`: fonte mono usada para contextos tecnicos, numericos ou utilitarios onde alinhamento e legibilidade importam mais.
- `Geist`: aparece como fallback configurado no tema global. Serve como reserva para o sans-serif principal caso `Space Grotesk` nao seja aplicada em algum contexto.

Observacao:

- Existe uma configuracao antiga em `Front/styles/globals.css` priorizando `Geist`, mas o layout principal ativo usa `Front/app/globals.css` com `Space Grotesk` como fonte sans padrao.

## Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, Recharts, Sonner.
- Backend: Node.js, Express, bcrypt, oracledb, mysql2, dotenv, cors.

## Execucao local

### Backend

```bash
cd Back
npm install
npm start
```

A API sobe em `http://localhost:3001`.

### Frontend

```bash
cd Front
npm install
npm run dev
```

Por padrao, o frontend reescreve chamadas `/api/*` para `http://localhost:3001/api/*`.

## Variaveis esperadas

Pelo codigo atual, o projeto espera ao menos estas variaveis:

- Backend Oracle: `DB_USER`, `DB_PASSWORD`, `DB_CONNECT_STRING`
- Backend MySQL: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Frontend/API: `NEXT_PUBLIC_API_URL`
- Admin: `ADMIN_RESET_TOKEN`

## Observacoes tecnicas

- O backend usa pool de conexoes Oracle e faz retry em alguns erros transitorios de leitura.
- O frontend guarda sessao do usuario no `sessionStorage`.
- O `next.config.mjs` esta com `ignoreBuildErrors: true`, o que acelera iteracao, mas merece revisao antes de endurecer o fluxo de deploy.
