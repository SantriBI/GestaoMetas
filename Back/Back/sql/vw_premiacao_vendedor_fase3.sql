-- =============================================================================
-- FASE 3 DO MOTOR DE PREMIACAO - VW_PREMIACAO_VENDEDOR_COMISSAO_ERP
-- Executar como DM_VENDAS (mesmo schema usado pela API em runtime).
--
-- ATUALIZACAO 2026-10-01: a comissao passa a vir de VW_COMISSAO_ERP_MES_ATUAL
-- (vw_comissao_erp_mes_atual.sql, executar antes deste script), sobre a fato nova
-- FT_COMISSAO_PARAMETRIZADA_TESTE (devolucoes automaticas = 'N', igual a tela do ERP).
-- A fato antiga usava 'T' e descontava devolucoes a mais. O join com a apuracao passa a
-- usar o mes da propria comissao (com.MES_REFERENCIA, 'MM/YYYY') em vez de
-- TO_CHAR(SYSDATE, 'MM/YYYY'). Colunas de saida inalteradas. Rollback: voltar o FROM para
-- FT_COMISSAO_PARAMETRIZADA e o join para TO_CHAR(SYSDATE, 'MM/YYYY'). O cabecalho abaixo
-- descreve a fato antiga e fica como historico.
--
-- ATUALIZACAO 2026-10-01 (2): a formula da premiacao foi movida para
-- VW_PREMIACAO_VENDEDOR_MENSAL (vw_premiacao_vendedor_mensal.sql, executar antes deste
-- script). Esta view agora so filtra o mes corrente; colunas de saida inalteradas. Efeito
-- colateral: o join com a apuracao virou LEFT JOIN na mensal, entao vendedor sem apuracao
-- passa a aparecer (margem 0, NAO ELEGIVEL, premiacao 0) em vez de sumir.
-- Rollback: recriar com o SELECT anterior (FROM VW_COMISSAO_ERP_MES_ATUAL com JOIN
-- DIM_VENDEDOR + JOIN VW_APURACAO_PREMIACAO_VENDEDOR por VENDEDOR_ID e MES_REFERENCIA).
--
-- Muda a fonte da comissao base: em vez de calcular item a item por percentual
-- de grupo de produto (Fase 2 - VW_VALOR_BASE_PREMIACAO_VENDEDOR), usa a
-- comissao ja pronta que vem do ERP em FT_COMISSAO_PARAMETRIZADA.VALOR_COMISSAO_A_PAGAR
-- (valor final, ja com todos os ajustes do ERP: PREM_LUCRO, AJUSTE_VLR_MIN,
-- PLUS, FRETE, FINANCEIRO_VLR_RECEBIDO, FINANCEIRO_BASE_ESTORNO).
--
-- Fontes confirmadas antes de escrever esta view (nao supor nomes de coluna -
-- confirmado via SELECT direto/user_tab_columns em 2026-08-13, org SAO JORGE):
--   - FT_COMISSAO_PARAMETRIZADA: grao 1 linha por SK_VENDEDOR (confirmado:
--     59 linhas / 58 SK_VENDEDOR distintos - a linha extra e o sentinela
--     SK_VENDEDOR = -1, mesmo padrao ja usado em objetivoVendedorService.js).
--     Nao tem coluna de periodo/data - e sobrescrita pelo ERP e sempre reflete
--     o mes corrente (dia 1 até ontem). Colunas: SK_EMPRESAS, SK_VENDEDOR,
--     VENDAS_LIQUIDAS, COMISSAO_BASE, PREM_LUCRO, AJUSTE_VLR_MIN, PLUS, FRETE,
--     FINANCEIRO_VLR_RECEBIDO, FINANCEIRO_BASE_ESTORNO, VALOR_COMISSAO_A_PAGAR,
--     PERCENTUAL_COMISSAO.
--   - FT_COMISSAO_PARAMETRIZADA.SK_EMPRESAS e o MESMO dominio de DIM_EMPRESAS.SK_EMPRESAS
--     (confirmado via JOIN direto em 2026-08-13, org SAO JORGE: 100% das linhas com
--     SK_VENDEDOR <> -1 casaram 1:1 com DIM_EMPRESAS, sem NULL) - e o mesmo valor que
--     getScopedLojaScope/lojaAcessoService resolvem como skEmpresas, entao pode ser usado
--     direto no filtro de loja da tela de equipe do gerente, sem conversao via DIM_VENDEDOR
--     (DIM_VENDEDOR.EMPRESA_ID e um codigo de cadastro diferente, mesmo dominio de
--     FATO_FUNCIONARIOS_ACESSOS.EMPRESA_ACESSO - nao o de SK_EMPRESAS).
--   - DIM_VENDEDOR: tem SK_VENDEDOR e VENDEDOR_ID (DE-PARA), mesmo join usado
--     na Fase 2. SK_VENDEDOR e a chave exata da linha do ERP (mesmo com SCD -
--     um VENDEDOR_ID pode ter mais de um SK_VENDEDOR histórico, mas o join por
--     SK_VENDEDOR exato bate certo com a linha atual do ERP).
--   - VW_APURACAO_PREMIACAO_VENDEDOR: chaveia por VENDEDOR_ID + MES_REFERENCIA
--     (VARCHAR2 'MM/YYYY', ex. '08/2026'). Nao tem SK_VENDEDOR nem coluna de
--     "mes corrente" pronta - o filtro do mes corrente e feito aqui via
--     TO_CHAR(SYSDATE, 'MM/YYYY').
--   - Join testado em produção (SAO JORGE, 2026-08-13): 58/58 vendedores da
--     FT_COMISSAO_PARAMETRIZADA encontraram linha em VW_APURACAO_PREMIACAO_VENDEDOR
--     no mes corrente (0 sem match).
--
-- Limitacao conhecida (nao verificavel por coluna): FT_COMISSAO_PARAMETRIZADA
-- nao expõe nenhuma coluna de data/corte, entao nao ha como comparar o "ultimo
-- dia incluido" linha a linha contra VW_APURACAO_PREMIACAO_VENDEDOR. Ambas sao
-- descritas como regime de caixa (SK_DT_RECEBIMENTO) recalculadas diariamente
-- pelo ERP/DW, entao devem casar por construcao - mas isso nao foi confirmado
-- por coluna, so por relato/arquitetura.
-- =============================================================================

CREATE OR REPLACE VIEW VW_PREMIACAO_VENDEDOR_COMISSAO_ERP AS
SELECT
    m.SK_VENDEDOR,
    m.SK_EMPRESAS,
    m.VENDEDOR_ID,
    m.NOME_VENDEDOR,
    m.MES_REFERENCIA,
    m.VALOR_COMISSAO_A_PAGAR,
    m.MARGEM_MAIS_FRETE,
    m.STATUS_GATILHO,
    m.FAIXA_ACELERADOR,
    m.PERC_ACELERADOR,
    m.BONUS_FIXO_ADICIONAL,
    m.VALOR_PREMIACAO_FINAL
FROM VW_PREMIACAO_VENDEDOR_MENSAL m
WHERE m.MES_REFERENCIA = TO_CHAR(SYSDATE, 'MM/YYYY');

COMMENT ON TABLE VW_PREMIACAO_VENDEDOR_COMISSAO_ERP IS 'Premiacao final do vendedor no mes corrente: filtro de VW_PREMIACAO_VENDEDOR_MENSAL (comissao do ERP com devolucoes automaticas = N x acelerador da faixa de margem+frete, mais bonus fixo, zerado se NAO ELEGIVEL; sem apuracao = margem 0 / NAO ELEGIVEL). Exposta ao vendedor via GET /api/premiacao/minha-premiacao e a equipe do gerente via GET /api/premiacao/equipe. SK_EMPRESAS e o mesmo dominio de DIM_EMPRESAS.SK_EMPRESAS, usado para filtrar por loja no escopo do gerente.';
