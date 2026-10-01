-- =============================================================================
-- VW_COMISSAO_ERP_MENSAL / VW_COMISSAO_ERP_MES_ATUAL
-- Executar como DM_VENDAS.
--
-- View de compatibilidade sobre a fato nova de comissao (FT_COMISSAO_PARAMETRIZADA_TESTE),
-- que chama PROCESSAR_REGRA_COMISSAO com devolucoes automaticas = 'N' (igual a tela do ERP).
-- A fato antiga (FT_COMISSAO_PARAMETRIZADA) usava 'T' e descontava devolucoes a mais
-- (ex.: Renata, SK 15280, ate 29/09/2026: ERP 4.241,32 x fato antiga 4.100,43).
--
-- Fato nova: grao SK_VENDEDOR + MES_REFERENCIA (DATE, 1o dia do mes), guarda meses fechados
-- e o mes atual (dia 1 ate ontem; no dia 1o nao ha linha do mes atual). Confirmado em
-- 2026-10-01: sem duplicidade por vendedor/mes nem por loja, sem SK nulo ou -1 (74 linhas).
--
-- MES_REFERENCIA e exposto como 'MM/YYYY' (mesmo formato de VW_APURACAO_PREMIACAO_VENDEDOR);
-- a data original fica em MES_REFERENCIA_DATA.
-- Quando o pipeline for para producao (tabela sem _TESTE), trocar so o FROM da view mensal.
-- =============================================================================

CREATE OR REPLACE VIEW DM_VENDAS.VW_COMISSAO_ERP_MENSAL AS
SELECT
    f.SK_VENDEDOR,
    f.SK_EMPRESAS,
    f.MES_REFERENCIA                         AS MES_REFERENCIA_DATA,
    TO_CHAR(f.MES_REFERENCIA, 'MM/YYYY')     AS MES_REFERENCIA,
    f.PERIODO_INICIAL,
    f.PERIODO_FINAL,
    f.VLR_PEDIDOS,
    f.VENDAS_LIQUIDAS,
    f.COMISSAO_BASE_VENDAS,
    f.COMISSAO_BASE,
    f.PREM_LUCRO,
    f.AJUSTE_VLR_MIN,
    f.PLUS,
    f.FRETE,
    f.ACRESC_DOMINGO_FERIADO,
    f.COMPL_VLR_MIN_DOMINGO_FERIADO,
    f.FINANCEIRO_VLR_RECEBIDO,
    f.FINANCEIRO_BASE_ESTORNO,
    f.VALOR_COMISSAO_A_PAGAR,
    f.PERCENTUAL_COMISSAO,
    f.DATA_CARGA
FROM DM_VENDAS.FT_COMISSAO_PARAMETRIZADA_TESTE f
WHERE f.SK_VENDEDOR IS NOT NULL
  AND f.SK_VENDEDOR <> -1;

COMMENT ON TABLE DM_VENDAS.VW_COMISSAO_ERP_MENSAL IS 'Comissao do ERP por vendedor/mes (todos os meses), com devolucoes automaticas = N. Base de VW_PREMIACAO_VENDEDOR_MENSAL e do seletor de meses do gerente (GET /api/premiacao/meses-disponiveis).';

CREATE OR REPLACE VIEW DM_VENDAS.VW_COMISSAO_ERP_MES_ATUAL AS
SELECT
    m.SK_VENDEDOR,
    m.SK_EMPRESAS,
    m.MES_REFERENCIA_DATA,
    m.MES_REFERENCIA,
    m.PERIODO_INICIAL,
    m.PERIODO_FINAL,
    m.VLR_PEDIDOS,
    m.VENDAS_LIQUIDAS,
    m.COMISSAO_BASE_VENDAS,
    m.COMISSAO_BASE,
    m.PREM_LUCRO,
    m.AJUSTE_VLR_MIN,
    m.PLUS,
    m.FRETE,
    m.ACRESC_DOMINGO_FERIADO,
    m.COMPL_VLR_MIN_DOMINGO_FERIADO,
    m.FINANCEIRO_VLR_RECEBIDO,
    m.FINANCEIRO_BASE_ESTORNO,
    m.VALOR_COMISSAO_A_PAGAR,
    m.PERCENTUAL_COMISSAO,
    m.DATA_CARGA
FROM DM_VENDAS.VW_COMISSAO_ERP_MENSAL m
WHERE m.MES_REFERENCIA_DATA = TRUNC(SYSDATE, 'MM');

COMMENT ON TABLE DM_VENDAS.VW_COMISSAO_ERP_MES_ATUAL IS 'Comissao do ERP do mes corrente (dia 1 ate ontem), devolucoes automaticas = N. Substitui FT_COMISSAO_PARAMETRIZADA em VW_PREMIACAO_VENDEDOR_COMISSAO_ERP e na Meta de Vida.';
