# Central de Ativação de Clientes

> Tela: `/ativacao-clientes` · Backend: `/api/ativacao-clientes/*`, `/api/templates-mensagens*`
> Perfis com acesso: `VENDEDOR`, `GERENTE`, `GERENTE_SISTEMAS` (o perfil `INDUSTRIA` é redirecionado para `/industria` e não vê esta tela)

## 1. O que é

Ferramenta de reativação/reengajamento de clientes via **WhatsApp**. O usuário escolhe um
público-alvo (segmento) dentro da própria carteira (ou da carteira das lojas que gerencia),
monta uma mensagem personalizada, revisa a lista de clientes que vão receber a mensagem e
confirma o disparo da campanha.

O fluxo é um **wizard de 4 etapas**, controlado pelo componente `ActivationStepper`:

```
0. Segmento  →  1. Mensagem  →  2. Preview  →  3. Enviar
```

## 2. Fluxo de uso

### Etapa 0 — Segmento (`SegmentStep`)

O usuário escolhe um dos 6 públicos pré-definidos. Cada card mostra, em tempo real, quantos
clientes existem no segmento, quantos têm telefone cadastrado e quantos não têm.

| Segmento | Critério (base RFV / Orçamentos) |
|---|---|
| Campeões | `classificacao` começa com "CAMPE" |
| Clientes Fiéis | `classificacao` começa com "CLIENTES FI" |
| Promissores | `classificacao` começa com "PROMISS" |
| Em Risco | `classificacao = 'EM RISCO'` |
| Hibernando | `classificacao` começa com "HIBERN" |
| Orçamentos em aberto | Clientes com orçamento aberto nos últimos 30 dias |

Origem dos dados (Oracle, schema `DM_VENDAS`):
- Segmentos RFV: `FATO_RFV_VENDEDOR` (vendedor vê só a própria carteira) ou `FATO_RFV_CLIENTE`
  (gerente vê a carteira agregada de todas as lojas sob sua gestão).
- "Orçamentos em aberto": `vw_orcamentos_gestao_metas` cruzada com a base RFV pelo nome do cliente.

### Etapa 1 — Mensagem (`MessageStep`)

O usuário escolhe um template-base (dropdown) e pode editar livremente o texto num campo com
contador de caracteres. Um preview em bolha, no estilo WhatsApp, mostra como a mensagem
apareceria para o cliente.

Variáveis dinâmicas disponíveis (inseridas por botão de atalho, substituídas por cliente na hora do envio):

| Variável | Substituída por | Se não houver valor |
|---|---|---|
| `{nome_cliente}` | Nome do cliente | "cliente" |
| `{valor_orcamento}` | Valor formatado em R$ | "não informado" |
| `{data_orcamento}` | Data do orçamento (pt-BR) | "não informada" |
| `{ultima_compra}` | Data da última compra (pt-BR) | "não informada" |

### Etapa 2 — Preview (`PreviewStep`)

Lista todos os clientes do segmento escolhido, com busca por nome/classificação/telefone,
seleção individual ou "selecionar todos os válidos", e opção de remover clientes específicos
da campanha antes de enviar. Só é possível selecionar clientes **com telefone válido**
(mínimo 10 dígitos); clientes sem telefone aparecem na lista mas com o checkbox desabilitado.
Mostra contadores: total, com telefone, sem telefone, prontos para envio.

### Etapa 3 — Enviar (`SendStep`)

Tela de confirmação final: resumo da campanha (segmento, quantidade de clientes, nº de
caracteres da mensagem), texto final, e a lista de clientes com um botão **"Testar"** por
linha (abre o link do WhatsApp individual, `wa.me`, sem enviar nada automaticamente).

Botões:
- **Abrir todos os links** — abre uma aba `wa.me` por cliente (com um pequeno atraso entre
  aberturas para não ser bloqueado pelo navegador). É um envio manual, um a um, pelo próprio
  WhatsApp do usuário.
- **Confirmar campanha** — dispara o fluxo automático descrito na seção 3.

## 3. O que acontece ao confirmar a campanha

1. A campanha é salva no Oracle (tabelas `CAMPANHAS_ATIVACAO` / `CAMPANHAS_ATIVACAO_CLIENTES`)
   via `POST /api/ativacao-clientes/campanhas`.
2. Nesse mesmo passo, um **arquivo Excel é baixado automaticamente** no navegador com a lista
   de clientes e a mensagem final de cada um (ver seção 6).
3. Em seguida é chamado `POST /api/ativacao-clientes/campanhas/:id/enviar`, que pode disparar
   o envio por até dois canais, dependendo do que estiver configurado no ambiente:
   - **Webhook n8n** (`N8N_ATIVACAO_WEBHOOK`): envia o payload completo (clientes, mensagens,
     links) para automação externa.
   - **Evolution API** (`EVOLUTION_API_URL` + `EVOLUTION_API_KEY`): dispara a mensagem
     diretamente pela instância de WhatsApp vinculada ao vendedor (cadastrada em
     `TB_WHATSAPP_INSTANCIAS`), **um cliente por vez, com um atraso aleatório de 8 a 15
     segundos entre mensagens** — mecanismo para reduzir o risco de bloqueio da conta de
     WhatsApp usada no disparo em massa.
4. Se nenhum dos dois estiver configurado, a campanha ainda é salva e o Excel ainda é gerado —
   o envio de fato fica por conta dos links `wa.me` abertos manualmente na Etapa 3.

Falhas no webhook ou na Evolution API não derrubam a criação da campanha: o status de cada
canal (`webhook_status`, `evolution_status`) é apenas reportado como "falhou".

## 4. Templates de mensagens

Endpoint: `/api/templates-mensagens` (`GET`, `POST`, `PUT` — **não existe `DELETE`**).

- Existem **6 templates padrão fixos** (um por segmento), sempre disponíveis mesmo sem tabela no
  banco.
- Templates persistidos ficam na tabela Oracle `TEMPLATES_MENSAGENS`, com um `escopo`:
  - `SISTEMA` — visível para todos.
  - `EMPRESA` — visível só para usuários da mesma empresa.
  - `USUARIO` — visível só para o vendedor dono do template.
- Não há, hoje, nenhuma tela que crie ou edite templates — o wizard consome apenas o `GET` para
  popular o dropdown da Etapa 1. As rotas de criação/edição existem no backend mas ainda não têm
  uma UI associada.

## 5. Regras de acesso e escopo

- **Vendedor**: só vê e envia para clientes da própria carteira (`sk_vendedor` obrigatório).
- **Gerente / Gerente de Sistemas**: vê a carteira agregada de todas as lojas às quais tem
  acesso.
- O escopo (`role`, `sk_vendedor`, `empresa_id`) é sempre resolvido no servidor a partir do
  usuário autenticado — nunca é aceito o que vier do navegador.
- Diferente das telas de Ranking e Painel, a Ativação de Clientes **não exige seleção explícita
  de loja**: um gerente multi-loja vê a carteira de todas as lojas somada, sem filtro por loja
  individual (isso só é relevante hoje para o segmento "Orçamentos em aberto", já que a base RFV
  não tem coluna de loja).
- Qualquer outro perfil autenticado recebe erro ao tentar acessar as rotas.

## 6. Exportação em Excel

Gerada automaticamente a cada campanha criada (arquivo `.xlsx`, nome no formato
`{segmento}-{DD-MM-AAAA}.xlsx`), com uma linha por cliente:

| Coluna | Conteúdo |
|---|---|
| Cliente | Nome |
| Telefone | Telefone |
| Última compra | Data formatada |
| Classificação | Classificação RFV |
| Data da campanha | Data de confirmação |
| Confirmado por | Nome do usuário que confirmou |
| Mensagem | Texto final já com as variáveis substituídas |

Se a geração do Excel falhar por qualquer motivo, a campanha ainda é salva normalmente (apenas
não há download).

## 7. Endpoints (referência técnica)

Todos exigem sessão autenticada (`requireAuth`).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/ativacao-clientes/segmentos` | Lista os 6 segmentos disponíveis |
| GET | `/api/ativacao-clientes/resumo` | Contadores (total / com telefone / sem telefone / valor potencial) de um segmento |
| GET | `/api/ativacao-clientes/preview` | Lista de clientes do segmento, com busca e ordenação |
| POST | `/api/ativacao-clientes/campanhas` | Cria/persiste a campanha e retorna o Excel |
| POST | `/api/ativacao-clientes/campanhas/:id/enviar` | Dispara o envio (webhook / Evolution API) |
| GET | `/api/templates-mensagens` | Lista templates visíveis para o usuário |
| POST | `/api/templates-mensagens` | Cria template |
| PUT | `/api/templates-mensagens/:id` | Atualiza template |

## 8. Limitações conhecidas

Pontos identificados na leitura do código atual, relevantes para quem for dar suporte ou evoluir
a feature:

- **Status de envio por cliente via Evolution API não é gravado.** `whatsappDispatchService.js`
  grava o resultado numa tabela chamada `GM_TB_CAMPANHAS_ATIVACAO_CLIENTES`, mas a tabela real
  (definida no DDL e usada no resto do serviço) é `CAMPANHAS_ATIVACAO_CLIENTES` — sem o prefixo
  `GM_TB_`. Como a tabela com esse nome não existe, essa atualização fina de status
  (`ENVIADO_EVOLUTION`/`ERRO_EVOLUTION`) nunca é persistida. O status "grosseiro" da campanha
  como um todo continua funcionando normalmente.
- **Dois segmentos caem no visual genérico na Etapa 0.** O componente de UI usa as chaves
  `fieis` e `orcamento` para customizar ícone/cor dos cards, mas os IDs reais retornados pelo
  backend são `clientes_fieis` e `orcamentos_abertos`. Na prática, "Clientes Fiéis" e
  "Orçamentos em aberto" aparecem sempre com o ícone/cor padrão em vez do visual customizado
  (o funcionamento da segmentação em si não é afetado, é só um problema visual).
- **Sem histórico de campanhas.** Não existe uma tela nem um endpoint de listagem de campanhas
  já criadas — só é possível ver o ID da última campanha criada na sessão atual.
- **Rastreamento de cliques/conversão não implementado.** O banco já tem tabelas prontas para
  isso (`CAMPANHA_LINKS`, `CAMPANHA_EVENTOS`) e colunas de integração com um provedor tipo
  Z-API, mas nada disso é usado hoje — o único link gerado é o `wa.me` padrão, sem rastreamento.
- **Sem tela de gestão de templates.** As rotas de criar/editar template existem no backend, mas
  não há UI para usá-las; e não existe rota para excluir um template.
- **Sem indicação de progresso durante o disparo automático.** Como o envio via Evolution API
  tem um atraso de 8–15s por cliente, campanhas grandes podem levar bastante tempo para
  terminar, sem barra de progresso na tela.
- **Depende de configuração de infraestrutura por tenant.** Se as tabelas de ativação ainda não
  existirem no Oracle daquela empresa (schema `Back/sql/ddl_gestao_metas.sql` não aplicado), a
  tela continua funcionando (preview, mensagem, links `wa.me`, Excel), mas nada é persistido —
  o usuário recebe um aviso informando que a estrutura ainda não foi criada.

## 9. Arquivos principais

**Frontend**
- `Front/app/ativacao-clientes/page.tsx` — página/wizard
- `Front/components/ativacao-clientes/SegmentStep.tsx`, `MessageStep.tsx`, `PreviewStep.tsx`, `SendStep.tsx`, `ActivationStepper.tsx`
- `Front/hooks/useActivationWizard.ts`, `Front/hooks/useActivationCampaign.ts`
- `Front/lib/activation-service.ts`, `Front/lib/activation-types.ts`

**Backend**
- `Back/src/routes/ativacaoClientes.js`
- `Back/src/controllers/ativacaoClientesController.js`
- `Back/src/services/ativacaoClientesService.js`
- `Back/src/services/whatsappDispatchService.js`
- `Back/src/services/evolutionApiService.js`
- `Back/sql/ddl_gestao_metas.sql` (tabelas `CAMPANHAS_ATIVACAO`, `CAMPANHAS_ATIVACAO_CLIENTES`, `TEMPLATES_MENSAGENS`, `CAMPANHA_EVENTOS`, `CAMPANHA_LINKS`)
- `Back/src/db/migrations/create_whatsapp_instancias.sql`
