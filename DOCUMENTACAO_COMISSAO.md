# Comissão / Premiação do Vendedor — Mapa de dependências

Documento de referência para **trocar tabelas/views** da comissão sem quebrar nada.
Lista tudo o que o projeto lê/escreve para montar comissão, premiação, gatilho, acelerador, histórico e simulador.

> Estado do código em 2026-10-01 (inclui o simulador/escada de faixas ainda não commitados e a troca da fonte da comissão para a fato nova `FT_COMISSAO_PARAMETRIZADA_TESTE` via `VW_COMISSAO_ERP_MES_ATUAL`).
> Schema Oracle: `DM_VENDAS` (todas as views/tabelas Oracle abaixo vivem lá).

---

## 1. Visão geral da regra

```
Premiação final = (Comissão base do ERP × % acelerador) + bônus fixo
                  → zerada se NÃO ELEGÍVEL (margem+frete <= R$ 20.000)
```

| Conceito | De onde vem |
|---|---|
| **Comissão base** | `VW_COMISSAO_ERP_MES_ATUAL.VALOR_COMISSAO_A_PAGAR` (pronta do ERP, sem devoluções automáticas; sobre `FT_COMISSAO_PARAMETRIZADA_TESTE`) |
| **Margem + frete** | `VW_APURACAO_PREMIACAO_VENDEDOR.MARGEM_MAIS_FRETE` = lucro presente + frete + outras despesas (de `FATO_VENDAS_LUCRATIVIDADE`) |
| **Gatilho (elegibilidade)** | `MARGEM_MAIS_FRETE > 20000` → `'ELEGÍVEL'` / `'NÃO ELEGÍVEL'` |
| **Faixa / % acelerador / bônus** | `CASE` fixo dentro de `VW_APURACAO_PREMIACAO_VENDEDOR` |
| **Premiação final (mês atual)** | `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP.VALOR_PREMIACAO_FINAL` |
| **Premiação final (meses passados)** | `VW_PREMIACAO_VENDEDOR_MENSAL` (fato nova + apuração, recalculada ao vivo) |

### Cadeia de dependências

```
FATO_VENDAS_LUCRATIVIDADE + DIM_VENDEDOR ──► VW_APURACAO_PREMIACAO_VENDEDOR (margem, gatilho, faixa, acel.) ──┐ (LEFT JOIN)
                                                                                                             │
FT_COMISSAO_PARAMETRIZADA_TESTE ──► VW_COMISSAO_ERP_MENSAL ──┬───────────────────────────────────────────────┴──► VW_PREMIACAO_VENDEDOR_MENSAL
                                                             │                                                     │  (todos os meses; fórmula da premiação)
                                                             │                                                     ├──► equipe do gerente ?mes=MM/YYYY
                                                             │                                                     └──► VW_PREMIACAO_VENDEDOR_COMISSAO_ERP (filtro do mês atual)
                                                             │                                                            └──► minha-premiacao, equipe (mês atual), simulador
                                                             ├──► seletor de meses do gerente (meses-disponiveis)
                                                             └──► VW_COMISSAO_ERP_MES_ATUAL ──► Meta de Vida (objetivoVendedorService)
```

`FT_COMISSAO_HISTORICO` **não é mais lida** por nenhuma rota (desde 2026-10-01).

---

## 2. Objetos Oracle

### 2.1 Tabelas de origem (ERP/DW — não são criadas por este projeto)

#### `FT_COMISSAO_PARAMETRIZADA_TESTE` — comissão pronta do ERP (fonte atual)
- Pipeline novo (Oracle + Pentaho, job diário) que chama `PROCESSAR_REGRA_COMISSAO` com devoluções automáticas = **`'N'`**, igual à tela do ERP. Lida pelo app **somente via `VW_COMISSAO_ERP_MENSAL` / `VW_COMISSAO_ERP_MES_ATUAL`** (seção 2.2).
- Período: `MES_REFERENCIA` (**DATE**, 1º dia do mês), `PERIODO_INICIAL`, `PERIODO_FINAL`. Guarda **todos os meses**: os fechados (dia 1 ao último dia) e o atual (dia 1 até ontem). **No dia 1º do mês não existe linha do mês atual.**
- Grão: 1 linha por `SK_VENDEDOR` + `MES_REFERENCIA` (confirmado em 2026-10-01: sem duplicidade por vendedor/mês nem vendedor em mais de uma loja no mesmo mês; sem `SK_VENDEDOR`/`SK_EMPRESAS` nulo nem `-1`). As views filtram `NULL` e `-1` por segurança.
- `SK_EMPRESAS` é o mesmo domínio de `DIM_EMPRESAS.SK_EMPRESAS` (usado no filtro de loja do gerente).
- `PERCENTUAL_COMISSAO` vem **sempre em escala de percentual** (`0,8127` = 0,8127%; em 2026-10-01: mín 0, máx ~1,46).

| Coluna | Usada em |
|---|---|
| `SK_VENDEDOR` | view fase 3, Meta de Vida |
| `SK_EMPRESAS` | view fase 3 (filtro de loja), Meta de Vida (join `DIM_EMPRESAS`) |
| `MES_REFERENCIA` | views de compatibilidade (filtro do mês e conversão para `'MM/YYYY'`); join da fase 3 com a apuração |
| `VALOR_COMISSAO_A_PAGAR` | **comissão base** (view fase 3) e Meta de Vida |
| `PERCENTUAL_COMISSAO` | Meta de Vida (taxa de comissão; sempre dividido por 100; 0/nulo → fallback 3%) |
| `VENDAS_LIQUIDAS` | Meta de Vida (`receita_ate_ontem`) |
| `PERIODO_INICIAL`, `PERIODO_FINAL`, `VLR_PEDIDOS`, `COMISSAO_BASE_VENDAS`, `COMISSAO_BASE`, `PREM_LUCRO`, `AJUSTE_VLR_MIN`, `PLUS`, `FRETE`, `ACRESC_DOMINGO_FERIADO`, `COMPL_VLR_MIN_DOMINGO_FERIADO`, `FINANCEIRO_VLR_RECEBIDO`, `FINANCEIRO_BASE_ESTORNO`, `DATA_CARGA` | expostas nas views, **não usadas** pela API (já embutidas no `VALOR_COMISSAO_A_PAGAR`) |

#### `FT_COMISSAO_PARAMETRIZADA` — fato antiga (não usada mais pela API)
- Usava devoluções automáticas = `'T'` e descontava devoluções a mais (ex.: Renata, SK 15280, até 29/09/2026: ERP 4.241,32 × fato antiga 4.100,43).
- 1 linha por `SK_VENDEDOR`, só o mês corrente, sem coluna de data, sentinela `-1`. Mantida só como referência de rollback.

#### `FT_COMISSAO_HISTORICO` — **não é mais lida** (pode ser apagada no futuro)
- Era o fechamento mensal usado no histórico do gerente. Foi gravada pelo job antigo: com devoluções automáticas descontadas e **sem o último dia de cada mês**. Ex.: Renata (SK 15280), 09/2026: comissão 4.100,43 / premiação 10.200,86 no histórico, contra 4.402,11 / 10.804,22 corretos.
- Desde 2026-10-01, o histórico lê `VW_PREMIACAO_VENDEDOR_MENSAL` e o seletor de meses lê `VW_COMISSAO_ERP_MENSAL`. A tabela não foi alterada nem apagada no banco.

#### `FATO_VENDAS_LUCRATIVIDADE` — itens vendidos (regime de caixa, D-1)
| Coluna | Uso |
|---|---|
| `SK_VENDEDOR` | chave do vendedor |
| `SK_PRODUTO` | join com `DIM_PRODUTOS` (simulador, cobertura de grupos, fase 2) |
| `SK_DT_RECEBIMENTO` (`YYYYMMDD` numérico) | data de referência / mês. Linhas com NULL são ignoradas |
| `TIPO` | `'DEV'` inverte o sinal |
| `VALOR_LUCRO_PRESENTE_ITEM` | margem de contribuição |
| `VALOR_FRETE_ITEM` | frete |
| `VALOR_OUTRAS_DESPESAS_ITEM` | outras despesas |
| `VALOR_LIQUIDO_ITEM` | receita (simulador, cobertura de grupos, fase 2) |

> ⚠️ Na view de apuração, `DEV` inverte **só** o lucro presente; frete e outras despesas entram sempre positivos. No simulador (`calcularRatioMargemPorGrupo`), `DEV` inverte os três. Se trocar a tabela, decidir qual regra vale.

#### Dimensões
| Objeto | Colunas | Para quê |
|---|---|---|
| `DIM_VENDEDOR` | `SK_VENDEDOR`, `VENDEDOR_ID`, `NOME_VENDEDOR` | DE-PARA `SK_VENDEDOR` ↔ `VENDEDOR_ID` (apuração chaveia por `VENDEDOR_ID`; comissão por `SK_VENDEDOR`) |
| `DIM_PRODUTOS` | `SK_PRODUTO`, `NOME_PAI_NIVEL1/2/3` | grupos de produto (percentual por grupo, simulador) |
| `DIM_EMPRESAS` | `SK_EMPRESAS` | domínio da loja (Meta de Vida faz LEFT JOIN) |
| `FATO_FUNCIONARIOS_ACESSOS` | CPF, `GERENTE`, `EMPRESA_ACESSO` | valida se o usuário é gerente e quais lojas ele vê (`verificarSeUsuarioEhGerente`, `getLojasAcessoByCpf`) |

### 2.2 Views criadas por este projeto

#### `VW_APURACAO_PREMIACAO_VENDEDOR` (versão vigente)
Arquivo: [Back/Back/sql/vw_apuracao_premiacao_vendedor_fix_gatilho_margem_mais_frete.sql](Back/Back/sql/vw_apuracao_premiacao_vendedor_fix_gatilho_margem_mais_frete.sql)

- Grão: `VENDEDOR_ID` + `MES_REFERENCIA` (`'MM/YYYY'`), **todos os meses** (não só o atual).
- Fonte: `FATO_VENDAS_LUCRATIVIDADE` + `DIM_VENDEDOR`.
- Saída: `VENDEDOR_ID, NOME_VENDEDOR, MES_REFERENCIA, MARGEM_TOTAL, FRETE_TOTAL, OUTRAS_DESPESAS_TOTAL, MARGEM_MAIS_FRETE, STATUS_GATILHO, FAIXA_ACELERADOR, PERC_ACELERADOR, BONUS_FIXO_ADICIONAL`.
- `MARGEM_TOTAL` é só informativo; **todo** gatilho/faixa usa `MARGEM_MAIS_FRETE`.

Escada hard-coded na view:

| Margem+frete (R$) | `FAIXA_ACELERADOR` | `PERC_ACELERADOR` | `BONUS_FIXO_ADICIONAL` |
|---|---|---|---|
| ≤ 20.000 | `Até 20.000,00` (NÃO ELEGÍVEL) | 0 | 0 |
| ≤ 30.000 | `20.000,01 até 30.000,00` | 0,50 | 0 |
| ≤ 40.000 | `30.000,01 até 40.000,00` | 1,00 | 0 |
| ≤ 50.000 | `40.000,01 até 50.000,00` | 1,50 | 0 |
| ≤ 60.000 | `50.000,01 até 60.000,00` | 2,00 | 0 |
| ≤ 70.000 | … | 2,00 | 500 |
| ≤ 80.000 | … | 2,00 | 1.000 |
| ≤ 90.000 | … | 2,00 | 1.500 |
| ≤ 100.000 | … | 2,00 | 2.000 |
| ≤ 110.000 | … | 2,00 | 2.500 |
| ≤ 120.000 | … | 2,00 | 3.500 |
| ≤ 130.000 | … | 2,00 | 4.000 |
| > 130.000 | `Acima de 130.000,00 (FORA DA TABELA)` | 2,00 | **NULL** |

> `PERC_ACELERADOR` é **multiplicador direto** (0,5 = 50%, 2 = 200%).

Versões anteriores (histórico, não executar): `vw_apuracao_premiacao_vendedor_outras_despesas.sql`, `vw_apuracao_premiacao_vendedor_margem_lucro_presente.sql`.

#### `VW_COMISSAO_ERP_MENSAL` / `VW_COMISSAO_ERP_MES_ATUAL` (compatibilidade da fato nova)
Arquivo: [Back/Back/sql/vw_comissao_erp_mes_atual.sql](Back/Back/sql/vw_comissao_erp_mes_atual.sql) — **executar primeiro**.

- `VW_COMISSAO_ERP_MENSAL`: todos os meses de `FT_COMISSAO_PARAMETRIZADA_TESTE`, sem `SK_VENDEDOR` nulo/`-1`. Expõe `MES_REFERENCIA` como texto `'MM/YYYY'` (mesmo formato da apuração) e a data original em `MES_REFERENCIA_DATA`. Base de `VW_PREMIACAO_VENDEDOR_MENSAL` e do seletor de meses do gerente (`listarMesesDisponiveis`).
- `VW_COMISSAO_ERP_MES_ATUAL`: a mensal filtrada por `MES_REFERENCIA_DATA = TRUNC(SYSDATE, 'MM')`, com colunas explícitas. Hoje é lida **só pela Meta de Vida**.
- Promoção para produção (tabela sem `_TESTE`): trocar **só o `FROM` da view mensal**.

#### `VW_PREMIACAO_VENDEDOR_MENSAL` (fórmula da premiação, todos os meses)
Arquivo: [Back/Back/sql/vw_premiacao_vendedor_mensal.sql](Back/Back/sql/vw_premiacao_vendedor_mensal.sql) — executar depois de `vw_comissao_erp_mes_atual.sql`.

```sql
SELECT com.SK_VENDEDOR, com.SK_EMPRESAS, dv.VENDEDOR_ID, dv.NOME_VENDEDOR,
       com.MES_REFERENCIA, com.VALOR_COMISSAO_A_PAGAR,
       NVL(ap.MARGEM_MAIS_FRETE, 0)              AS MARGEM_MAIS_FRETE,
       NVL(ap.STATUS_GATILHO, 'NÃO ELEGÍVEL')    AS STATUS_GATILHO,
       NVL(ap.FAIXA_ACELERADOR, 'Até 20.000,00') AS FAIXA_ACELERADOR,
       NVL(ap.PERC_ACELERADOR, 0)                AS PERC_ACELERADOR,
       NVL(ap.BONUS_FIXO_ADICIONAL, 0)           AS BONUS_FIXO_ADICIONAL,
       CASE WHEN NVL(ap.STATUS_GATILHO, 'NÃO ELEGÍVEL') = 'NÃO ELEGÍVEL' THEN 0
            ELSE (com.VALOR_COMISSAO_A_PAGAR * ap.PERC_ACELERADOR) + NVL(ap.BONUS_FIXO_ADICIONAL, 0)
       END AS VALOR_PREMIACAO_FINAL
FROM VW_COMISSAO_ERP_MENSAL com
JOIN DIM_VENDEDOR dv ON dv.SK_VENDEDOR = com.SK_VENDEDOR
LEFT JOIN VW_APURACAO_PREMIACAO_VENDEDOR ap
  ON ap.VENDEDOR_ID = dv.VENDEDOR_ID
 AND ap.MES_REFERENCIA = com.MES_REFERENCIA
WHERE com.SK_VENDEDOR <> -1
```
Saída: `SK_VENDEDOR, SK_EMPRESAS, VENDEDOR_ID, NOME_VENDEDOR, MES_REFERENCIA, VALOR_COMISSAO_A_PAGAR, MARGEM_MAIS_FRETE, STATUS_GATILHO, FAIXA_ACELERADOR, PERC_ACELERADOR, BONUS_FIXO_ADICIONAL, VALOR_PREMIACAO_FINAL`.

- **Único lugar da fórmula da premiação.** O mês atual (`VW_PREMIACAO_VENDEDOR_COMISSAO_ERP`) é um filtro desta view, e o histórico do gerente lê daqui.
- **LEFT JOIN na apuração:** um vendedor com comissão mas sem apuração no mês continua aparecendo, com margem 0, `'NÃO ELEGÍVEL'`, faixa `'Até 20.000,00'`, acelerador e bônus 0 e premiação 0. Caso real: LUANA ROSMARI MEDINA, SK 15269, 09/2026, comissão -1,40.
- O literal `'Até 20.000,00'` tem que ser **idêntico** ao da primeira faixa do `CASE` de `VW_APURACAO_PREMIACAO_VENDEDOR`, porque `extrairLimiteSuperiorFaixa` lê esse texto por regex. Um teste (`premiacaoVendedorEquipe.test.js`) compara os dois arquivos SQL.
- `MES_REFERENCIA` vem de `com.`, porque com o LEFT JOIN o `ap.MES_REFERENCIA` pode vir nulo. A coluna existe em `com` e em `ap`, então toda referência precisa de prefixo (sem prefixo dá ORA-00918).
- **Meses passados recalculados ao vivo:** a comissão de mês fechado é protegida pela `CTRL_COMISSAO_FECHAMENTO_TESTE` (pipeline da fato nova). Já o gatilho, a faixa, o acelerador, o bônus e a premiação vêm da apuração. **Mudar a escada (o `CASE` de `VW_APURACAO_PREMIACAO_VENDEDOR`) ou a margem em `FATO_VENDAS_LUCRATIVIDADE` altera a premiação exibida dos meses passados.**

#### `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP` (Fase 3 — mês atual)
Arquivo: [Back/Back/sql/vw_premiacao_vendedor_fase3.sql](Back/Back/sql/vw_premiacao_vendedor_fase3.sql) — executar depois de `vw_premiacao_vendedor_mensal.sql`.

```sql
SELECT m.SK_VENDEDOR, m.SK_EMPRESAS, ..., m.VALOR_PREMIACAO_FINAL   -- mesmas 12 colunas
FROM VW_PREMIACAO_VENDEDOR_MENSAL m
WHERE m.MES_REFERENCIA = TO_CHAR(SYSDATE, 'MM/YYYY')
```
Saída idêntica à da mensal; o contrato com o backend e o front não mudou.

- **Vendedores sem apuração agora aparecem no mês atual**, com margem 0 e não elegíveis. Antes eles sumiam, por causa do INNER JOIN que a fase 3 fazia com a apuração.
- Vendedor sem linha de comissão no mês continua sumindo (por isso o ranking não usa esta view). No dia 1º do mês a view fica vazia.
- Rollback: recriar com `FROM VW_COMISSAO_ERP_MES_ATUAL com JOIN DIM_VENDEDOR JOIN VW_APURACAO_PREMIACAO_VENDEDOR` (versão anterior do arquivo, no git). Para voltar à fato antiga, use `FROM FT_COMISSAO_PARAMETRIZADA` e o join com `TO_CHAR(SYSDATE, 'MM/YYYY')`.

#### Fase 2 — `VW_VALOR_BASE_PREMIACAO_VENDEDOR` / `VW_PREMIACAO_VENDEDOR_FINAL` (legado)
Arquivo: [Back/Back/sql/vw_premiacao_vendedor_fase2.sql](Back/Back/sql/vw_premiacao_vendedor_fase2.sql)
- Calculava a comissão base item a item com `PARAM_PERCENTUAL_GRUPO_PREMIACAO`. **Nenhuma rota lê essas views hoje** — foram substituídas pela Fase 3. A mesma lógica de resolução por nível (3 > 2 > 1) foi copiada em `listarGruposSemPercentual`.

### 2.3 Tabelas de parâmetro (criadas por este projeto)

DDL em [Back/sql/ddl_gestao_metas.sql](Back/sql/ddl_gestao_metas.sql). Ambas usam **vigência** (nunca UPDATE na linha vigente: fecha `DT_FIM_VIGENCIA = hoje-1` e insere nova).

| Tabela | Conteúdo | Quem usa |
|---|---|---|
| `PARAM_PERCENTUAL_GRUPO_PREMIACAO` (`NIVEL, NOME_GRUPO, PERCENTUAL, DT_INICIO_VIGENCIA, DT_FIM_VIGENCIA, CRIADO_POR_USUARIO_ID`) | % de premiação por grupo de produto | Tela Comissões (cadastro), relatório de cobertura, simulador. **Não entra no cálculo oficial da Fase 3.** |
| `PARAM_FAIXA_ACELERADOR_PREMIACAO` (`LIMITE_INFERIOR, LIMITE_SUPERIOR, PERC_ACELERADOR, BONUS_FIXO_ADICIONAL, vigência…`) — script [Back/sql/param_faixa_acelerador_premiacao.sql](Back/sql/param_faixa_acelerador_premiacao.sql) | Escada do acelerador consultável | **Só o simulador** e a aba de faixas da tela Comissões. A apuração oficial continua usando o `CASE` da view. |

> ⚠️ A escada existe **duplicada**: `CASE` em `VW_APURACAO_PREMIACAO_VENDEDOR` e linhas em `PARAM_FAIXA_ACELERADOR_PREMIACAO`. Editar uma não altera a outra. Diferença atual: acima de 130 mil a view devolve bônus `NULL` (vira 0 via `NVL`), a tabela devolve 4.000.

---

## 3. Backend (Node/Express)

### 3.1 Endpoints

| Rota | Feature | Service | Lê |
|---|---|---|---|
| `GET /api/premiacao/minha-premiacao` | PREMIACAO | `buscarMinhaPremiacao` | `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP` (por `SK_VENDEDOR` do token) |
| `GET /api/premiacao/equipe` (sem `mes`) | PREMIACAO + gerente | `listarPremiacaoEquipe` | `VW_PREMIACAO_VENDEDOR_COMISSAO_ERP` filtrada por `SK_EMPRESAS` |
| `GET /api/premiacao/equipe?mes=MM/YYYY` | PREMIACAO + gerente | `listarPremiacaoEquipe` | `VW_PREMIACAO_VENDEDOR_MENSAL` filtrada por `SK_EMPRESAS` e `MES_REFERENCIA` |
| `GET /api/premiacao/meses-disponiveis` | PREMIACAO + gerente | `listarMesesDisponiveis` | `DISTINCT MES_REFERENCIA` de `VW_COMISSAO_ERP_MENSAL` (exclui o mês do `SYSDATE`) |
| `GET /api/premiacao/minha-premiacao/simulador` | PREMIACAO | `simularCenario` | view fase 3 + `FATO_VENDAS_LUCRATIVIDADE`/`DIM_PRODUTOS` (6 meses) + `PARAM_PERCENTUAL_GRUPO_PREMIACAO` + `PARAM_FAIXA_ACELERADOR_PREMIACAO` |
| `GET /api/premiacao/minha-premiacao/simulador/grupos` | PREMIACAO | `listarGruposHistoricosVendedor` | `FATO_VENDAS_LUCRATIVIDADE` + `DIM_PRODUTOS` |
| `GET /api/premiacao/minha-premiacao/contadores` | PREMIACAO | `calcularContadoresVenda` | view fase 3 + ratio de margem do grupo preferido |
| `GET/POST /api/premiacao/faixas-acelerador` | COMISSOES (+ gerente no POST) | `listar/salvarFaixasAcelerador` | `PARAM_FAIXA_ACELERADOR_PREMIACAO` |
| `GET /api/parametros-premiacao/grupos?nivel=` | COMISSOES | `listarGruposComPercentualVigente` | `DIM_PRODUTOS` + `PARAM_PERCENTUAL_GRUPO_PREMIACAO` |
| `POST /api/parametros-premiacao/grupos/:nivel/:nomeGrupo` | COMISSOES + gerente | `salvarPercentualGrupo` | grava `PARAM_PERCENTUAL_GRUPO_PREMIACAO` |
| `GET /api/parametros-premiacao/grupos-sem-percentual?mes=YYYY-MM` | COMISSOES | `listarGruposSemPercentual` | `FATO_VENDAS_LUCRATIVIDADE` + `DIM_PRODUTOS` + `PARAM_PERCENTUAL_GRUPO_PREMIACAO` |

Arquivos:
- Rotas: [Back/src/routes/premiacaoVendedor.js](Back/src/routes/premiacaoVendedor.js), [Back/src/routes/parametrosPremiacao.js](Back/src/routes/parametrosPremiacao.js)
- Controllers: [premiacaoVendedorController.js](Back/src/controllers/premiacaoVendedorController.js), [premiacaoSimuladorController.js](Back/src/controllers/premiacaoSimuladorController.js), [parametrosPremiacaoController.js](Back/src/controllers/parametrosPremiacaoController.js)
- Services: [premiacaoVendedorService.js](Back/src/services/premiacaoVendedorService.js), [premiacaoSimuladorService.js](Back/src/services/premiacaoSimuladorService.js), [parametrosPremiacaoService.js](Back/src/services/parametrosPremiacaoService.js)

### 3.2 Outros lugares que leem comissão/margem

| Onde | O quê |
|---|---|
| [objetivoVendedorService.js:523](Back/src/services/objetivoVendedorService.js#L523) (`loadCommissionSnapshotFromOracle`) | **Meta de Vida**: lê `VW_COMISSAO_ERP_MES_ATUAL` (`VENDAS_LIQUIDAS`, `PERCENTUAL_COMISSAO`, `VALOR_COMISSAO_A_PAGAR`) + `DIM_VENDEDOR` + `DIM_EMPRESAS`. Sem linha (inclusive no dia 1º do mês) → comissão 0, taxa padrão 3% (`DEFAULT_COMMISSION_RATE`), origem `"indisponivel"`. Usa o valor **bruto do ERP** (não zera por gatilho, não aplica acelerador). `PERCENTUAL_COMISSAO` é sempre dividido por 100 em `normalizeCommissionRate` (teste: `objetivoVendedorCommissionRate.test.js`). **A query não filtra mês e usa `FETCH FIRST 1 ROWS ONLY`**: ela depende de a view entregar só o mês corrente. Se apontar para `VW_COMISSAO_ERP_MENSAL` ou direto para a fato, que têm vários meses, vai pegar um mês arbitrário. |
| [rankingVendedores.js:426](Back/src/routes/rankingVendedores.js#L426) | Ranking: LEFT JOIN `VW_APURACAO_PREMIACAO_VENDEDOR` (mês do SYSDATE) para a coluna `margem`, só se `featurePremiacaoHabilitada`. |
| [vendedor.js:181](Back/src/routes/vendedor.js#L181) | Dashboard do vendedor: `MARGEM_MAIS_FRETE` de `VW_APURACAO_PREMIACAO_VENDEDOR`, só se `featurePremiacaoHabilitada`. |
| [atualizacaoBase.js](Back/src/routes/atualizacaoBase.js) | Data de referência da margem/comissão via `FATO_VENDAS_LUCRATIVIDADE` (D-1). |

### 3.3 Regras/constantes que estão no código (não no banco)

| Regra | Onde |
|---|---|
| Gatilho `20000` | `GATILHO_MINIMO_MARGEM` em `premiacaoVendedorService.js` **e** `premiacaoSimuladorService.js`, além da view |
| Comparação do gatilho: view usa `> 20000`; simulador usa `>= 20000` | inconsistência pequena (exatamente R$ 20.000) |
| Elegibilidade = `STATUS_GATILHO !== 'NÃO ELEGÍVEL'` (string com acento, comparada em maiúsculo) | `mapPremiacaoRow`; também ordenação SQL `CASE WHEN STATUS_GATILHO = 'NÃO ELEGÍVEL'` |
| Comissão base exibida = 0 se não elegível | `mapPremiacaoRow` (`valorComissaoBase`) |
| "Falta para a próxima faixa" lida **por regex do texto** `FAIXA_ACELERADOR` (`"... até 30.000,00"`) | `extrairLimiteSuperiorFaixa` — se mudar o formato do texto, quebra |
| Limiar "próximo do gatilho" = R$ 5.000 | `LIMIAR_PROXIMO_DO_GATILHO` |
| Janela do simulador = 6 meses | `MESES_JANELA_MARGEM_MEDIA` |
| Equipe só mostra vendedores com login ativo (`usuarios_auth` MySQL: `ativo='S'`, `role='VENDEDOR'`) | `aplicarRegrasNegocioEquipe` → `getAllowedSellerCodesByEmpresaId` |
| Filtro de loja do gerente por `SK_EMPRESAS` (resolvido no servidor) | `getScopedLojaScope` + `buildLojaInCondition` |
| Nomes de bind ≤ 30 bytes (Oracle client 12.1) | prefixos curtos `prem_hist_loja`, `prem_meses_loja`, `pfa{n}` |
| Formato do mês: `'MM/YYYY'` no Oracle; `YYYY-MM` só na entrada de `grupos-sem-percentual` | `normalizeMesReferencia` / `validarMesReferencia` |

### 3.4 Feature flags e permissão
- MySQL central, `organizacoes_auth.FEATURE_COMISSOES_HABILITADA` e `FEATURE_PREMIACAO_HABILITADA` ([featureFlagsService.js](Back/src/services/featureFlagsService.js), criadas em [mysql-tenants.js:225](Back/src/db/mysql-tenants.js#L225)).
- `requireFeature("COMISSOES" | "PREMIACAO")` em [requireFeature.js](Back/src/middleware/requireFeature.js).
- Gerente: `verificarSeUsuarioEhGerente` → `FATO_FUNCIONARIOS_ACESSOS.GERENTE='S'`, ou role `GERENTE` no app com CPF existente em `FATO_FUNCIONARIOS_ACESSOS`.

---

## 4. Front (Next.js)

| Tela / componente | Client lib | Endpoints |
|---|---|---|
| [Front/app/vendedor/minha-premiacao/page.tsx](Front/app/vendedor/minha-premiacao/page.tsx) — premiação do vendedor + simulador | `lib/premiacao-vendedor.ts`, `lib/premiacao-simulador.ts` | minha-premiacao, simulador, simulador/grupos, contadores |
| [Front/app/vendedor/page.tsx](Front/app/vendedor/page.tsx) — card de premiação no painel | `lib/premiacao-vendedor.ts` | minha-premiacao |
| [Front/app/dashboard/page.tsx](Front/app/dashboard/page.tsx) + [components/dashboard/premiacao-equipe.tsx](Front/components/dashboard/premiacao-equipe.tsx) — equipe do gerente, seletor de mês | `lib/premiacao-vendedor.ts` | equipe, meses-disponiveis |
| [Front/app/comissoes/page.tsx](Front/app/comissoes/page.tsx) — cadastro % por grupo + escada de faixas | `lib/parametros-premiacao.ts`, `lib/premiacao-simulador.ts` | parametros-premiacao/*, faixas-acelerador |
| Meta de Vida ([minha-meta-de-vida](Front/app/vendedor/minha-meta-de-vida/page.tsx), `LifeGoalWizard`) | `lib/life-goal.ts` | `/api/objetivo-vendedor/*` (comissão do ERP via `objetivoVendedorService`) |

O front só consome o JSON montado pelo backend (`valorComissaoBase`, `margemMaisFrete`, `statusGatilho`, `elegivel`, `faixaAcelerador`, `percAcelerador`, `bonusFixoAdicional`, `valorPremiacaoFinal`, `faltanteGatilho`, `faltanteProximaFaixa`). **Trocar tabela não exige mudar o front** desde que esse contrato se mantenha.

---

## 5. Checklist para trocar tabelas

1. **Nova fonte da comissão base**: trocar só o `FROM` de `VW_COMISSAO_ERP_MENSAL`, mantendo as colunas (sobretudo `SK_VENDEDOR`, `SK_EMPRESAS` no domínio de `DIM_EMPRESAS`, `VALOR_COMISSAO_A_PAGAR`, `PERCENTUAL_COMISSAO` em escala de %, `MES_REFERENCIA` DATE). Premiação (mês atual e histórico), seletor de meses e Meta de Vida derivam dela e não precisam mudar. Garantir que a nova fonte continue com 1 linha por vendedor/mês: a premiação duplicaria o vendedor e a Meta de Vida pegaria uma linha arbitrária (`FETCH FIRST 1`).
2. **Nova fonte de margem** (substituir `FATO_VENDAS_LUCRATIVIDADE`):
   - `VW_APURACAO_PREMIACAO_VENDEDOR` (oficial).
   - Queries inline no simulador (`calcularRatioMargemPorGrupo`, `listarGruposHistoricosVendedor`) e em `listarGruposSemPercentual` — não usam a view.
   - `atualizacaoBase.js` (data D-1).
3. **Histórico**: vem de `VW_PREMIACAO_VENDEDOR_MENSAL` (`buscarLinhasBrutasHistorico`) e de `VW_COMISSAO_ERP_MENSAL` (`listarMesesDisponiveis`). Mudar a fonte da comissão já muda o histórico. Manter `MES_REFERENCIA` `'MM/YYYY'` e `SK_EMPRESAS`.
4. **Mudar a fórmula da premiação**: só em `VW_PREMIACAO_VENDEDOR_MENSAL`, porque o mês atual é um filtro dela. O simulador (`simularCenario`) replica a fórmula em JS e precisa acompanhar.
5. **Mudar escada/gatilho**: alterar o `CASE` da view **e** `PARAM_FAIXA_ACELERADOR_PREMIACAO` **e** as constantes `GATILHO_MINIMO_MARGEM` (2 arquivos). Manter o formato de texto `"X até Y,ZZ"` em `FAIXA_ACELERADOR` ou trocar `extrairLimiteSuperiorFaixa`.
6. Manter os valores literais `'ELEGÍVEL'` / `'NÃO ELEGÍVEL'` (com acento) ou atualizar `mapPremiacaoRow` e os `ORDER BY`.
7. Manter as chaves de join: comissão por `SK_VENDEDOR`; apuração por `VENDEDOR_ID` (DE-PARA via `DIM_VENDEDOR`).
8. Rodar os testes:
   - `Back/src/services/__tests__/premiacaoVendedorFinalFormula.test.js`
   - `Back/src/services/__tests__/premiacaoVendedorEquipe.test.js`
   - `Back/src/services/__tests__/premiacaoSimuladorService.test.js`
   - `Back/src/services/__tests__/parametrosPremiacao*.test.js`
   - `Back/src/controllers/__tests__/premiacaoVendedorController.test.js`, `parametrosPremiacaoController.test.js`
   - `Back/src/middleware/__tests__/requireFeature.test.js`
   - `Back/src/services/__tests__/objetivoVendedorCommissionRate.test.js`

---

## 6. Pontos de atenção conhecidos

- **Meta de Vida × `FETCH FIRST 1`:** `loadCommissionSnapshotFromOracle` não filtra mês. A correção depende de `VW_COMISSAO_ERP_MES_ATUAL` filtrar o mês corrente. Não apontar essa query para a view mensal nem para a fato.
- **Dia 1º do mês:** a fato nova não tem linha do mês atual. A premiação fica vazia, como já ficava com a apuração D-1, e a Meta de Vida mostra comissão "indisponível". Ainda falta decidir se o front deve mostrar o mês anterior fechado nesse dia.
- **Histórico recalculado ao vivo:** desde 2026-10-01 a premiação dos meses passados vem da fato nova + apuração (`VW_PREMIACAO_VENDEDOR_MENSAL`), não mais de `FT_COMISSAO_HISTORICO`, que não é lida e pode ser apagada no futuro. A comissão do mês fechado é protegida pela `CTRL_COMISSAO_FECHAMENTO_TESTE`, mas mudar a escada ou a margem altera a premiação exibida dos meses passados.
- **Vendedor sem apuração** aparece com margem 0 e não elegível, tanto no histórico quanto no **mês atual**. No mês atual isso é novo: antes o vendedor sumia por causa do INNER JOIN da fase 3.
- **Complemento de domingo/feriado** é somado duas vezes no `VALOR_COMISSAO_A_PAGAR`, na fato antiga e na nova. A correção fica pendente e seria feita no Pentaho, não no app.
- `VW_COMISSAO_ERP_MENSAL` também traz o mês corrente, por isso `listarMesesDisponiveis` usa `<> TO_CHAR(SYSDATE,'MM/YYYY')`. Sem isso, o mês atual apareceria duplicado no seletor.
- Fachi: `sk_vendedor` já reverteu sozinho no cadastro de usuário (dashboard mostrando menos que o ERP) — conferir o vínculo `usuarios_auth.sk_vendedor` ao validar números.
- Os scripts das views ficam em `Back/Back/sql/` (pasta aninhada), separados do DDL principal em `Back/sql/`.
