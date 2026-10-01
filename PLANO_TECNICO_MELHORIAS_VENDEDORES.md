# Plano Técnico — Melhorias para Vendedores (SIP/Gestão de Metas)

Sep 17, 2026 · @Guilherme Diniz

## Resumo executivo

São 4 frentes, e vamos construí-las nesta ordem (decidido em conversa):

1. Simulador de margem/premiação — dentro de Comissões e Minha Premiação.
2. Alerta de projeção de meta — o gap em R$ até o fechamento do mês.
3. Roadmap de maximização de prêmio — cruzando orçamentos abertos, RFV e histórico de vendas.
4. Kanban de atividades/metas/projetos do vendedor — separado do kanban de carteira que já existe.

O sistema (SIP / Gestão de Metas — `Front/` em Next.js 16 + React 19, `Back/` em Node/Express, dados em Oracle) já tem boa parte da base pronta:

| Peça já existente | Onde está | O que já faz |
| --- | --- | --- |
| Percentual de premiação por grupo de produto | `Front/app/comissoes/page.tsx`, `Back/src/services/parametrosPremiacaoService.js`, tabela `PARAM_PERCENTUAL_GRUPO_PREMIACAO` | Gerente cadastra o % de premiação por grupo (nível 1/2/3 de `DIM_PRODUTOS`), com histórico de vigência |
| Minha Premiação (vendedor) | `Front/app/vendedor/minha-premiacao/page.tsx`, `Back/src/services/premiacaoVendedorService.js` | Mostra margem+frete do mês, gatilho mínimo (R$ 20.000), faixa de acelerador atual, bônus fixo e valor final; já calcula "falta X para o gatilho" e "falta X para a próxima faixa" |
| Ranking e meta mensal | `Back/src/routes/rankingVendedores.js` (`VW_RANKING_VENDEDORES`) | Traz `meta_mes`, `receita_mes`, `perc_atingimento`, `dias_restantes`, `meta_restante`, `meta_diaria_necessaria` — mas **não calcula projeção de fechamento** |
| Kanban de carteira (clientes com orçamento aberto) | `Front/app/vendedor/kanban/page.tsx`, `Back/src/services/kanban/*`, tabela `CRM_KANBAN_CARD` | Funil A\_CONTATAR → EM\_CONTATO → ORÇAMENTO\_ENVIADO → CONVERTIDO/NÃO\_CONVERTIDO, com RFV e valor de orçamento por card |
| Minha Meta de Vida | `Back/src/services/objetivoVendedorService.js` | Já cruza objetivo pessoal + comissão + RFV (clientes campeões) + orçamentos abertos por categoria preferida para gerar sugestões — é o padrão que vamos reaproveitar no Roadmap (fase 3) |
| Desafios comerciais | `Back/src/services/desafios/*`, tabelas `DESAFIOS_COMERCIAIS*` | Padrão de meta + progresso + prêmio por vendedor — referência de modelagem para o kanban de metas (fase 4) |

Cada fase abaixo detalha estado atual, o que construir (telas, endpoints, tabelas Oracle) e o que precisa ser decidido antes de codar. Nenhum código foi alterado ainda — este documento é só o plano.

## Fase 1 — Simulador de margem/premiação

**Status: implementado.** A Fase 1 foi implementada no repositório pela sessão local do Claude Code. A Decisão 1 (escada de faixas do acelerador) foi resolvida com os valores reais informados por Guilherme: de 0 a mais de 130.000 reais, percentual de 0% a 200%, bônus fixo de até 4.000 reais.

Arquivos criados: `Back/sql/param_faixa_acelerador_premiacao.sql` (migração da tabela `PARAM_FAIXA_ACELERADOR_PREMIACAO`, seguindo o padrão de vigência, ainda não executada em nenhum Oracle), `Back/src/services/premiacaoSimuladorService.js`, `Back/src/controllers/premiacaoSimuladorController.js`, `Back/src/services/__tests__/premiacaoSimuladorService.test.js` (8 testes, todos passando), `Front/lib/premiacao-simulador.ts`.

Arquivos alterados: `Back/src/services/parametrosPremiacaoService.js` (nova função `buscarPercentualVigenteGrupo`), `Front/app/vendedor/minha-premiacao/page.tsx` (bloco Simulador com contadores em reais), `Front/app/comissoes/page.tsx` (aba Faixas do acelerador para o gerente cadastrar a escada), `Back/sql/ddl_gestao_metas.sql` (tabela nova replicada no DDL mestre).

Validação: 50 de 50 testes do Back passando, build e checagem de tipos do Front sem erros; lint não rodou por falta do eslint instalado localmente no projeto.

Ponto em aberto para confirmar com Guilherme: quando a flag/tabela de comissões está zerada para um tenant, o simulador continua funcionando mas mostra incremento de comissão zero — só a faixa e a margem mudam. Isso segue o que o plano pediu, mas precisa de confirmação de que é o comportamento esperado nesse cenário.

O pedido: "se vender 20 mil do grupo tal, você vai ganhar mais tanto", com um contador mostrando quanto falta para o próximo nível de premiação.

### O que já existe

`premiacaoVendedorService.js` (`buscarMinhaPremiacao`) lê `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP` e já devolve, por vendedor: `margemMaisFrete`, `faixaAcelerador`, `percAcelerador`, `faltanteGatilho` (quanto falta de margem+frete para virar elegível ao gatilho de R$ 20.000) e `faltanteProximaFaixa` (quanto falta para subir de faixa — hoje calculado com um regex que extrai o limite superior do texto da faixa atual, `extrairLimiteSuperiorFaixa`). Isso já aparece na tela `Minha Premiação` como "faltam R$ X para a próxima faixa".

`parametrosPremiacaoService.js` guarda, por grupo de produto (nível 1/2/3 de `DIM_PRODUTOS`), o % de premiação vigente (`PARAM_PERCENTUAL_GRUPO_PREMIACAO`). `listarGruposSemPercentual` já mostra um exemplo de como cruzar receita por grupo com o percentual cadastrado.

### Limitação encontrada (bloqueia o simulador completo)

A escada inteira de faixas do acelerador (todos os níveis de margem+frete e o % de cada um) **não existe como tabela consultável** no código ou no `Back/sql/ddl_gestao_metas.sql` — ela vive dentro da lógica da view Oracle `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP` / `VW_APURACAO_PREMIACAO_VENDEDOR`, que não está versionada no repositório. Hoje o app só vê a faixa atual do vendedor (uma linha da view) e infere o limite superior dela por regex. Para simular "se eu vender mais R$X, para qual faixa eu vou" precisamos da tabela completa (limites inferior/superior e % de cada faixa). Isso vira uma decisão pendente (ver seção final).

### O que construir

1. **Tabela de parâmetro nova** `PARAM_FAIXA_ACELERADOR_PREMIACAO` (mesmo padrão de vigência de `PARAM_PERCENTUAL_GRUPO_PREMIACAO`): `LIMITE_INFERIOR`, `LIMITE_SUPERIOR` (nulo na última faixa), `PERC_ACELERADOR`, `BONUS_FIXO_ADICIONAL`, vigência. Alimentada uma vez com a escada real (vem do negócio/da view atual) e depois só o gerente edita. Sem essa tabela, o simulador só consegue mostrar a próxima faixa (o que já existe), nunca a escada completa.
2. **Serviço novo** `premiacaoSimuladorService.js` com `simularCenario(empresaId, skVendedor, { grupoNome, valorVendaAdicional })`:
   - busca a margem média histórica do vendedor naquele grupo (`FATO_VENDAS_LUCRATIVIDADE` + `DIM_PRODUTOS`, mesma juntação de `listarGruposSemPercentual`) para converter "vender R$X" em "quanto isso soma de margem+frete";
   - aplica o % de premiação do grupo (`resolverPercentualVigentePorProduto`/`PARAM_PERCENTUAL_GRUPO_PREMIACAO`);
   - recalcula a faixa resultante na escada (tabela nova do item 1) e o valor final de premiação;
   - devolve também, sem simulação nenhuma, "quanto falta vender no grupo X, no seu ritmo de margem atual, para chegar no gatilho" e "para a próxima faixa" — um número em R$ de venda, não só em R$ de margem (conversão que a tela atual não faz).
3. **Endpoint novo** `GET /api/premiacao/minha-premiacao/simulador?grupo=...&valor=...` (e uma variante sem parâmetros que devolve os "contadores" prontos: falta até o gatilho, falta até a próxima faixa, em R$ de venda por grupo preferido do vendedor).
4. **Front:** novo bloco "Simulador" na página `Front/app/vendedor/minha-premiacao/page.tsx` (mesmo estilo visual dos cards já existentes: `CalcStep`, barra de progresso do gatilho): seletor de grupo de produto + input de valor, atualizando ao vivo "sua margem+frete subiria para R$ Y", "sua premiação final subiria para R$ Z", "faltariam R$ W para a próxima faixa". Os "contadores" prontos (item 3) aparecem sem interação, como hoje já acontece com `faltanteGatilho`/`faltanteProximaFaixa`.
5. Tela `Comissões` (`Front/app/comissoes/page.tsx`, visão do gerente) ganha uma aba "Faixas do acelerador" para cadastrar a escada da tabela nova do item 1, no mesmo padrão de UI da aba de percentual por grupo que já existe.

## Fase 2 — Alerta de projeção de meta

O pedido: "a projeção dela vai ficar 98 mil abaixo da meta, o que podemos fazer para ajudar ela?" — ou seja, o gerente (e a própria vendedora) precisa ver, antes do fim do mês, uma projeção de fechamento e não só o acumulado até hoje.

### O que já existe

`VW_RANKING_VENDEDORES` (consumida em `Back/src/routes/rankingVendedores.js`) já traz, por vendedor: `receita_mes`, `meta_mes`, `perc_atingimento`, e no modo diário (`VW_RANKING_VENDEDORES_DIA`) também `dias_restantes`, `meta_restante` e `meta_diaria_necessaria` (quanto precisa vender por dia até o fim do mês para bater a meta). **Não existe hoje uma projeção de fechamento** (algo como "no ritmo atual, você vai fechar o mês em X reais") — o sistema só mostra o que falta, nunca uma estimativa de onde o vendedor vai parar se nada mudar. `radar-vendas` e `alertas-ranking` (`Back/src/routes/radarVendas.js`, `alertasRanking.js`) já geram alertas (líder do dia, quem caiu de posição, categorias em queda/alta, clientes campeões esfriando) mas nenhum deles fala de projeção de fechamento vs. meta.

### O que construir

1. **Cálculo de projeção** (função nova, ex. `calcularProjecaoFechamento` em um `projecaoMetaService.js`): receita do mês dividida pelos dias úteis já passados e multiplicada pelos dias úteis totais do mês (usar dias úteis — `FATO_META_DIA.DIAS_PASSADOS`/`DIAS_RESTANTES`, que já são a base real usada em `meta_diaria_necessaria`, e não dias corridos, para não distorcer com fins de semana). O gap projetado é a meta do mês menos essa receita projetada. Essa é a decisão de metodologia mais importante da fase — ver seção final: run-rate simples (média diária) versus algo que pesa os últimos 7–14 dias (mais sensível a uma retação/aceleração recente).
2. **Endpoint**: estender `GET /api/ranking-vendedores` (ou criar `GET /api/vendedor/:sk_vendedor/projecao-meta`) para devolver a receita projetada, o gap projetado e um status de projeção (no caminho, em risco ou crítico, por faixa de gap — thresholds a definir com o Guilherme).
3. **Visão do gerente** (`Front/app/dashboard/page.tsx`): card/linha por vendedor mostrando a projeção e o gap, ordenado do maior risco pro menor — exatamente o caso do exemplo ("a projeção dela vai ficar 98 mil abaixo"). Reaproveita o padrão visual de alerta já usado em `radarVendas.js`/`alertasRanking.js`.
4. **Visão do vendedor** (`Front/app/vendedor/page.tsx`): o mesmo número, em primeira pessoa, com uma sugestão de ação — aqui a fase 2 já prepara o gancho pra fase 3: o gap projetado é exatamente o insumo que o Roadmap (fase 3) vai usar pra recomendar quanto vender de cada grupo e de cada cliente para cobrir esse gap.
5. **Alerta proativo**: novo tipo de alerta em `alertas-ranking` (ou card dedicado) quando o status de projeção piora de um dia para o outro — mesmo mecanismo de comparação hoje/ontem que `alertasRanking.js` já usa para posição no ranking.

## Fase 3 — Roadmap de maximização de prêmio

O pedido: cruzar orçamentos, RFV e histórico de vendas para montar um caminho ("feche esse orçamento", "esse cliente está esfriando", "esse grupo paga mais premiação") que ajude o vendedor a maximizar prêmio e margem.

### O que já existe (e vira o esqueleto desta fase)

`objetivoVendedorService.js` (módulo Minha Meta de Vida) já faz exatamente esse tipo de cruzamento, só que para o objetivo financeiro pessoal do vendedor, não para o prêmio/margem do mês:

- `loadChampionOpportunity`: cruza `FATO_RFV_VENDEDOR` (clientes classificados como campeão) com `VW_ORCAMENTOS_GESTAO_METAS` (orçamentos abertos) e aponta quais clientes campeões têm orçamento em aberto, com destaque para o de maior valor.
- `loadPreferredCategoryOpenQuotes`: cruza a categoria de produto preferida do vendedor com os orçamentos abertos naquela categoria.
- `buildSuggestions`/`buildRecommendations`: geram as frases finais (quanto falta, quais clientes campeões têm orçamento aberto) a partir desses cruzamentos, com link direto pra `/area-ataque`.

O kanban de carteira (`kanbanCardService.js`) já tem, por cliente/card, `classificacao_rfv`, `valor_orcamento` e `dias_desde_ultimo_sinal`, e já calcula uma prioridade (0–1) misturando valor do orçamento com recência (`calcularPrioridade`). É praticamente o ranking de "o que fechar primeiro" que o roadmap precisa — falta ligar isso ao impacto em prêmio/margem.

### O que construir

1. **Serviço novo** `roadmapPremiacaoService.js`, reaproveitando os cruzamentos acima mas com a lente de prêmio/margem em vez de meta pessoal:
   - parte do gap projetado (fase 2) e do simulador de faixas (fase 1) para saber quanto falta e em qual grupo isso pesa mais (maior percentual de premiação);
   - lista os cards do kanban de carteira (fase existente) em aberto (A\_CONTATAR, EM\_CONTATO, ORCAMENTO\_ENVIADO) ordenados por um score que combina a prioridade já calculada (`calcularPrioridade`) com o quanto aquele orçamento contribuiria pro gap e pra faixa de premiação (cruzando o grupo de produto do orçamento com `PARAM_PERCENTUAL_GRUPO_PREMIACAO`);
   - reaproveita `loadChampionOpportunity` para destacar clientes campeões esfriando (RFV) com orçamento parado;
   - devolve uma lista ordenada de ações concretas: feche o orçamento tal do cliente tal (campeão, parado há N dias), ou venda tanto do grupo tal — cobre o gap e ainda sobe de faixa.
2. **Endpoint novo** `GET /api/vendedor/:sk_vendedor/roadmap-premiacao`, protegido pelo mesmo padrão de escopo dos demais (`requireAuth`, validação de `sk_vendedor` contra o vendedor autenticado).
3. **Front:** nova seção "Seu caminho até a próxima premiação" em `Minha Premiação` (fase 1) e/ou em `Front/app/vendedor/page.tsx`, listando as ações acima como cards clicáveis — cada card linka direto pro card correspondente no kanban de carteira (`/vendedor/kanban`), fechando o ciclo: o roadmap aponta, o kanban executa.
4. **Visão do gerente**: mesmo roadmap, agregado por vendedor, na tela onde a fase 2 já vai mostrar a projeção (`dashboard/page.tsx`) — é a resposta direta a "o que podemos fazer para ajudar ela?": o gerente vê não só o gap, mas as 3–5 ações concretas que cobririam esse gap.

## Fase 4 — Kanban de atividades/metas/projetos

O pedido: um kanban novo — separado do kanban de carteira (clientes com orçamento em aberto) que já existe — para atividades, metas e projetos do vendedor rumo à meta.

### O que já existe (padrões a reaproveitar)

Duas peças já no projeto cobrem partes do que esse kanban precisa, mas nenhuma das duas serve pronta:

- **Kanban de carteira** (`CRM_KANBAN_CARD`, `CRM_KANBAN_INTERACAO`, `Front/components/kanban`): dá o padrão de UI (colunas, drag-and-drop, timeline de interações por card) mas o card é sempre um cliente (`SK_CLIENTE` obrigatório, `UNIQUE (SK_VENDEDOR, SK_CLIENTE)`) — não serve pra um card de tarefa/meta/projeto sem cliente.
- **Desafíos comerciais** (`DESAFIOS_COMERCIAIS`, `DESAFIOS_COMERCIAIS_METAS`, `DESAFIOS_COMERCIAIS_PROGRESSO`, `desafiosService.js`): dá o padrão de modelagem de meta + progresso + prêmio (tipo de meta, valor, unidade, percentual de conclusão, prêmio liberado) — mas é um sistema de campanhas criadas pelo gerente pra equipe toda, não cards que o próprio vendedor cria e move livremente.

### O que construir

1. **Tabelas novas** (mesmo padrão de `CRM_KANBAN_CARD`/`CRM_KANBAN_INTERACAO`: `NUMBER(18)` PK, `CHECK` para enums, sequence, índices, `COMMENT ON`):
   - `CRM_KANBAN_ATIVIDADE`: `ID`, `EMPRESA_ID`, `SK_VENDEDOR`, `TIPO` (`ATIVIDADE` | `META` | `PROJETO`), `TITULO`, `DESCRICAO`, `COLUNA_ATUAL` (ex.: `A_FAZER`, `EM_ANDAMENTO`, `CONCLUIDO`), `ORDEM`, `DATA_LIMITE`, `VALOR_META` (nulo se não for tipo META), `VINCULO_ROADMAP_ID` (nulo; quando preenchido, aponta pra uma ação gerada pelo roadmap da fase 3 — permite "enviar pro kanban de atividades" a partir de uma sugestão), datas de controle, `ARQUIVADO`.
   - `CRM_KANBAN_ATIVIDADE_INTERACAO`: mesmo papel de `CRM_KANBAN_INTERACAO` (timeline/comentários), reaproveitando a mesma tabela não é possível por causa da FK pra `CRM_KANBAN_CARD` — vira tabela irmã.
2. **Backend**: `kanbanAtividadeService.js`, `kanbanAtividadeController.js`, `routes/vendedorKanbanAtividade.js`, no mesmo formato de `kanbanCardService.js`/`vendedorKanbanController.js`/`vendedorKanban.js` (CRUD de card, mover coluna, arquivar, adicionar interação) — sem a parte de sincronização automática com Oracle que o kanban de carteira tem (`kanbanSyncService.js`), já que aqui os cards nascem manualmente ou vindos do roadmap (fase 3), não de uma view de orçamentos.
3. **Endpoints**: `GET/POST /api/vendedor/:sk_vendedor/kanban-atividades`, `PATCH .../cards/:cardId`, `POST .../cards/:cardId/interacoes`, `PATCH .../cards/:cardId/arquivar` — espelhando 1:1 as rotas de `vendedorKanban.js`.
4. **Front**: nova página `Front/app/vendedor/kanban-atividades/page.tsx` (ou uma aba dentro de `Front/app/vendedor/kanban/page.tsx`, alternando entre "Carteira" e "Atividades e metas"), reaproveitando o componente visual `KanbanCarteira` como base (extraído/generalizado para aceitar colunas e tipos de card configuráveis, já que hoje ele está específico pra cliente/orçamento).
5. **Ligação com as fases anteriores**: uma ação do roadmap (fase 3) ganha um botão "transformar em tarefa", que cria um `CRM_KANBAN_ATIVIDADE` do tipo META com `VINCULO_ROADMAP_ID` preenchido — assim o vendedor sai do "aqui está o que fazer" (roadmap) pro "isso está na minha lista, vou fazer" (kanban de atividades) sem reescrever nada.

## Decisões pendentes

Precisamos confirmar isto antes de começar a codar cada fase — são pontos que não dá pra resolver só lendo o código:

| # | Decisão | Por quê | Bloqueia |
| --- | --- | --- | --- |
| 1 | Qual é a escada completa de faixas do acelerador (limites e percentual de cada faixa, hoje só dentro da view `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP`)? | Sem isso o simulador só mostra a próxima faixa, nunca o cenário completo | Fase 1 (implementada) |
| 2 | Método de projeção: média diária simples (receita do mês / dias úteis passados) ou uma média com peso maior nos últimos 7–14 dias? | Muda o número mostrado ao gerente/vendedor — média simples é mais previsível, média ponderada reage mais rápido a uma aceleração ou queda recente | Fase 2 |
| 3 | Faixas de risco da projeção (a partir de qual percentual de gap o status vira "em risco" e "crítico")? | Define o visual (cores/alertas) na tela do gerente | Fase 2 |
| 4 | O roadmap (fase 3) deve olhar só orçamentos já no kanban de carteira, ou também orçamentos que ainda não entraram no kanban? | Afeta o alcance da query e se precisa reaproveitar a sincronização do `kanbanSyncService.js` | Fase 3 |
| 5 | O kanban de atividades (fase 4) é só do vendedor, ou o gerente também atribui tarefas pra um vendedor? | Se o gerente atribui, precisa de um campo de autoria diferente do dono do card e uma nova regra de permissão | Fase 4 |

Com a Decisão 1 resolvida e a Fase 1 já implementada no repositório, o próximo passo, seguindo a ordem combinada, é a Fase 2 — alerta de projeção de meta. As Decisões 2 e 3 (método de projeção e faixas de risco) seguem em aberto e precisam ser resolvidas antes ou junto com a implementação dessa fase.
