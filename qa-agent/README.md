# qa-agent

Framework de QA automatizado do **SIP (Gestão de Metas)**. Simula um usuário real navegando pelo sistema e valida regressões antes de cada release. Construído com Playwright + TypeScript, Page Object Model e um relatório HTML rico (screenshots, vídeos, trace).

Este projeto cresce em etapas. Veja o estado atual em `## Cobertura atual` abaixo.

## Pré-requisitos

- Node.js 22 (mesma versão do resto do projeto)
- `Front` (porta 3000) e `Back` (porta 3001) já rodando localmente, com acesso ao Oracle configurado — o qa-agent **não sobe a aplicação**, só a testa.
- Um usuário de teste real por papel (`GERENTE`, `VENDEDOR`), idealmente numa organização/tenant de teste, não em produção.

## Como rodar

```bash
cd qa-agent
npm install
copy .env.example .env
# edite .env com QA_GERENTE_LOGIN/SENHA e QA_VENDEDOR_LOGIN/SENHA
npm run qa
```

Depois de rodar, abra o relatório HTML:

```bash
npm run qa:report
```

Outros comandos úteis:

| Comando | O que faz |
| --- | --- |
| `npm run qa` | Roda toda a suíte headless (usa `reports`, `logs`, `screenshots`, `videos`) |
| `npm run qa:headed` | Roda com navegador visível, útil para depurar |
| `npm run qa:ui` | Abre o Playwright UI Mode (interativo) |
| `npm run qa:smoke` | Roda só `tests/smoke` |
| `npm run qa:report` | Abre o último relatório HTML gerado |

## Variáveis de ambiente (`.env`)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `BASE_URL` | não (default `http://localhost:3000`) | Origem do frontend. As chamadas `/api/*` passam pelo rewrite do Next até o backend. |
| `HEADLESS` | não (default `true`) | `false` para ver o navegador |
| `DEFAULT_TIMEOUT_MS`, `ACTION_TIMEOUT_MS`, `NAVIGATION_TIMEOUT_MS` | não | Timeouts em ms |
| `SLOWMO_MS` | não | Desacelera ações, útil para depurar visualmente |
| `WORKERS` | não | Paralelismo (vazio = Playwright decide) |
| `QA_GERENTE_LOGIN` / `QA_GERENTE_SENHA` | sim, para specs de GERENTE | Credencial real de teste |
| `QA_VENDEDOR_LOGIN` / `QA_VENDEDOR_SENHA` | sim, para specs de VENDEDOR | Credencial real de teste |

Se uma credencial não estiver configurada, só os testes daquele papel falham (com uma mensagem clara) — o resto da suíte roda normalmente.

## Arquitetura

```
qa-agent/
  playwright.config.ts   # projects, reporters (list + html + summary), timeouts, evidencias em falha
  config/env.ts          # le e valida variaveis de ambiente
  fixtures/auth.fixture.ts  # login hibrido (API + cookie + sessionStorage) por papel
  pages/                 # Page Object Model (BasePage, LoginPage, AppShellNav, ...)
  helpers/               # login, logout, error-capture, screenshot, wait
  utils/assertions.ts    # expectNoConsoleErrors, expectNoHttpErrors, expectPageNotBlank...
  reporters/summary-reporter.ts  # logs/run-summary.json + espelha screenshots/videos
  tests/smoke/           # login, logout, protecao de rotas, crawler de navegacao
  reports/ screenshots/ videos/ logs/  # saida (gitignored)
```

### Por que a autenticação é "híbrida"

O login (`POST /api/login`) devolve um cookie httpOnly (`sip_auth`) **e** um JSON de usuário que o frontend grava em `sessionStorage`. O `storageState` nativo do Playwright persiste cookies e `localStorage`, mas **não `sessionStorage`**. Por isso `fixtures/auth.fixture.ts`:

1. Faz login uma vez por papel (via API, cacheado por worker) usando `helpers/login.ts`.
2. Aplica o cookie recebido no `BrowserContext` (`context.addCookies`).
3. Injeta o JSON do usuário em `sessionStorage` via `context.addInitScript`, **antes** de qualquer script da aplicação rodar.

Assim, todo teste que usa os fixtures `gerentePage`/`vendedorPage` já começa "logado de verdade", sem repetir o formulário — que continua testado à parte em `tests/smoke/login.spec.ts`.

### Sem `data-testid` na aplicação

O Front não tem nenhum `data-testid` hoje. Os Page Objects usam `getByRole`/`getByLabel`/texto visível como estratégia primária (recomendação oficial do Playwright). **Convenção para quando você mexer em algum componente no futuro:** adicione `data-testid` nele e atualize o Page Object correspondente — não é necessário um refactor em massa agora.

### O "crawler" de usuário real

`tests/smoke/crawl.spec.ts` loga como cada papel, lê os links **realmente renderizados** pelo `AppShellNav` (não uma lista fixa) e visita cada um, verificando: página não está em branco, sem erro de console, sem erro JS não tratado, sem resposta HTTP 4xx/5xx em `/api/*`, e tira um screenshot. As verificações usam `expect.soft` de propósito — **o teste não para na primeira falha**, continua até visitar todas as páginas, e reporta todas as falhas encontradas no final.

### Evidências em falha

`playwright.config.ts` já configura `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` e `trace: 'retain-on-failure'` — tudo aparece embutido no relatório HTML nativo. Além disso, `helpers/error-capture.ts` anexa um JSON com console/JS/HTTP errors sempre que algo relevante foi capturado numa página.

## Cobertura atual (Etapa 1)

- Login (sucesso por papel, senha incorreta, usuário inexistente)
- Logout (limpa sessão, redireciona)
- Proteção de rotas sem sessão (página a página, já que não há `middleware.ts`)
- Crawler de navegação por papel (Gerente, Vendedor) sobre todas as páginas do menu

## Próximas etapas (roadmap)

1. Dashboard do Gerente e Vendedor (KPIs, ranking, gráficos, modal de panorama)
2. CRUD de Feed (post/editar/excluir/curtir/comentar/destacar)
3. CRUD de Desafios (wizard, edição, cancelamento, participantes, payout)
4. Ativação de Clientes (segmentação → template → preview — **sem** acionar o envio real de WhatsApp)
5. Área de Ataque, Investigar Cliente, Perfil (upload de foto), Alterar Senha
6. Usuários/Admin (ativar/desativar, reset de senha, logoff, organizações) — requer credencial ADMIN/SUPERADMIN
7. Responsividade básica, paralelização, tags por módulo, Docker opcional, GitHub Actions

Crescimento já preparado na arquitetura: `test.describe(..., { tag: '@modulo' })` + `--grep` para rodar por módulo/tag; `projects` no config para rodar por papel; Docker via imagem oficial do Playwright quando fizer sentido; regressão visual via `toHaveScreenshot()`.
