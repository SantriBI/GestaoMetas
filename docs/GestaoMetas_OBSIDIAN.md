---
título: "SIP - Gestão de Metas"
tags:
  - santri
  - sip
  - gestao-metas
  - nextjs
  - express
  - oracle
  - multi-tenant
  - crm-comercial
stack:
  frontend: [Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, Recharts, Sonner, lucide-react]
  backend: [Node.js 22, Express 5, oracledb, mysql2, bcrypt, ExcelJS, dotenv, cors]
  jobs: [Python 3.12, Prefect]
  infra: [Docker, Docker Compose]
  bancos: [Oracle (DW comercial, multi-tenant), MySQL (auth central + tenants)]
status: "em desenvolvimento ativo"
---

# SIP — Gestão de Metas

## Propósito

Plataforma web B2B (**SIP — Sistema de Inteligência Comercial**) para acompanhamento de performance comercial de equipes de vendas. É **multi-tenant**: uma mesma instalação atende várias organizações/clientes, cada uma com seu próprio banco Oracle (DW comercial) e schema/tenant MySQL de autenticação.

Perfis de usuário:
- `SUPERADMIN` — cadastra organizações, credenciais Oracle, tenants MySQL, gerentes e Gerentes de Sistemas.
- `ADMIN` — administração em escopo mais restrito.
- `GERENTE` — visão consolidada da equipe (dashboard, ranking, desafios, feed).
- `VENDEDOR` — meta própria, ranking, carteira de clientes, oportunidades, desafios.
- `INDUSTRIA` — portal separado para marcas/indústrias acompanharem campanhas.
- `GERENTE_SISTEMAS` — usuário de suporte/implantação que acessa múltiplas organizações liberadas pelo SUPERADMIN e pode "entrar" na visão de gerente ou de um vendedor específico, sem precisar da senha do cliente.

Funcionalidades principais: dashboard gerencial e do vendedor, ranking de vendedores (mensal/diário), área de ataque (priorização de carteira via RFV), investigação de cliente (nome/CPF/CNPJ), central de ativação de clientes (campanhas WhatsApp), feed interno, desafios/campanhas comerciais, meta de vida pessoal, assistente comercial (regras + OpenAI), premiação de vendedores (comissão ERP + acelerador), e módulo de suporte "Gerente de Sistemas".

## Arquitetura principal

Monorepo informal com duas aplicações principais:

```
GestaoMetas/
├─ Front/     → Next.js 16 (App Router), React 19, TS, Tailwind 4
├─ Back/      → Node.js 22 + Express 5 (API REST)
│  ├─ jobs/    → Python + Prefect (diagnóstico periódico das organizações)
│  └─ scripts/ → scripts de manutenção one-off (ex.: migração de senhas Oracle)
├─ qa-agent/  → suíte de testes Playwright (separada do produto)
└─ docker-compose.yml → frontend + backend + mysql
```

Fluxo de requisição:
1. Browser acessa o Next.js (`Front/app/*`).
2. Página/hook chama `/api/*`.
3. `next.config.mjs` reescreve para o backend Express (`NEXT_PUBLIC_API_URL`).
4. Express aplica CORS, JSON parser, cookie-parser.
5. Rota decide se exige `requireAuth` (cookie HTTP-only `sip_auth`, token HS256 próprio).
6. Controllers/services consultam **Oracle** (dado comercial: ranking, vendas, clientes, RFV, premiação) e/ou **MySQL** (auth central/tenant, organizações, feedback, vínculos de Gerente de Sistemas).

### Bancos de dados

- **Oracle** — fonte principal de dados comerciais/DW, por organização. Views/objetos chave: `DM_VENDAS.GM_VW_RANKING_VENDEDORES(_DIA)`, `FATO_RFV_VENDEDOR/CLIENTE`, `FATO_VENDAS_LUCRATIVIDADE`, `VW_APURACAO_PREMIACAO_VENDEDOR`, `DIM_CLIENTE/VENDEDOR/PRODUTOS`, `VW_ORCAMENTOS_GESTAO_METAS`, `USUARIOS_APP`, `FEED_POSTS/CURTIDAS/COMENTARIOS`. Credenciais de tenant ficam criptografadas (AES-256-GCM) na tabela MySQL `organizacoes_auth`.
- **MySQL** — autenticação central e por tenant (`usuarios_auth`), organizações (`organizacoes_auth`), diagnósticos de jobs (`organizacoes_diagnosticos`), feedback de usuários (`feedback_usuarios`), vínculos Gerente de Sistemas ↔ organização (`gerente_sistema_organizacoes`).

Deploy via Docker (Dockerfile próprio para `Front/` e `Back/`), orquestrado por `docker-compose.yml`.

## Decisões técnicas relevantes

- **Multi-tenant com Oracle por organização**: cada cliente tem seu próprio Oracle; conexões e credenciais são resolvidas dinamicamente por `empresa_id`, com senha Oracle criptografada (AES-256-GCM) — houve uma regressão histórica em que a senha passou a ser lida como texto puro em alguns pontos, corrigida reforçando `decryptSecret`/`decrypt_secret` e adicionando o script idempotente `Back/scripts/migrate-oracle-passwords.js` (`--dry-run`/`--apply`) para migrar organizações antigas.
- **Oracle Thick Mode obrigatório para alguns tenants** (NJS-533): clientes Oracle hospedados na OCI exigem Native Network Encryption/Data Integrity, suportado só no modo Thick do `node-oracledb`. Resolvido centralizando o carregamento de `.env` em `Back/src/config/env.js` e tornando `ORACLE_CLIENT_MODE=thick` + `ORACLE_REQUIRE_THICK=true` explícitos.
- **Dia útil não vem de flag em `DIM_DATA`**: é derivado de `FATO_META_DIA.DIAS_PASSADOS/DIAS_UTEIS/DIAS_RESTANTES`.
- **Mapeamento de `id_organizacao` é específico de cada ambiente**: nunca reutilizar um id "de memória" sem confirmar ao vivo no Oracle daquele ambiente.
- **Premiação do vendedor (Fase 3)** usa `VALOR_COMISSAO_A_PAGAR × acelerador` vindo do ERP, aplicado via view (`VW_APURACAO_PREMIACAO_VENDEDOR`) por `SK_EMPRESAS`; a "margem+frete" da apuração evoluiu para somar `VALOR_OUTRAS_DESPESAS_ITEM` e depois foi simplificada para usar `VALOR_LUCRO_PRESENTE_ITEM` diretamente como margem de contribuição.
- **Premiação restrita por feature flag de organização**: nem toda organização tem a premiação do vendedor habilitada.
- **PWA**: service worker registrado para permitir instalação do app.
- **`next.config.mjs` com `ignoreBuildErrors: true`**: acelera iteração no frontend, mas é um risco assumido — build pode ir a produção com erros de TypeScript não resolvidos.
- **Autenticação própria (não usa provedor externo)**: token HS256 assinado internamente (`Back/src/auth/token.js`), cookie HTTP-only `sip_auth`, `requireAuth` revalida o usuário no banco a cada request (incluindo `token_version`, para permitir invalidar sessões). Escopo (`role`, `empresa_id`, `sk_vendedor`) é resolvido no servidor, nunca aceito do cliente — mas essa regra **não é uniforme** em todos os módulos ainda (ver riscos conhecidos abaixo).
- **Ativação de clientes via WhatsApp** com dois canais opcionais e não bloqueantes: webhook n8n (`N8N_ATIVACAO_WEBHOOK`) ou disparo direto via Evolution API (delay aleatório de 8–15s entre mensagens para reduzir risco de bloqueio da conta); se nenhum estiver configurado, a campanha ainda é criada e o Excel gerado, e o envio fica manual via links `wa.me`.
- **Dois lockfiles no frontend** (`package-lock.json` e `pnpm-lock.yaml`) — gerenciador oficial ainda não definido/documentado.
- **Riscos de segurança conhecidos e parcialmente corrigidos**: módulos como feed, meta de vida do vendedor, investigar cliente, área de ataque e alertas de ranking podem ainda ter rotas sem `requireAuth` ou aceitar escopo (`usuario_id`/`empresa_id`) vindo do corpo/query em vez do token; desafios já foi reforçado (valida `sk_vendedor` × organização); dashboard de indústria revalida fornecedor a cada request mas ainda não usa o mesmo mecanismo de cookie de sessão dos demais perfis.

## Dependências com outros sistemas Santri / externos

- **ERP do cliente** — fonte de `VALOR_COMISSAO_A_PAGAR` e demais dados de comissão usados na Fase 3 de premiação do vendedor (consumido via view Oracle, não integração direta).
- **Oracle DW por organização** — cada cliente/organização Santri tem seu próprio Oracle; é a dependência mais crítica do sistema (login, ranking, vendedor, carteira, premiação).
- **n8n** — webhook (`N8N_ATIVACAO_WEBHOOK`) opcional para disparo de campanhas de ativação de clientes, recebendo payload completo (clientes, mensagens, links).
- **Evolution API** — instância de WhatsApp por vendedor (`TB_WHATSAPP_INSTANCIAS`) para disparo direto de mensagens de ativação.
- **OpenAI** (`OPENAI_API_KEY`/`OPENAI_MODEL`) — usada pelo assistente comercial para sugerir próximas ações.
- **Prefect** (jobs Python em `Back/jobs/`) — diagnóstico periódico por organização (conexão Oracle, views obrigatórias, contagens de dados), grava resultado em `organizacoes_diagnosticos` no MySQL central — provável ponto de observabilidade compartilhado entre implantações Santri.
- **MySQL central** — hub de autenticação, cadastro de organizações/tenants e feedback de usuários entre todas as organizações atendidas.

## Áreas conhecidas para evolução

- Definir se o app deve manter alternância claro/escuro ou ser dark-only (histórico de idas e vindas entre commits).
- Uniformizar `requireAuth`/escopo derivado do token em todos os módulos (feed, ativação, meta de vida, investigar cliente, área de ataque, alertas, indústria).
- Confirmar gerenciador de pacotes oficial do frontend (npm vs pnpm).
- Ativação de clientes: bug de nome de tabela (`GM_TB_CAMPANHAS_ATIVACAO_CLIENTES` vs `CAMPANHAS_ATIVACAO_CLIENTES`) impede persistir status fino de envio via Evolution API; falta tela de gestão de templates e histórico de campanhas.
- Sem suíte de testes automatizada no backend integrada ao CI (existe `qa-agent/` com Playwright, mas separado).
- DDL Oracle/MySQL sem migrations versionadas (scripts manuais + `ALTER TABLE` condicional no boot).

## Referências internas

- `README.md` — visão geral, stack e como rodar localmente.
- `docs/ATIVACAO_CLIENTES.md` — detalhamento completo do módulo de ativação de clientes.
- `CONTEXTO_PARA_CHAT.md` — snapshot de contexto para IA (2026-07-08), inclui mudanças em andamento e riscos.
- `RELATORIO_COMPLETO_DO_PROJETO.md` — auditoria estática completa (2026-07-02).
- `RELATORIO_DIAGNOSTICO_NJS-533.md` / `RELATORIO_ORACLE_THICK_MODE_VALIDACAO.md` — diagnóstico e correção do bug de Oracle Thick Mode.
