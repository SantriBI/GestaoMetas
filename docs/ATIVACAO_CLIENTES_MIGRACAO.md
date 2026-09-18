# Ativação de Clientes — Documentação Completa para Migração

> Documento de referência técnica única (front + back + banco + integrações) para recriar a
> funcionalidade **Ativação de Clientes** em outro sistema. Consolida e substitui, para fins de
> migração, o resumo funcional em `docs/ATIVACAO_CLIENTES.md`.

- **Rota da tela**: `/ativacao-clientes` (Next.js App Router, client component)
- **Endpoints backend**: `/api/ativacao-clientes/*`, `/api/templates-mensagens*` (Express)
- **Perfis com acesso**: `VENDEDOR`, `GERENTE`, `GERENTE_SISTEMAS`. `INDUSTRIA` é redirecionado para `/industria`.
- **Multi-tenant**: cada empresa tem seu próprio Oracle; toda query passa por um pool por `empresa_id`.

---

## 1. Visão geral funcional

Ferramenta de reengajamento de clientes via **WhatsApp**. O usuário escolhe um segmento de
clientes da própria carteira (classificação RFV) ou orçamentos em aberto, monta uma mensagem
personalizada com variáveis dinâmicas, revisa/filtra a lista de destinatários e confirma o
disparo — que pode virar um Excel, links manuais `wa.me`, um webhook n8n e/ou um envio automático
via Evolution API (WhatsApp não-oficial).

Fluxo: **wizard de 4 etapas** — `0. Segmento → 1. Mensagem → 2. Preview → 3. Enviar`.

---

## 2. FRONTEND

### 2.1 Arquivos

| Arquivo | Papel |
|---|---|
| `Front/app/ativacao-clientes/page.tsx` | Página raiz — monta o wizard, navegação, guarda de autenticação |
| `Front/components/ativacao-clientes/ActivationStepper.tsx` | Barra de progresso das 4 etapas |
| `Front/components/ativacao-clientes/SegmentStep.tsx` | Etapa 0 — seleção de segmento |
| `Front/components/ativacao-clientes/MessageStep.tsx` | Etapa 1 — edição de mensagem |
| `Front/components/ativacao-clientes/PreviewStep.tsx` | Etapa 2 — revisão/seleção de clientes |
| `Front/components/ativacao-clientes/SendStep.tsx` | Etapa 3 — confirmação/envio |
| `Front/components/ativacao-clientes/index.ts` | Barrel de exports |
| `Front/hooks/useActivationWizard.ts` | Controla índice do step atual (0–3) e se pode avançar |
| `Front/hooks/useActivationCampaign.ts` | Toda a lógica de estado/dados da campanha ("cérebro" da tela) |
| `Front/lib/activation-service.ts` | Chamadas HTTP + helpers de formatação/link |
| `Front/lib/activation-types.ts` | Tipos TypeScript compartilhados |

> Existem componentes órfãos não usados no fluxo atual (`TemplateSelector.tsx`, `ImpactCards.tsx`,
> `MessageEditor.tsx`, `AudienceSelector.tsx`, `ActivationHeader.tsx`, `ClientPreviewTable.tsx`) —
> não migrar, são versões antigas do wizard.

### 2.2 Layout / estrutura visual por etapa

**Header (sempre visível)**
- `AppShellNav` + `MobileTabBar` (navegação padrão do app)
- `ActivationStepper`: barra de progresso com largura `(step+1)/4 * 100%` + 4 marcos (Segmento /
  Mensagem / Preview / Enviar), ícone de check nos concluídos
- Bloco de erro (se `wizard.error`) com ícone de alerta

**Etapa 0 — SegmentStep**
- Grid responsivo (2–3 colunas) com 1 card por segmento (6 segmentos fixos)
- Cada card: ícone, "eyebrow" (categoria), título, descrição, 3 contadores (Total / Com Tel. /
  Sem Tel.) vindos de `segmentSummaries[segment.id]`
- Painel lateral fixo: "Segmento atual" + dicas de UX estáticas
- Botões Voltar / Continuar

**Etapa 1 — MessageStep**
- `<select>` de templates
- `<textarea>` de mensagem com contador de caracteres
- Botões de "variável rápida" que inserem `{nome_cliente}`, `{valor_orcamento}`,
  `{data_orcamento}`, `{ultima_compra}` na posição do cursor
- Painel de preview em bolha estilo WhatsApp usando `sampleClient` (primeiro cliente selecionado
  ou primeiro do preview)

**Etapa 2 — PreviewStep**
- 4 cards de estatística: Total / Com telefone / Sem telefone / Prontos para envio
- Campo de busca + checkbox "Selecionar todos válidos"
- Botão para abrir/fechar a lista (fecha automaticamente se `clients.length > 50`)
- Tabela: Selecionar | Cliente | Telefone | Última compra | Total compras | Ação (Remover)
- Checkbox desabilitado quando `!client.possui_telefone`

**Etapa 3 — SendStep**
- Resumo: segmento, quantidade, nº de caracteres, id da campanha
- Aviso de que o XLSX será baixado automaticamente
- Texto final da mensagem
- Lista de clientes com botão "Testar" (abre link `wa.me` individual)
- Botões: Voltar, "Abrir todos os links", "Confirmar campanha" (desabilitado durante `isBusy`)

### 2.3 Estados (tudo em `useState`/`useMemo`/`useRef` dentro de `useActivationCampaign` — sem Redux/Context)

```
segments: ActivationSegment[]                       // os 6 segmentos, vindos do backend
segmentSummaries: Record<string, ActivationSummary> // contador por segmento (cards da etapa 0)
templates: MessageTemplate[]                        // templates disponíveis (default + banco)
selectedSegment: string                              // id do segmento escolhido
selectedTemplateId: string
message: string                                      // texto da mensagem-base (com variáveis)
preview: ActivationPreviewResponse | null            // resposta bruta do GET /preview
selectedClientIds: string[]                          // ids marcados para envio
removedClientIds: string[]                           // ids removidos manualmente do preview
search: string                                       // termo de busca (via useDeferredValue)
sortBy: string   // default "valor_potencial"
sortDir: "asc" | "desc" // default "desc"
isBootLoading, isPreviewLoading, isPersisting: boolean
lastCampaignId: number | string | null
lastSendStatus: string | null
error: string | null
hasBootstrappedRef, previousSegmentRef: useRef  // controle de efeitos
```

Derivados via `useMemo`:
- `previewClients` = `preview.clientes` menos removidos, com `mensagem_final` e `whatsapp_link`
  recalculados no cliente a cada mudança de `message` (substituição de variáveis no frontend)
- `summary` = `segmentSummaries[selectedSegment]` combinado com contagens recalculadas de
  `previewClients` (reflete remoções feitas na tela)
- `selectedClients` = subconjunto de `previewClients` cujos ids estão em `selectedClientIds`
- `sampleClient` = primeiro cliente selecionado, ou primeiro do preview

### 2.4 Chamadas de API

| Função (`activation-service.ts`) | Método/rota | Quando é chamada |
|---|---|---|
| `getActivationSegments()` | `GET /api/ativacao-clientes/segmentos` | Bootstrap (montagem do hook) |
| `getMessageTemplates(scope)` | `GET /api/templates-mensagens?role&sk_vendedor&empresa_id` | Bootstrap, em paralelo |
| `getActivationSummary(segmento, scope)` | `GET /api/ativacao-clientes/resumo?segmento&...scope` | Bootstrap, uma vez por segmento (`Promise.all` sobre os 6) |
| `getActivationPreview(segmento, scope, {search, sortBy, sortDir})` | `GET /api/ativacao-clientes/preview?segmento&...scope&search&sort_by&sort_dir` | Sempre que `selectedSegment`, `search` (deferred), `sortBy` ou `sortDir` mudam |
| `createActivationCampaign(payload)` | `POST /api/ativacao-clientes/campanhas` | Ao confirmar (`triggerSend`), se ainda não houver `lastCampaignId` |
| `sendActivationCampaign(campanhaId, payload)` | `POST /api/ativacao-clientes/campanhas/:id/enviar` | Logo após criar a campanha |

- `fetchJson` sempre usa `cache: "no-store"`.
- `createActivationCampaign` trata resposta especial: se `Content-Type` não for JSON, assume que
  é o arquivo `.xlsx` (blob) e dispara download automático via `<a download>` +
  `URL.createObjectURL`.

### 2.5 Bibliotecas usadas na tela

- `lucide-react` (ícones: `AlertTriangle`, `Sparkles`, `Trophy`, `Users`, `TrendingUp`,
  `MoonStar`, `ClipboardList`, `Check`, `ArrowRight`, `ChevronDown`, `ChevronRight`)
- `sonner` (`toast.success`/`toast.error`) para feedback
- Tailwind CSS puro (sem chart lib, date picker ou grid de terceiros — tabela é HTML nativo)
- `next/navigation` (`useRouter`)

### 2.6 Lógica de negócio no frontend

**Substituição de variáveis** (`replaceActivationVariables`, espelha exatamente o backend):
```ts
export function replaceActivationVariables(message: string, client: {...}) {
  const variables: Record<string, string> = {
    nome_cliente: client.nome_cliente || "cliente",
    valor_orcamento: client.valor_orcamento != null
      ? formatActivationCurrency(client.valor_orcamento) : "não informado",
    data_orcamento: formatActivationDate(client.data_orcamento),
    ultima_compra: formatActivationDate(client.ultima_compra),
  }
  return String(message ?? "").replace(/\{([a-z_]+)\}/gi, (_, key) => variables[key] ?? "")
}
```

**Link do WhatsApp** (`buildActivationWhatsappLink`): valida telefone com pelo menos 10 dígitos,
remove não-dígitos, prefixa `55`, monta:
```
https://wa.me/55{telefone}?text={mensagem codificada, espaços como +}
```

**Formatação**: moeda BRL via `Intl.NumberFormat` pt-BR; datas via `toLocaleDateString("pt-BR")`
com tratamento especial para datas Oracle no formato `YYYYMMDD`.

**Seleção automática**: ao carregar o preview, seleciona por padrão todos os clientes com
telefone válido; ao trocar de segmento, tenta preservar seleção prévia se os ids ainda existirem.

**Troca de template automática**: ao trocar de segmento, seleciona automaticamente o template
correspondente à `classificacao_rfv` do segmento (fallback: primeiro da lista).

**"Abrir todos os links"** (`page.tsx`): abre uma janela `window.open` por cliente, com atraso de
`index * 120ms` entre aberturas, para reduzir bloqueio de pop-up.

**Fallback de "Voltar"** na etapa 0: `router.back()` se houver histórico; senão `/vendedor`
(vendedor) ou `/dashboard` (demais perfis).

### 2.7 Navegação / permissões

```ts
useEffect(() => {
  const user = getStoredUser()
  if (!user) { router.push("/login"); return }
  if (user.role === "INDUSTRIA") { router.push("/industria"); return }
  setStoredUser(user)
  setAuthUser(user)
}, [router])
```

- `scope` (`role`, `sk_vendedor`, `empresa_id`, `id_usuario`, `nome_usuario`) é montado no cliente
  a partir do usuário logado e enviado em toda chamada — **mas o backend nunca confia nesses
  valores**: sempre reconstrói o escopo a partir da sessão validada (`req.auth`).
- Pontos de entrada: botão "Ativação de Clientes" em `Front/app/vendedor/page.tsx` e
  `Front/app/dashboard/page.tsx`, ambos fazendo `router.push("/ativacao-clientes")`.

---

## 3. BACKEND

### 3.1 Rotas (`Back/src/routes/ativacaoClientes.js`)

```js
const router = express.Router()
router.use(requireAuth)

router.get("/ativacao-clientes/segmentos", getSegmentos)
router.get("/ativacao-clientes/resumo", getResumo)
router.get("/ativacao-clientes/preview", getPreview)
router.post("/ativacao-clientes/campanhas", postCampanha)
router.post("/ativacao-clientes/campanhas/:id/enviar", postEnviarCampanha)

router.get("/templates-mensagens", getTemplates)
router.post("/templates-mensagens", postTemplate)
router.put("/templates-mensagens/:id", putTemplate)
```

Montada em `Back/index.js` sob prefixo `/api`:
```js
import ativacaoClientesRoutes from './src/routes/ativacaoClientes.js';
app.use('/api', ativacaoClientesRoutes);
```

Endpoints reais: `/api/ativacao-clientes/*` e `/api/templates-mensagens*`. **Não existe** rota
`DELETE` de template, nem listagem/histórico de campanhas.

### 3.2 Autenticação/Autorização

`router.use(requireAuth)` (`Back/src/middleware/auth.js`) exige cookie `AUTH_COOKIE_NAME` ou
header `Authorization: Bearer`. Fluxo:
1. Valida assinatura do JWT (`verifyAuthToken`)
2. Confirma usuário ativo e `token_version` batendo com o token (permite invalidar sessões)
3. Resolve `empresa_id` — `GERENTE_SISTEMAS` pode trocar de organização via query
   `empresa_id`, validado por `assertSystemManagerOrganizationAccess`
4. Popula `req.auth = { id_usuario, nome, role, empresa_id, sk_vendedor, cpf, token_version, featureFlags }`

Autorização de negócio (dentro do service, não middleware):
```js
async function buildAccessScope({ role, sk_vendedor, empresa_id, lojaScope = null }) {
  const perfil = String(role ?? "").toUpperCase()
  if (perfil !== "VENDEDOR" && perfil !== "GERENTE" && perfil !== "GERENTE_SISTEMAS") {
    throw new Error("Perfil inválido para ativação de clientes.")
  }
  if (perfil === "VENDEDOR" && !sk_vendedor) {
    throw new Error("SK_VENDEDOR é obrigatório para o perfil vendedor.")
  }
  ...
}
```
Qualquer outro perfil autenticado (ex.: `INDUSTRIA`) recebe erro 400 se chamar diretamente (o
frontend simplesmente nunca navega até lá para esse perfil).

### 3.3 Escopo de loja

```js
// Ativacao de Clientes agrega todas as lojas do vendedor - so o Painel/Jornada e o Ranking
// exigem selecao de loja.
const lojaScope = await getScopedLojaScope(req, { required: false })
```
Valida sempre no servidor contra `FATO_FUNCIONARIOS_ACESSOS`/`getLojasForRole` (nunca confia no
que vem do frontend); com `required:false`, se o usuário tem múltiplas lojas e não seleciona
nenhuma, agrega automaticamente todas ("TODAS"). Só é efetivamente relevante para o segmento
"Orçamentos em aberto" (a base RFV não tem coluna de loja).

### 3.4 Controller (`Back/src/controllers/ativacaoClientesController.js`)

Função central de resolução de escopo:
```js
async function getScopeFromRequest(req, res) {
  const lojaScope = await getScopedLojaScope(req, { required: false })
  if (lojaScope.error) {
    res.status(lojaScope.error.status).json({ error: lojaScope.error.message })
    return null
  }
  return {
    role: req.auth?.role,
    sk_vendedor: req.auth?.sk_vendedor ?? null,
    empresa_id: req.auth?.empresa_id ?? null,
    id_usuario: req.auth?.id_usuario ?? null,
    nome_usuario: req.auth?.nome ?? req.auth?.nome_completo ?? req.auth?.login ?? null,
    lojaScope,
  }
}
```

Handlers:
- **`getSegmentos`** → `listarSegmentos()` (dados fixos em memória, sem query)
- **`getResumo`** → `payload = { segmento, messageBase, ...scope }` → `obterResumoCampanha`
- **`getPreview`** → idem + `search`, `sortBy` (`sort_by`, default `"valor_potencial"`), `sortDir`
  (`sort_dir`, default `"desc"`) → `obterPreviewCampanha`
- **`postCampanha`** → `criarCampanha({...req.body, ...scope})`, depois **sempre tenta gerar o
  Excel** e retorna o **buffer binário como resposta HTTP** com headers customizados:
  ```js
  res.setHeader("Access-Control-Expose-Headers",
    "Content-Disposition, X-Campaign-Id, X-Campaign-Persisted, X-Campaign-Segmento")
  res.setHeader("X-Campaign-Id", String(result.campanha.id ?? ""))
  res.setHeader("X-Campaign-Persisted", String(Boolean(result.persisted)))
  res.setHeader("X-Campaign-Segmento", String(result.campanha.segmento ?? ""))
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  return res.status(201).send(buffer)
  ```
  Se a geração do Excel falhar, cai para `res.status(201).json(result)` — a campanha já foi
  persistida antes desse trecho, o Excel é só um "bônus" da resposta.
- **`postEnviarCampanha`** → `enviarCampanha(campanhaId, {...req.body, ...scope})`
- **`getTemplates` / `postTemplate` / `putTemplate`** → CRUD de templates (sem `DELETE`)

### 3.5 Service (`Back/src/services/ativacaoClientesService.js`) — regras de negócio

#### Segmentos (fixos em memória — não vêm de tabela)

```js
const SEGMENTS = [
  { id: "campeoes",           titulo: "Campeões",             classificacao: "Campeões",             audienceType: "rfv" },
  { id: "clientes_fieis",     titulo: "Clientes Fiéis",        classificacao: "Clientes Fiéis",       audienceType: "rfv" },
  { id: "promissores",        titulo: "Promissores",           classificacao: "Promissores",          audienceType: "rfv" },
  { id: "em_risco",           titulo: "Em Risco",              classificacao: "Em Risco",             audienceType: "rfv" },
  { id: "hibernando",         titulo: "Hibernando",            classificacao: "Hibernando",           audienceType: "rfv" },
  { id: "orcamentos_abertos", titulo: "Orçamentos em aberto",  classificacao: "Orçamentos em aberto", audienceType: "orcamento" },
]
```

#### Templates padrão (6 fixos, `escopo: "SISTEMA"`, `tipo: "PADRAO"`, um por segmento)

Sempre disponíveis, mesmo sem tabela `TEMPLATES_MENSAGENS` provisionada no tenant.

#### Predicado de classificação RFV por segmento

```js
function classificacaoPredicate(segmentConfig) {
  switch (segmentConfig.id) {
    case "campeoes":       return "UPPER(TRIM(rfv.classificacao)) LIKE 'CAMPE%'"
    case "clientes_fieis": return "UPPER(TRIM(rfv.classificacao)) LIKE 'CLIENTES FI%'"
    case "promissores":    return "UPPER(TRIM(rfv.classificacao)) LIKE 'PROMISS%'"
    case "em_risco":       return "UPPER(TRIM(rfv.classificacao)) = 'EM RISCO'"
    case "hibernando":     return "UPPER(TRIM(rfv.classificacao)) LIKE 'HIBERN%'"
    default: throw new Error("Segmento RFV inválido.")
  }
}
```

#### Fonte RFV por perfil (vendedor vs. gerente)

```js
function buildRfvSource(scope) {
  if (scope.isGerente) {
    return { from: "DM_VENDAS.FATO_RFV_CLIENTE rfv", where: "1 = 1", binds: {} }
  }
  return {
    from: "DM_VENDAS.FATO_RFV_VENDEDOR rfv",
    where: "rfv.sk_vendedor = :sk_vendedor",
    binds: { sk_vendedor: scope.skVendedor },
  }
}
```

#### Query — clientes de segmento RFV

```sql
SELECT
  rfv.sk_cliente,
  rfv.nome_cliente,
  rfv.telefone,
  rfv.classificacao,
  rfv.ultima_compra,
  rfv.valor AS valor_potencial,
  CAST(NULL AS NUMBER) AS valor_orcamento,
  CAST(NULL AS NUMBER) AS data_orcamento
FROM <DM_VENDAS.FATO_RFV_VENDEDOR ou DM_VENDAS.FATO_RFV_CLIENTE> rfv
WHERE <rfv.sk_vendedor = :sk_vendedor  |  1 = 1>
  AND <classificacaoPredicate>
ORDER BY NVL(rfv.valor, 0) DESC, rfv.nome_cliente
```

#### Query — segmento "Orçamentos em aberto" (cruza orçamentos com base RFV)

```sql
WITH rfv_base AS (
  SELECT sk_cliente, nome_cliente, telefone, ultima_compra, classificacao, valor
  FROM <DM_VENDAS.FATO_RFV_VENDEDOR (WHERE sk_vendedor = :vendedor_id) ou DM_VENDAS.FATO_RFV_CLIENTE (sem WHERE)>
)
SELECT
  rfv.sk_cliente,
  COALESCE(rfv.nome_cliente, orc.cliente) AS nome_cliente,
  COALESCE(rfv.telefone, orc.telefone)   AS telefone,
  rfv.classificacao,
  rfv.ultima_compra,
  NVL(rfv.valor, 0) AS valor_potencial,
  NVL(orc.valor, 0) AS valor_orcamento,
  orc.data AS data_orcamento,
  CASE WHEN LENGTH(REGEXP_REPLACE(NVL(orc.telefone, ''), '[^0-9]', '')) >= 10 THEN 1 ELSE 0 END AS possui_telefone
FROM vw_orcamentos_gestao_metas orc
LEFT JOIN rfv_base rfv ON UPPER(TRIM(rfv.nome_cliente)) = UPPER(TRIM(orc.cliente))
WHERE <orc.vendedor_id = :vendedor_id  |  1 = 1>
  AND <condição dinâmica de loja: orc.<coluna_loja> IN (...)>
  AND TO_DATE(TRIM(orc.data), 'DD/MM/RR') >= TRUNC(SYSDATE) - 30
ORDER BY TO_DATE(TRIM(orc.data), 'DD/MM/RR') DESC, orc.valor DESC
```

- Coluna de loja resolvida dinamicamente (`resolveLojaColumnName(empresa_id,
  "VW_ORCAMENTOS_GESTAO_METAS")`), condição montada por `buildLojaInCondition`
  (`Back/src/services/lojaScopeService.js`) — aceita `GERENTE`/`VENDEDOR`, mantém `1=1` (sem
  filtro) para `GERENTE_SISTEMAS`.
- "Válido" = janela de 30 dias (`TRUNC(SYSDATE) - 30`), sem limite superior (inclui futuros).

#### Substituição de variáveis (backend, espelha o frontend)

```js
export function substituirVariaveisMensagem(message, cliente) {
  const mapa = {
    nome_cliente: texto(cliente.nome_cliente) || "cliente",
    valor_orcamento: cliente.valor_orcamento ? formatCurrencyPtBr(cliente.valor_orcamento) : "não informado",
    data_orcamento: cliente.data_orcamento ? formatarDataCurta(cliente.data_orcamento) : "não informada",
    ultima_compra: cliente.ultima_compra ? formatarDataCurta(cliente.ultima_compra) : "não informada",
  }
  return String(message ?? "").replace(/\{([a-z_]+)\}/gi, (_, key) => mapa[key] ?? "")
}
```

#### Link WhatsApp (backend)

```js
function montarWaLink(telefone, mensagemFinal) {
  const limpo = telefoneValido(telefone) // >= 10 dígitos
  if (!limpo) return null
  return `https://wa.me/55${limpo}?text=${encodeURIComponent(mensagemFinal).replace(/%20/g, "+")}`
}
```

#### Verificação dinâmica de schema (multi-tenant tolerante a tabelas ausentes)

```js
async function tableExists(tableName, dbQuery) {
  const rows = await dbQuery(
    `SELECT COUNT(*) AS total FROM USER_TABLES WHERE TABLE_NAME = :table_name`,
    { table_name: String(tableName).toUpperCase() }
  )
  return numero(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}
```

Usada antes de qualquer INSERT/UPDATE em `CAMPANHAS_ATIVACAO`, `CAMPANHAS_ATIVACAO_CLIENTES` e
`TEMPLATES_MENSAGENS` — se a tabela não existir naquele tenant Oracle, a operação **degrada
graciosamente** (`persisted: false` + aviso, sem quebrar a tela). Há também `tableHasColumns`
(via `USER_TAB_COLUMNS`) para saber se `CAMPANHAS_ATIVACAO` tem as colunas de confirmação
(`DATA_CONFIRMACAO`, `ID_USUARIO_CONFIRMACAO`, `NOME_USUARIO_CONFIRMACAO`), com resultado
cacheado em memória (`Map`) por `empresa_id`.

#### Criação da campanha — INSERT no cabeçalho

```sql
INSERT INTO CAMPANHAS_ATIVACAO (
  id, segmento, template_id, mensagem_base,
  total_clientes, total_com_telefone, total_sem_telefone,
  vendedor_id, empresa_id,
  [data_confirmacao, id_usuario_confirmacao, nome_usuario_confirmacao,] -- se suportado
  data_criacao
) VALUES (
  :id, :segmento, :template_id, :mensagem_base,
  :total_clientes, :total_com_telefone, :total_sem_telefone,
  :vendedor_id, :empresa_id,
  [:data_confirmacao, :id_usuario_confirmacao, :nome_usuario_confirmacao,]
  SYSDATE
)
```
`id` é gerado por `SELECT NVL(MAX(id), 0) + 1 AS next_id FROM CAMPANHAS_ATIVACAO` — **não usa
sequence** apesar de existirem sequences no schema. **Risco de colisão em concorrência** — corrigir
no sistema novo usando identity/sequence/autoincrement real.

#### Criação da campanha — INSERT por cliente (loop, um a um)

```sql
INSERT INTO CAMPANHAS_ATIVACAO_CLIENTES (
  id, campanha_id, sk_cliente, nome_cliente, telefone,
  classificacao_rfv, ultima_compra, valor_orcamento, data_orcamento,
  mensagem_final, status_envio
) VALUES (
  :id, :campanha_id, :sk_cliente, :nome_cliente, :telefone,
  :classificacao_rfv, :ultima_compra, :valor_orcamento, :data_orcamento,
  :mensagem_final, :status_envio  -- sempre 'PENDENTE'
)
```
`id` do cliente-campanha = `campanhaId * 100000 + index + 1` (PK artesanal, não sequence).
Executado em loop `for...of` com `await` sequencial — **não é bulk insert**, pode ser lento para
campanhas grandes. Recomenda-se migrar para insert em lote.

#### Envio da campanha (`enviarCampanha`)

1. Recarrega clientes de `CAMPANHAS_ATIVACAO_CLIENTES` (se existir):
   ```sql
   SELECT campanha_id, sk_cliente, nome_cliente, telefone, classificacao_rfv,
          ultima_compra, valor_orcamento, data_orcamento, mensagem_final
   FROM CAMPANHAS_ATIVACAO_CLIENTES
   WHERE campanha_id = :campanha_id
   ORDER BY id
   ```
   (ou usa `payload.clientes` do frontend, se a tabela não existir)
2. Monta `webhookPayload`; se `process.env.N8N_ATIVACAO_WEBHOOK` estiver setado, faz
   `fetch(POST, JSON)` para esse webhook externo (sem autenticação aparente, sem retries); falha
   não derruba o fluxo (`webhookStatus = "falhou"`)
3. Atualiza status "grosseiro" de todos os clientes da campanha:
   ```sql
   UPDATE CAMPANHAS_ATIVACAO_CLIENTES
   SET status_envio = :status_envio  -- 'ENVIADO_WEBHOOK' ou 'LINK_GERADO'
   WHERE campanha_id = :campanha_id
   ```
4. Atualiza confirmação no cabeçalho (se suportado):
   ```sql
   UPDATE CAMPANHAS_ATIVACAO
   SET data_confirmacao = :data_confirmacao,
       id_usuario_confirmacao = :id_usuario_confirmacao,
       nome_usuario_confirmacao = :nome_usuario_confirmacao
   WHERE id = :id
   ```
5. Se `EVOLUTION_API_URL` estiver configurada e houver `sk_vendedor`, resolve a instância
   WhatsApp do vendedor e chama `dispatchCampanha(...)` para disparo direto, cliente a cliente.
6. Retorna `{ campanha, webhook_status, evolution_status, evolution_resultados, clientes, payload_n8n }`.

#### Geração do Excel (`gerarExcelCampanha`, via `exceljs`)

Colunas: `Cliente, Telefone, Última compra, Classificação, Data da campanha, Confirmado por,
Mensagem`. Nome: `{slug-do-titulo-do-segmento}-{DD-MM-AAAA}.xlsx`.

### 3.6 `Back/src/services/whatsappDispatchService.js` — disparo via Evolution API

```js
export function limparNumeroWhatsApp(telefone) {
  const limpo = String(telefone ?? "").replace(/\D/g, "")
  if (limpo.length === 8 || limpo.length === 9) return null
  if (limpo.length === 10 || limpo.length === 11) return `55${limpo}`
  if ((limpo.length === 12 || limpo.length === 13) && limpo.startsWith("55")) return limpo
  return null
}

function randomDelayMs() {
  const min = Number(process.env.EVOLUTION_DELAY_MIN_MS ?? 8000)
  const max = Number(process.env.EVOLUTION_DELAY_MAX_MS ?? 15000)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function dispatchCampanha({ instanceName, clientes, campanhaId, empresaId, onProgress }) {
  // filtra clientes com número válido, envia um a um via sendTextMessage,
  // aguarda randomDelayMs() (8-15s por padrão) entre cada envio,
  // atualiza status por cliente (ENVIADO_EVOLUTION / ERRO_EVOLUTION)
}
```

**⚠️ Bug conhecido (não corrigir silenciosamente na migração — decidir se replica ou conserta)**:
`atualizarStatusEnvio` faz `UPDATE` na tabela `GM_TB_CAMPANHAS_ATIVACAO_CLIENTES`, mas a tabela
real (DDL e resto do código) é `CAMPANHAS_ATIVACAO_CLIENTES` (sem prefixo `GM_TB_`). Como essa
tabela nunca existe, `tableExists` retorna `false` e a atualização fina de status por cliente
**nunca é persistida** — a função retorna cedo. O status "grosseiro" da campanha continua
funcionando (feito em outro trecho). Além disso, os valores `ENVIADO_EVOLUTION`/`ERRO_EVOLUTION`
usados aqui **não estão** na lista do `CHECK` constraint de `STATUS_ENVIO` (ver DDL seção 4.2) —
mesmo corrigindo o nome da tabela, o `UPDATE` falharia por violação de constraint.

### 3.7 `Back/src/services/evolutionApiService.js`

```js
export async function getInstanceNameByVendedor(sk_vendedor, empresaId) {
  // se TB_WHATSAPP_INSTANCIAS não existe -> retorna null
  // se sk_vendedor ausente -> busca instância default (ativo=1 AND instancia_default=1)
  // senão -> SELECT instance_name FROM TB_WHATSAPP_INSTANCIAS WHERE sk_vendedor=:sk_vendedor AND ativo=1
  //          lança erro se não encontrar
}

export async function sendTextMessage(instanceName, number, text) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number, text }),
  })
}
```
Autenticação com Evolution API via header `apikey: process.env.EVOLUTION_API_KEY`, base URL em
`process.env.EVOLUTION_API_URL`. Também expõe `getInstanceStatus`, `createInstance`,
`getInstanceQrCode`, `deleteInstance` (gestão de instâncias — não usados na tela de ativação em
si, mas parte do mesmo subsistema WhatsApp).

### 3.8 Templates de mensagens — CRUD

```sql
-- Listagem (respeita escopo)
SELECT id, nome_template, tipo, classificacao_rfv, mensagem, escopo, vendedor_id, empresa_id, data_criacao
FROM TEMPLATES_MENSAGENS
WHERE escopo = 'SISTEMA'
   OR (:empresa_id IS NOT NULL AND empresa_id = :empresa_id)
   OR (:role = 'VENDEDOR' AND vendedor_id = :sk_vendedor)
ORDER BY data_criacao DESC, nome_template
```
```sql
-- Criação
INSERT INTO TEMPLATES_MENSAGENS (
  id, nome_template, tipo, classificacao_rfv, mensagem, escopo, vendedor_id, empresa_id, data_criacao
) VALUES (
  :id, :nome_template, :tipo, :classificacao_rfv, :mensagem, :escopo, :vendedor_id, :empresa_id, SYSDATE
)
```
```sql
-- Atualização
UPDATE TEMPLATES_MENSAGENS
SET nome_template=:nome_template, tipo=:tipo, classificacao_rfv=:classificacao_rfv,
    mensagem=:mensagem, escopo=:escopo, vendedor_id=:vendedor_id, empresa_id=:empresa_id
WHERE id = :id
```
Não existe endpoint de exclusão. Retorno sempre combina os 6 templates fixos com os persistidos
no banco (se a tabela existir). Não há UI para criar/editar templates hoje — só o `GET` é
consumido pelo dropdown da Etapa 1.

---

## 4. CONEXÕES E BANCO DE DADOS

### 4.1 Conexão com Oracle (multi-tenant)

- Um pool por organização (`Back/src/db/oracle-tenants.js`)
- Credenciais Oracle de cada empresa ficam em `organizacoes_auth` (MySQL "central" —
  `centralPool`), senha criptografada (`decryptSecret`/`APP_ENCRYPTION_KEY`)
- `poolCache: Map<empresaId, Promise<{pool, connectString}>>` — pool criado sob demanda,
  `poolMin: 1, poolMax: 5, poolIncrement: 1, poolTimeout: 60`
- Toda a lógica de ativação usa exclusivamente `queryOracleByEmpresaId(empresaId, sql, binds, options)`
  — nunca o pool "legado" (`Back/src/db/oracle.js`, usado só por rotinas administrativas)
- Retry automático (até 3 tentativas) para erros transitórios Oracle (`ORA-08103`) em SELECTs;
  DML (INSERT/UPDATE/DELETE/MERGE) sem retry, `autoCommit: true`
- Globais do driver: `oracledb.outFormat = OUT_FORMAT_OBJECT`, `oracledb.fetchAsString = [CLOB]`

### 4.2 DDL das tabelas envolvidas (schema `DM_VENDAS`)

```sql
-- 1) Cabeçalho da campanha
CREATE TABLE "DM_VENDAS"."CAMPANHAS_ATIVACAO"
(
    "ID"                       NUMBER(18,0),
    "SEGMENTO"                 VARCHAR2(60 CHAR)  NOT NULL ENABLE,
    "TEMPLATE_ID"              NUMBER(18,0),
    "MENSAGEM_BASE"            VARCHAR2(2000 CHAR),
    "TOTAL_CLIENTES"           NUMBER(10,0)       DEFAULT 0  NOT NULL ENABLE,
    "TOTAL_COM_TELEFONE"       NUMBER(10,0)       DEFAULT 0  NOT NULL ENABLE,
    "TOTAL_SEM_TELEFONE"       NUMBER(10,0)       DEFAULT 0  NOT NULL ENABLE,
    "VENDEDOR_ID"              NUMBER(18,0),
    "EMPRESA_ID"               NUMBER(18,0),
    "DATA_CONFIRMACAO"         DATE,
    "ID_USUARIO_CONFIRMACAO"   NUMBER(18,0),
    "NOME_USUARIO_CONFIRMACAO" VARCHAR2(255 CHAR),
    "DATA_CRIACAO"             DATE               DEFAULT SYSDATE NOT NULL ENABLE,
    CONSTRAINT "PK_CAMPANHAS_ATIVACAO" PRIMARY KEY ("ID")
);
CREATE INDEX "IDX_CAMP_ATIVACAO_LOOKUP"   ON "CAMPANHAS_ATIVACAO" ("EMPRESA_ID", "VENDEDOR_ID", "DATA_CRIACAO");
CREATE INDEX "IDX_CAMP_ATIVACAO_SEGMENTO" ON "CAMPANHAS_ATIVACAO" ("SEGMENTO", "DATA_CRIACAO");

-- 2) Clientes vinculados à campanha
CREATE TABLE "DM_VENDAS"."CAMPANHAS_ATIVACAO_CLIENTES"
(
    "ID"               NUMBER(18,0),
    "CAMPANHA_ID"      NUMBER(18,0)    NOT NULL ENABLE,
    "SK_CLIENTE"       NUMBER(18,0),
    "NOME_CLIENTE"     VARCHAR2(160 CHAR),
    "TELEFONE"         VARCHAR2(30 CHAR),
    "CLASSIFICACAO_RFV" VARCHAR2(80 CHAR),
    "ULTIMA_COMPRA"    DATE,
    "VALOR_ORCAMENTO"  NUMBER(18,2),
    "DATA_ORCAMENTO"   DATE,
    "MENSAGEM_FINAL"   VARCHAR2(2000 CHAR),
    "STATUS_ENVIO"     VARCHAR2(30 CHAR)  DEFAULT 'PENDENTE' NOT NULL ENABLE,
    "LINK_TOKEN"       VARCHAR2(80 CHAR),
    "LINK_URL"         VARCHAR2(500 CHAR),
    "MESSAGE_ID"       VARCHAR2(120 CHAR),
    "ZAPI_ZAAP_ID"     VARCHAR2(120 CHAR),
    "DATA_ENVIO_ZAPI"  DATE,
    "DETALHE_STATUS"   VARCHAR2(1000 CHAR),
    "ERRO_ENVIO"       VARCHAR2(1000 CHAR),
    "ULTIMO_EVENTO_EM" DATE,
    CONSTRAINT "CK_CAMP_ATIVACAO_STATUS_ENVIO"
        CHECK (status_envio IN
            ('PENDENTE','LINK_GERADO','ENVIADO_WEBHOOK','ENVIADO',
             'ENTREGUE','LIDO','RESPONDIDO','FALHA')) ENABLE,
    CONSTRAINT "PK_CAMPANHAS_ATIVACAO_CLIENTES" PRIMARY KEY ("ID"),
    CONSTRAINT "FK_CAMP_ATIVACAO_CLIENTE_CAMP"
        FOREIGN KEY ("CAMPANHA_ID") REFERENCES "CAMPANHAS_ATIVACAO" ("ID") ENABLE
);
CREATE INDEX "IDX_CAMP_ATIV_CLIENTES_CAMP" ON "CAMPANHAS_ATIVACAO_CLIENTES" ("CAMPANHA_ID", "STATUS_ENVIO");
CREATE INDEX "IDX_CAMP_ATIV_CLIENTE_SK"    ON "CAMPANHAS_ATIVACAO_CLIENTES" ("SK_CLIENTE", "CAMPANHA_ID");

-- 3) Templates de mensagens
CREATE TABLE "DM_VENDAS"."TEMPLATES_MENSAGENS"
(
    "ID"                  NUMBER GENERATED BY DEFAULT AS IDENTITY
                              MINVALUE 1 MAXVALUE 9999999999999999999999999999
                              INCREMENT BY 1 START WITH 1 CACHE 20
                              NOORDER NOCYCLE NOKEEP NOSCALE NOT NULL ENABLE,
    "NOME_TEMPLATE"       VARCHAR2(150 CHAR) NOT NULL ENABLE,
    "TIPO"                VARCHAR2(40 CHAR)  NOT NULL ENABLE,
    "CLASSIFICACAO_RFV"   VARCHAR2(60 CHAR),
    "MENSAGEM"            CLOB               NOT NULL ENABLE,
    "ESCOPO"              VARCHAR2(30 CHAR)  NOT NULL ENABLE,
    "VENDEDOR_ID"         NUMBER,
    "EMPRESA_ID"          NUMBER,
    "DATA_CRIACAO"        DATE               DEFAULT SYSDATE NOT NULL ENABLE,
    "DATA_ATUALIZACAO"    DATE               DEFAULT SYSDATE NOT NULL ENABLE,
    "USUARIO_CRIACAO"     VARCHAR2(100 CHAR),
    "USUARIO_ATUALIZACAO" VARCHAR2(100 CHAR),
    CONSTRAINT "CK_TM_TIPO"   CHECK (TIPO   IN ('PADRAO','PERSONALIZADO','AUTOMACAO')) ENABLE,
    CONSTRAINT "CK_TM_ESCOPO" CHECK (ESCOPO IN ('SISTEMA','EMPRESA','USUARIO'))        ENABLE,
    CONSTRAINT "PK_TEMPLATES_MENSAGENS" PRIMARY KEY ("ID")
);
CREATE INDEX "IDX_TM_CLASSIFICACAO_RFV" ON "TEMPLATES_MENSAGENS" ("CLASSIFICACAO_RFV");
CREATE INDEX "IDX_TM_DATA_CRIACAO"      ON "TEMPLATES_MENSAGENS" ("DATA_CRIACAO");
CREATE INDEX "IDX_TM_EMPRESA_ID"        ON "TEMPLATES_MENSAGENS" ("EMPRESA_ID");
CREATE INDEX "IDX_TM_VENDEDOR_ID"       ON "TEMPLATES_MENSAGENS" ("VENDEDOR_ID");

-- 4) Eventos de campanha (modelado, NÃO usado hoje)
CREATE TABLE "DM_VENDAS"."CAMPANHA_EVENTOS"
(
    "ID"                  NUMBER(18,0),
    "CAMPANHA_ID"         NUMBER(18,0)    NOT NULL ENABLE,
    "CAMPANHA_CLIENTE_ID" NUMBER(18,0),
    "CLIENTE_ID"          NUMBER(18,0),
    "TIPO_EVENTO"         VARCHAR2(40 CHAR) NOT NULL ENABLE,
    "DETALHE"             VARCHAR2(2000 CHAR),
    "DATA_EVENTO"         DATE             DEFAULT SYSDATE NOT NULL ENABLE,
    CONSTRAINT "PK_CAMPANHA_EVENTOS" PRIMARY KEY ("ID"),
    CONSTRAINT "FK_CAMP_EVENTOS_CAMP_V2"    FOREIGN KEY ("CAMPANHA_ID")         REFERENCES "CAMPANHAS_ATIVACAO" ("ID") ENABLE,
    CONSTRAINT "FK_CAMP_EVENTOS_CLIENTE_V2" FOREIGN KEY ("CAMPANHA_CLIENTE_ID") REFERENCES "CAMPANHAS_ATIVACAO_CLIENTES" ("ID") ENABLE
);

-- 5) Links rastreáveis de campanha (modelado, NÃO usado hoje)
CREATE TABLE "DM_VENDAS"."CAMPANHA_LINKS"
(
    "ID"                  NUMBER(18,0),
    "TOKEN"               VARCHAR2(80 CHAR)  NOT NULL ENABLE,
    "CAMPANHA_ID"         NUMBER(18,0)       NOT NULL ENABLE,
    "CAMPANHA_CLIENTE_ID" NUMBER(18,0)       NOT NULL ENABLE,
    "CLIENTE_ID"          NUMBER(18,0),
    "VENDEDOR_ID"         NUMBER(18,0),
    "LINK_URL"            VARCHAR2(500 CHAR),
    "TOTAL_CLIQUES"       NUMBER(10,0)       DEFAULT 0   NOT NULL ENABLE,
    "PRIMEIRO_CLIQUE"     DATE,
    "ULTIMO_CLIQUE"       DATE,
    "CONVERTEU"           CHAR(1 BYTE)       DEFAULT 'N' NOT NULL ENABLE,
    "VALOR_CONVERSAO"     NUMBER(18,2),
    "DATA_CRIACAO"        DATE               DEFAULT SYSDATE NOT NULL ENABLE,
    CONSTRAINT "CK_CAMP_LINKS_CONVERTEU" CHECK (converteu IN ('S','N')) ENABLE,
    CONSTRAINT "PK_CAMPANHA_LINKS" PRIMARY KEY ("ID"),
    CONSTRAINT "UQ_CAMP_LINKS_TOKEN" UNIQUE ("TOKEN"),
    CONSTRAINT "FK_CAMP_LINKS_CAMP"    FOREIGN KEY ("CAMPANHA_ID")         REFERENCES "CAMPANHAS_ATIVACAO" ("ID") ENABLE,
    CONSTRAINT "FK_CAMP_LINKS_CLIENTE" FOREIGN KEY ("CAMPANHA_CLIENTE_ID") REFERENCES "CAMPANHAS_ATIVACAO_CLIENTES" ("ID") ENABLE
);

-- 6) Instâncias WhatsApp por vendedor (Back/src/db/migrations/create_whatsapp_instancias.sql)
CREATE TABLE TB_WHATSAPP_INSTANCIAS (
  sk_vendedor       VARCHAR2(100)  NOT NULL,
  instance_name     VARCHAR2(200)  NOT NULL,
  ativo             NUMBER(1)      DEFAULT 1 NOT NULL,
  instancia_default NUMBER(1)      DEFAULT 0 NOT NULL,
  data_criacao      DATE           DEFAULT SYSDATE NOT NULL,
  data_atualizacao  DATE,
  CONSTRAINT pk_whatsapp_instancias PRIMARY KEY (sk_vendedor)
);
CREATE UNIQUE INDEX idx_whatsapp_instance_name ON TB_WHATSAPP_INSTANCIAS (instance_name);
```

### 4.3 Tabelas/views externas consultadas (não pertencem a este subsistema, mas são lidas)

| Objeto | Schema | Uso |
|---|---|---|
| `FATO_RFV_VENDEDOR` | `DM_VENDAS` | Carteira RFV do vendedor (segmentos RFV, visão vendedor) |
| `FATO_RFV_CLIENTE` | `DM_VENDAS` | Carteira RFV agregada (visão gerente) |
| `vw_orcamentos_gestao_metas` | schema do tenant | Orçamentos recentes (segmento "Orçamentos em aberto") |
| `FATO_FUNCIONARIOS_ACESSOS` | — | Base para `getLojasForRole`/validação de escopo de loja |
| `USER_TABLES` / `USER_TAB_COLUMNS` | dicionário Oracle | Checagem em runtime de schema provisionado por tenant |

### 4.4 Integrações externas

1. **Webhook n8n** — `process.env.N8N_ATIVACAO_WEBHOOK`: `POST` simples com JSON
   (`webhookPayload`), sem autenticação aparente, sem retries.
2. **Evolution API** (WhatsApp via Baileys) — `process.env.EVOLUTION_API_URL` +
   `EVOLUTION_API_KEY`: `POST /message/sendText/{instance}`. Atrasos configuráveis via
   `EVOLUTION_DELAY_MIN_MS` (default 8000) / `EVOLUTION_DELAY_MAX_MS` (default 15000).
3. **wa.me** (deep-link do WhatsApp) — fallback universal usado tanto no frontend quanto no
   backend quando nenhuma automação está configurada; não é uma API, apenas um link.

---

## 5. Regras de negócio e comportamentos notáveis (checklist para a migração)

1. Segmentos e templates padrão são **hardcoded no backend** — recriar 1:1 se a mesma taxonomia
   for mantida (não modelar como dado dinâmico a menos que se queira mudar o comportamento).
2. Três perfis afetam as queries: `VENDEDOR` (filtra por `sk_vendedor`), `GERENTE`/
   `GERENTE_SISTEMAS` (agregam toda a carteira, exceto filtro de loja em orçamentos).
3. "Telefone válido" = 10+ dígitos após remover não-dígitos.
4. Se as tabelas Oracle do tenant não existirem, o sistema detecta em runtime (`USER_TABLES`) e
   degrada para "somente preview/Excel/links manuais" sem erro fatal — decidir se esse
   comportamento de degradação graciosa deve ser preservado no novo sistema ou se tabelas passam
   a ser obrigatórias.
5. IDs de `CAMPANHAS_ATIVACAO`/`CAMPANHAS_ATIVACAO_CLIENTES` são gerados manualmente (`MAX(id)+1`
   e fórmula `campanhaId*100000+index+1`) — **recomenda-se usar sequence/identity/autoincrement
   real** no sistema novo para eliminar risco de colisão em concorrência.
6. Disparo automático via Evolution API é **serial, com atraso aleatório de 8–15s por cliente**
   (redução de risco de banimento do número) — campanhas grandes demoram, sem barra de progresso
   na UI atual. Considerar job assíncrono com progresso visível no novo sistema.
7. Não existe hoje tela/endpoint de histórico de campanhas nem de gestão de templates (CRUD sem
   UI, sem DELETE) — avaliar se isso deve ser adicionado na migração.
8. **Bugs conhecidos a resolver conscientemente na migração** (não replicar sem decisão
   explícita): nome de tabela errado em `whatsappDispatchService.js`
   (`GM_TB_CAMPANHAS_ATIVACAO_CLIENTES` vs `CAMPANHAS_ATIVACAO_CLIENTES`) e valores de status
   fora do `CHECK` constraint (`ENVIADO_EVOLUTION`/`ERRO_EVOLUTION`) — o rastreamento fino de
   status por cliente via Evolution está morto em produção hoje.
9. `CAMPANHA_LINKS`/`CAMPANHA_EVENTOS` já existem na modelagem (rastreamento de cliques/conversão,
   preparados para provedor tipo Z-API) mas não são usados — oportunidade de feature se o
   rastreamento for desejado no novo sistema.
10. Dois ids de segmento não batem com as chaves de customização visual no componente de UI:
    backend retorna `clientes_fieis`/`orcamentos_abertos`, mas o front usa `fieis`/`orcamento`
    para customizar ícone/cor — resultado: esses dois cards caem no visual genérico (bug visual
    menor, não funcional).
