# Contexto completo do projeto — SIP / Gestão de Metas

> Documento gerado para dar contexto completo do projeto a outra IA/chat. Cobre o que o sistema faz, como é construído, o que está em andamento agora (mudanças ainda não commitadas) e quais problemas/falhas conhecidos existem.
>
> Data de referência: 2026-07-08. Branch: `main`. Último commit: `53c7bf0 "Ajusta white mode do frontend"`. Há mudanças não commitadas descritas na seção 5.

---

## 1. O que é o sistema

**SIP (Sistema de Inteligência Comercial) / Gestão de Metas** é uma plataforma web B2B para acompanhamento de performance comercial de equipes de vendas. Multi-tenant: atende várias organizações/clientes (empresas) na mesma instalação, cada uma com seu próprio banco Oracle e schema MySQL de autenticação.

Perfis de usuário:
- `SUPERADMIN` — cadastra organizações, credenciais Oracle, tenants MySQL, gerentes e agora também Gerentes de Sistemas. Acesso global.
- `ADMIN` — administra organizações/usuários em escopo administrativo.
- `GERENTE` — acompanha performance da equipe (dashboard, ranking, desafios, feed, usuários).
- `VENDEDOR` — acompanha a própria meta, ranking, carteira de clientes, oportunidades, desafios, meta de vida pessoal.
- `INDUSTRIA` — portal separado para marcas/indústrias acompanharem desempenho de campanha.
- `GERENTE_SISTEMAS` — **role nova** (ver seção 5.1): usuário de suporte/implantação que enxerga múltiplas organizações liberadas pelo SUPERADMIN e consegue abrir a visão de "gerente" ou a visão de um "vendedor" específico dentro de cada uma, sem ser o dono real da conta.

Funcionalidades principais:
- Dashboard gerencial (KPIs, ranking mensal/diário, podium, radar de vendas, alertas).
- Dashboard do vendedor (meta, posição no ranking, oportunidades, vendas do dia).
- Ranking de vendedores (views do Data Warehouse Oracle).
- Área de ataque — priorização de carteira de clientes via análise RFV (Recência, Frequência, Valor).
- Investigação de cliente por nome/CPF/CNPJ.
- Central de ativação de clientes — campanhas com templates, preview, exportação Excel e links de WhatsApp.
- Feed interno (posts, curtidas, comentários, destaque).
- Desafios/campanhas comerciais (bônus, metas específicas por vendedor).
- Meta de vida pessoal do vendedor.
- Assistente comercial (sugestões via regras + OpenAI).
- Login, perfil, troca de senha, upload de avatar.
- Feedback de usuários — hoje gravado no MySQL central (`feedback_usuarios`), com tela de consulta para o SUPERADMIN.
- Painel "Gerente de Sistemas" (`/gerente-sistemas`) — módulo novo, ver seção 5.1.
- Jobs Python/Prefect para diagnóstico periódico das organizações (valida conexão Oracle, views obrigatórias, contagens de dados).

---

## 2. Arquitetura e stack

Monorepo informal com duas pastas principais:

```
GestaoMetas/
├─ Front/     → Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn, Recharts, Sonner
├─ Back/      → Node.js 22, Express 5 (API REST), bcrypt, oracledb, mysql2, ExcelJS
│  ├─ jobs/    → Python 3.12 + Prefect (jobs de diagnóstico)
│  └─ scripts/ → scripts de manutenção one-off (ver seção 5.1)
├─ qa-agent/  → suíte de testes Playwright (separada)
└─ docker-compose.yml → sobe frontend + backend + mysql
```

Fluxo de requisição:
1. Browser acessa o Next.js (`Front/app/*`).
2. Página/hook chama `/api/*`.
3. `next.config.mjs` reescreve para o backend Express (`NEXT_PUBLIC_API_URL` ou `http://localhost:3001`).
4. Express aplica CORS, JSON parser, cookie-parser.
5. Rota decide se exige `requireAuth` (cookie HTTP-only `sip_auth`, token próprio HS256).
6. Controllers/services consultam **Oracle** (dado comercial: ranking, vendas, clientes, RFV) e/ou **MySQL** (autenticação central/tenant, organizações, feedback, vínculos de Gerente de Sistemas).

Bancos de dados:
- **Oracle**: fonte principal de dados comerciais/DW. Existe um Oracle "legado" fixo via `.env` (`DB_USER`/`DB_PASSWORD`/`DB_CONNECT_STRING`) e conexões **por organização/tenant**, cujas credenciais ficam salvas (criptografadas, ver seção 5.1) na tabela MySQL `organizacoes_auth`.
- **MySQL**: autenticação central e por tenant (`usuarios_auth`), organizações (`organizacoes_auth`), diagnósticos de jobs (`organizacoes_diagnosticos`), feedback de usuários (`feedback_usuarios`) e vínculos usuário↔organização do Gerente de Sistemas (`gerente_sistema_organizacoes`).

Deploy: Docker (Dockerfile próprio para `Front/` e `Back/`), `docker-compose.yml` orquestrando `frontend`, `backend`, `mysql`.

---

## 3. Como rodar localmente

Backend:
```bash
cd Back
npm install
copy .env.example .env
npm start          # http://localhost:3001
```

Frontend:
```bash
cd Front
npm install
npm run dev -- -p 3000   # http://localhost:3000
```

Docker Compose:
```bash
copy .env.docker.example .env
docker compose up --build
```

Pré-requisitos: Node 22, acesso a um Oracle (dependência principal), variáveis de ambiente configuradas (incluindo `APP_ENCRYPTION_KEY`, ver seção 5.1). Sem Oracle acessível, a maior parte das telas/APIs não retorna dados reais.

Jobs Prefect (opcional, diagnóstico):
```bash
cd Back
python -m pip install -r requirements-prefect.txt
npm run prefect:validate
```

---

## 4. Autenticação e autorização — estado atual

- Login (`POST /api/login`) busca usuário no MySQL central ou nos tenants, compara senha com `bcrypt`, emite token HS256 próprio (`Back/src/auth/token.js`) e seta cookie HTTP-only `sip_auth`.
- `requireAuth` (`Back/src/middleware/auth.js`) valida o cookie/bearer, **revalida o usuário no banco** (checa `token_version`, permitindo invalidar sessões) e popula `req.auth` com dados atualizados (id, nome, role, empresa_id, sk_vendedor). Para `GERENTE_SISTEMAS`, se a requisição pedir uma `empresa_id` específica (query/body), o middleware valida via `assertSystemManagerOrganizationAccess` se aquele usuário tem acesso liberado àquela organização (tabela `gerente_sistema_organizacoes`) antes de aceitar o escopo pedido.
- Existe também `requireRole(...roles)` para restringir rotas por papel (ex.: `SUPERADMIN`, `GERENTE_SISTEMAS`).
- **Problema estrutural conhecido** (ver relatório de auditoria completo, seção 8): a proteção não é uniforme. Módulos como feed, desafios (parcialmente corrigido, ver 5.4), ativação de clientes, meta de vida do vendedor, investigação de cliente, área de ataque e alertas de ranking ainda podem ter rotas **sem `requireAuth`**, ou aceitar identidade/escopo (`usuario_id`, `empresa_id`, `role`) vindos do **corpo/query da requisição** em vez de derivar do token.
- Dashboard da `INDUSTRIA` passou a validar o fornecedor contra a tabela Oracle `GM_TB_FORNECEDORES_LOGIN` (`ativo = 'S'`) a cada chamada, além de decodificar o token (ver seção 5.5), mas ainda não usa um cookie de sessão dedicado como os outros perfis.

---

## 5. Mudanças em andamento no working tree (NÃO commitadas)

O repositório tem arquivos modificados/novos ainda não commitados, à frente do último commit `53c7bf0`. Resumo por tema:

### 5.1. Novo módulo: "Gerente de Sistemas" (`GERENTE_SISTEMAS`) + correção de uma regressão de segurança

Isto é o núcleo do trabalho em andamento. Dois times de mudança, relacionados:

**a) Nova role/módulo `GERENTE_SISTEMAS`** — um usuário de suporte que pode ser liberado (pelo SUPERADMIN) para acessar múltiplas organizações e, dentro de cada uma, abrir a visão "gerente" ou a visão de um "vendedor" específico (útil para diagnóstico/suporte sem precisar da senha do cliente).
- Backend novo: `Back/src/services/gerenteSistemasService.js` (lista organizações liberadas, lista vendedores da org via tenant MySQL + view Oracle `VW_RANKING_VENDEDORES`, valida acesso, grava vínculos), `Back/src/routes/gerenteSistemas.js` (`GET /api/gerente-sistemas/organizacoes`, `GET /api/gerente-sistemas/organizacoes/:empresaId/vendedores`, ambas atrás de `requireRole("GERENTE_SISTEMAS")`).
- CRUD administrativo em `Back/src/routes/superadmin.js`: `GET/POST/PATCH /api/superadmin/gerentes-sistemas` e `PATCH /api/superadmin/gerentes-sistemas/:id/status` (criar, editar, trocar senha, ativar/desativar, definir a que organizações o usuário tem acesso).
- Nova tabela MySQL `gerente_sistema_organizacoes` (FK para `usuarios_auth` e `organizacoes_auth`, `ON DELETE CASCADE`) e o enum `usuarios_auth.role` ganhou o valor `GERENTE_SISTEMAS` (com migração automática de schema em `ensureCentralUsuarioRoleEnum`, dentro de `Back/src/db/mysql-tenants.js`).
- Frontend novo: `Front/app/gerente-sistemas/page.tsx` — tela onde o usuário escolhe organização + vendedor e "entra" na visão correspondente (grava um usuário sintético no `sessionStorage` via `setStoredUser`, com `gerente_sistemas_view` e `gerente_sistemas_original_role` marcando que é uma sessão "emprestada"). `Front/app/admin/page.tsx` ganhou uma aba inteira de CRUD para Gerentes de Sistemas (maior parte das +481 linhas do diff desse arquivo). `Front/lib/user-session.ts` e `Front/app/login/page.tsx` foram ajustados para reconhecer a nova role e redirecionar para `/gerente-sistemas` no login.

**b) Correção de uma regressão de segurança que existia no código-fonte antes desta sessão de mudanças**: em algum momento a criptografia AES-256-GCM da senha Oracle por organização (`Back/src/security/secrets.js`, `Back/jobs/crypto_utils.py`) havia sido contornada — `oracle-tenants.js`, `jobs/db.py` e `superadmin.js` liam `oracle_password` como texto puro, sem chamar `decryptSecret`. As mudanças atuais **revertem isso e reforçam**:
  - `Back/src/db/oracle-tenants.js`, `Back/jobs/db.py` e `Back/src/routes/superadmin.js` voltaram a chamar `decryptSecret`/`decrypt_secret`, agora com uma regra explícita: se `oracle_password` **não** estiver no formato criptografado esperado (regex `/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i`), a leitura falha com uma mensagem pedindo para rodar o script de migração — em vez de silenciosamente usar a senha como texto puro.
  - Novo script `Back/scripts/migrate-oracle-passwords.js`: idempotente, roda em modo `--dry-run` por padrão (só relatório) e com `--apply` grava. Classifica cada organização em `PLAINTEXT` (precisa criptografar), `ENCRYPTED` (ok), `KEY_MISMATCH` (criptografada mas não decripta com a `APP_ENCRYPTION_KEY` atual — precisa revisão manual) ou `EMPTY`.
  - `Back/jobs/config.py`: `app_encryption_key_hex()` agora **valida** que `APP_ENCRYPTION_KEY` existe, é hex de 64 chars e não é a chave trivial `000...0` — antes tinha fallback silencioso para zeros.
  - **Nota**: qualquer organização com senha ainda em texto puro no banco vai falhar ao conectar (erro pedindo para rodar o script de migração) até que o script seja executado com `--apply`. Isso é o comportamento esperado da correção, não um bug novo.

### 5.2. Feedback de usuários migrado para MySQL central

- `Back/src/controllers/feedbackController.js`, `Back/src/routes/feedback.js`, schema em `Back/sql/mysql_schema_central.sql` e `Back/src/db/mysql-tenants.js`.
- Antes, o feedback era gravado em uma tabela Oracle (`TB_FEEDBACK`), por tenant. Agora vai para uma tabela nova no **MySQL central** (`feedback_usuarios`), compartilhada entre todas as organizações — inclusive usuários sem `empresa_id` conseguem enviar.
- `POST /api/feedback` (autenticado, qualquer usuário logado) grava feedback.
- `GET /api/superadmin/feedbacks` (só `SUPERADMIN`) lista feedbacks com filtro por `empresa_id`/`tipo_usuario` e paginação simples (`limit`, máx. 500).

### 5.3. `requireAuth` passou a preencher `req.auth` com dados mais completos

- Antes: `req.auth = claims` (só o payload assinado do token).
- Agora: `req.auth` é reconstruído combinando o usuário atual do banco com o token, incluindo `id_usuario`, `sub`, `nome`, `nome_completo`, `login`, `role`, `empresa_id` (com `empresa_id_original` preservado à parte quando um `GERENTE_SISTEMAS` está com escopo emprestado), `sk_vendedor`, `token_version` — sempre com o dado mais atual do banco tendo prioridade sobre o token antigo.

### 5.4. Reforço de escopo em desafios (`desafiosController.js`)

- `getSellerFromRequest` agora é assíncrona e, quando recebe `empresaId` de contexto, valida via `findAuthUserBySkVendedor` que o `sk_vendedor` pedido realmente pertence àquela organização antes de prosseguir — corrige um vetor de acesso cruzado entre tenants nas rotas de aceitar/recusar desafio, progresso, listagem e detalhe.
- `superadmin.js`: cadastro de gerente agora bloqueia explicitamente (409) a conversão de um CPF já cadastrado como `VENDEDOR` para `GERENTE` pelo cadastro administrativo, em vez de sobrescrever silenciosamente. `funcionario-lookup` agora exige `empresa_id` (antes aceitava `null`). Busca de cargo/loja no Oracle ganhou mais candidatos de coluna (`DS_CARGO`, `DESC_FUNCAO`, `NOME_PERFIL`, etc.) usando `COALESCE`, mais robusto a schemas diferentes por cliente.
- `usuarios.js`: `PUT /api/usuarios/atualizar-cpf` (que hoje só retorna 403 "não disponível") passou a exigir `requireAuth`.
- `industria.js`: `getIndustryClaims` agora é assíncrona e revalida o fornecedor contra `GM_TB_FORNECEDORES_LOGIN` (`ativo = 'S'`) a cada request, em vez de confiar cegamente no token.

### 5.5. Frontend forçado para modo escuro (dark mode)

Apesar da última mensagem de commit já existente ser "Ajusta white mode do frontend", as mudanças **não commitadas** vão na direção oposta — removem o modo claro por completo:
- `Front/app/layout.tsx`: `<html className="dark">` fixo, `ThemeProvider` com `forcedTheme="dark"` (antes tinha `defaultTheme="light"` e permitia alternar).
- `Front/components/layout/AppShellNav.tsx`: removido o botão de alternância de tema (sol/lua) e toda a paleta "light" — só resta a paleta escura.
- `Front/components/ui/sonner.tsx`: toasts forçados em tema escuro (`theme="dark"` fixo), removendo a leitura de `useTheme()`.
- Outros ajustes visuais menores em `Front/app/dashboard/page.tsx`, `Front/app/vendedor/page.tsx`, `Front/components/dashboard/podium.tsx`, `progress-trail.tsx`, `CardDashboard.tsx`, `MotivationSpotlight.tsx` — em geral trocando classes de cor claras por variantes compatíveis com dark mode.

**Isso ainda é uma inconsistência a resolver**: o commit mais recente diz que ajustou o "white mode", mas o trabalho não commitado remove o modo claro inteiramente. Vale confirmar a intenção real antes de commitar (o sistema deveria ter alternância de tema ou ser dark-only?).

### 5.6. Limpeza de carregamento de variáveis de ambiente

- `Back/index.js`: removido `import dotenv from 'dotenv'` e `dotenv.config()`, consistente com uma correção anterior já documentada (`RELATORIO_ORACLE_THICK_MODE_VALIDACAO.md`) que centralizou o carregamento do `.env` em `Back/src/config/env.js`.
- `Back/index.js` também passou a montar as novas rotas `gerenteSistemasRoutes` em `/api`.

---

## 6. Falhas e riscos conhecidos (independente das mudanças acima)

Baseado em auditoria estática completa do repositório (`RELATORIO_COMPLETO_DO_PROJETO.md`, 2026-07-02) mais o que foi observado agora:

### Segurança — Alto risco
| Risco | Onde | Situação |
|---|---|---|
| Rotas de negócio sem `requireAuth` | feed, ativação de clientes, meta de vida do vendedor, investigar cliente, área de ataque, alertas de ranking | Ainda presente (desafios foi parcialmente reforçado, ver 5.4) |
| Identidade/escopo aceito via body/query em vez do token | vários controllers | Parcialmente corrigido (feedback usa `req.auth`; desafios agora valida `sk_vendedor` x organização), outros módulos ainda aceitam `usuario_id`/`empresa_id` do cliente |
| Dashboard de indústria sem cookie de sessão dedicado | `Back/src/routes/industria.js` | Melhorado (revalida fornecedor a cada request, ver 5.4), mas ainda depende só de token/claims, sem o mesmo mecanismo de `requireAuth` dos demais perfis |
| Senha Oracle por tenant pode estar em texto puro para organizações antigas até a migração ser aplicada | `organizacoes_auth.oracle_password` | Em correção — ver seção 5.1; requer rodar `Back/scripts/migrate-oracle-passwords.js --apply` |
| Sem rate limit no login | `Back/src/routes/auth.js` | Ainda presente |
| Senhas iniciais previsíveis (`sip123`, `admin123`) | `superadmin.js`, `mysql-tenants.js` | Ainda presente |
| `next.config.mjs` com `ignoreBuildErrors: true` | Front | Ainda presente — build pode subir para produção mesmo com erros de TypeScript |

### Qualidade / manutenção
- Sem suíte de testes automatizados no backend (só `Back/test-oracle.js`, smoke test manual). Existe `qa-agent/` com Playwright, mas é separado do CI do produto.
- Arquivos muito grandes: `Front/app/vendedor/page.tsx` (~74 KB), `Front/app/industria/page.tsx` (~54 KB), `Front/app/admin/page.tsx` (cresceu ainda mais com o CRUD de Gerente de Sistemas), `objetivoVendedorService.js`, `desafiosService.js` (~49 KB cada).
- DDL Oracle/MySQL sem migrations versionadas (scripts manuais em `Back/sql`, mais o `ensureCentralSchema`/`ensureCentralUsuarioRoleEnum` que faz `ALTER TABLE` condicional no boot).
- Duas rotas paralelas de organizações (`/superadmin/organizacoes` e `/organizacoes`) com lógica parcialmente duplicada.
- Dois lockfiles no frontend (`Front/package-lock.json` e `Front/pnpm-lock.yaml`) — ambíguo qual gerenciador é o oficial.

### Já resolvido (histórico recente, para contexto)
- **NJS-533 / Oracle Thick Mode** (`RELATORIO_DIAGNOSTICO_NJS-533.md` e `RELATORIO_ORACLE_THICK_MODE_VALIDACAO.md`, ambos de 2026-07-03): dois clientes Oracle dentro da OCI exigiam Native Network Encryption/Data Integrity, que só funciona em modo Thick do `node-oracledb`. Corrigido centralizando o carregamento do `.env` em `Back/src/config/env.js` e tornando `ORACLE_CLIENT_MODE=thick` + `ORACLE_REQUIRE_THICK=true` obrigatórios/explícitos.

---

## 7. Variáveis de ambiente relevantes

Principais (`Back/.env`, ver `Back/.env.example` como modelo):

```
NODE_ENV, PORT, CORS_ORIGINS
AUTH_TOKEN_SECRET, AUTH_TOKEN_TTL_SECONDS, AUTH_COOKIE_NAME, AUTH_COOKIE_SAME_SITE
APP_ENCRYPTION_KEY                                (hex de 64 chars — criptografia da senha Oracle por tenant, ver seção 5.1)
ORACLE_CLIENT_MODE (thick recomendado), ORACLE_REQUIRE_THICK, ORACLE_CLIENT_LIB_DIR
DB_USER, DB_PASSWORD, DB_CONNECT_STRING          (Oracle legado)
MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE  (MySQL central/auth)
MYSQL_ADMIN_HOST/PORT/USER/PASSWORD, MYSQL_GRANT_USER, MYSQL_USER_HOST  (provisionamento de tenants)
SUPERADMIN_INITIAL_LOGIN, SUPERADMIN_INITIAL_PASSWORD
ADMIN_RESET_TOKEN, ALLOW_DESTRUCTIVE_ORG_DELETE
OPENAI_API_KEY, OPENAI_MODEL, N8N_ATIVACAO_WEBHOOK
EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_DELAY_MIN_MS/MAX_MS  (WhatsApp)
```

⚠️ `APP_ENCRYPTION_KEY` é obrigatória e precisa ser a mesma chave usada para criptografar as senhas Oracle já salvas — se for rotacionada sem migrar os dados antigos primeiro, essas organizações passam a falhar com "senha não está criptografada"/"key mismatch" (ver seção 5.1).

---

## 8. Perguntas em aberto / pontos que precisam de decisão humana

1. O script `Back/scripts/migrate-oracle-passwords.js --apply` já foi rodado em produção para as organizações que ficaram com senha em texto puro durante a regressão? Se não, elas vão falhar ao conectar até que alguém rode a migração.
2. O frontend deve voltar a ter alternância claro/escuro, ou a decisão do produto agora é dark-only? A última mensagem de commit e o diff pendente estão contradizendo um ao outro.
3. Rotas ainda sem `requireAuth` ou com escopo aceito por body/query (feed, ativação, meta de vida, investigar cliente, área de ataque, alertas, industria) seguem sem correção — é prioridade resolver isso antes do próximo deploy?
4. Qual gerenciador de pacotes é oficial no `Front/`: npm ou pnpm (hoje há os dois lockfiles)?
5. O módulo `GERENTE_SISTEMAS` dá a um usuário de suporte a capacidade de "entrar" como qualquer vendedor de qualquer organização liberada — vale revisar se deveria haver algum log/auditoria mais visível dessa ação além do `auditAction` já chamado no cadastro/edição do próprio Gerente de Sistemas (não há auditoria explícita registrada no momento em que ele efetivamente abre a visão de um vendedor, já que isso acontece só no frontend via `sessionStorage`).

---

## 9. Arquivos mais importantes para quem for mexer no projeto

```
Back/index.js                          — bootstrap do servidor Express
Back/src/config/env.js                 — carregamento centralizado do .env
Back/src/auth/token.js                 — geração/validação do token de sessão
Back/src/middleware/auth.js            — requireAuth / requireRole, escopo do Gerente de Sistemas
Back/src/routes/superadmin.js          — CRUD de organizações, Oracle, gerentes, Gerentes de Sistemas
Back/src/routes/gerenteSistemas.js     — API consumida pela tela /gerente-sistemas
Back/src/services/gerenteSistemasService.js — regras de acesso multi-organização do Gerente de Sistemas
Back/src/security/secrets.js           — criptografia AES-256-GCM da senha Oracle por tenant
Back/scripts/migrate-oracle-passwords.js — migração one-off para criptografar senhas Oracle legadas em texto puro
Back/src/db/oracle-tenants.js          — conexão Oracle por organização (multi-tenant)
Back/src/db/oracle.js                  — pool Oracle legado
Back/src/db/mysql-tenants.js           — schema central MySQL, criação de tenants
Back/src/controllers/feedbackController.js — módulo de feedback (MySQL central, seção 5.2)
Front/next.config.mjs                  — rewrite /api/*, ignoreBuildErrors: true
Front/lib/user-session.ts              — sessão do usuário no frontend (sessionStorage)
Front/app/layout.tsx                   — tema global (dark forçado nas mudanças pendentes)
Front/app/gerente-sistemas/page.tsx    — tela de troca de organização/vendedor do Gerente de Sistemas
docker-compose.yml, Back/Dockerfile, Front/Dockerfile — deploy local/produção
RELATORIO_COMPLETO_DO_PROJETO.md       — auditoria estática completa (2026-07-02)
RELATORIO_DIAGNOSTICO_NJS-533.md       — diagnóstico do bug de Oracle Thick Mode
RELATORIO_ORACLE_THICK_MODE_VALIDACAO.md — correção aplicada para o bug acima
```
