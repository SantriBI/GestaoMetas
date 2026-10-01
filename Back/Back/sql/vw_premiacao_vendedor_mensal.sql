-- =============================================================================
-- VW_PREMIACAO_VENDEDOR_MENSAL
-- Executar como DM_VENDAS, depois de vw_comissao_erp_mes_atual.sql e antes de
-- vw_premiacao_vendedor_fase3.sql.
--
-- Premiacao por vendedor/mes (todos os meses): comissao do ERP (VW_COMISSAO_ERP_MENSAL,
-- devolucoes automaticas = N) x acelerador da faixa de margem+frete
-- (VW_APURACAO_PREMIACAO_VENDEDOR) + bonus fixo, zerada se NAO ELEGIVEL.
-- Unico lugar da formula da premiacao: VW_PREMIACAO_VENDEDOR_COMISSAO_ERP (mes atual) e
-- um filtro desta view, e o historico do gerente (?mes=MM/YYYY) le daqui.
--
-- Substitui FT_COMISSAO_HISTORICO (2026-10-01), que foi gravada pelo job antigo
-- (devolucoes automaticas descontadas e sem o ultimo dia do mes; ex.: Renata, SK 15280,
-- 09/2026: comissao 4.100,43 / premiacao 10.200,86 no historico x 4.402,11 / 10.804,22
-- corretos).
--
-- LEFT JOIN na apuracao: vendedor com comissao mas sem apuracao de margem no mes (ex.:
-- LUANA ROSMARI MEDINA, SK 15269, 09/2026, comissao -1,40) continua aparecendo, tratado
-- como margem 0 / NAO ELEGIVEL / faixa 'Até 20.000,00' / premiacao 0. O literal da faixa e
-- copiado do CASE de VW_APURACAO_PREMIACAO_VENDEDOR - extrairLimiteSuperiorFaixa
-- (premiacaoVendedorService.js) le esse texto por regex. Com isso o mes atual tambem passa
-- a mostrar vendedores sem apuracao (antes sumiam pelo INNER JOIN da fase 3).
-- MES_REFERENCIA vem de com (com LEFT JOIN, ap.MES_REFERENCIA pode vir nulo); toda
-- referencia com prefixo (sem prefixo -> ORA-00918).
--
-- Atencao: a comissao de meses fechados e protegida por CTRL_COMISSAO_FECHAMENTO_TESTE,
-- mas STATUS_GATILHO/FAIXA/PERC/BONUS sao recalculados ao vivo pela apuracao. Mudar a
-- escada (CASE de VW_APURACAO_PREMIACAO_VENDEDOR) ou a margem em FATO_VENDAS_LUCRATIVIDADE
-- altera a premiacao exibida dos meses passados.
-- =============================================================================

CREATE OR REPLACE VIEW DM_VENDAS.VW_PREMIACAO_VENDEDOR_MENSAL AS
SELECT
    com.SK_VENDEDOR,
    com.SK_EMPRESAS,
    dv.VENDEDOR_ID,
    dv.NOME_VENDEDOR,
    com.MES_REFERENCIA,
    com.VALOR_COMISSAO_A_PAGAR,
    NVL(ap.MARGEM_MAIS_FRETE, 0)                   AS MARGEM_MAIS_FRETE,
    NVL(ap.STATUS_GATILHO, 'NÃO ELEGÍVEL')         AS STATUS_GATILHO,
    NVL(ap.FAIXA_ACELERADOR, 'Até 20.000,00')      AS FAIXA_ACELERADOR,
    NVL(ap.PERC_ACELERADOR, 0)                     AS PERC_ACELERADOR,
    NVL(ap.BONUS_FIXO_ADICIONAL, 0)                AS BONUS_FIXO_ADICIONAL,
    CASE
        WHEN NVL(ap.STATUS_GATILHO, 'NÃO ELEGÍVEL') = 'NÃO ELEGÍVEL' THEN 0
        ELSE (com.VALOR_COMISSAO_A_PAGAR * ap.PERC_ACELERADOR) + NVL(ap.BONUS_FIXO_ADICIONAL, 0)
    END AS VALOR_PREMIACAO_FINAL
FROM DM_VENDAS.VW_COMISSAO_ERP_MENSAL com
JOIN DM_VENDAS.DIM_VENDEDOR dv
    ON dv.SK_VENDEDOR = com.SK_VENDEDOR
LEFT JOIN DM_VENDAS.VW_APURACAO_PREMIACAO_VENDEDOR ap
    ON ap.VENDEDOR_ID = dv.VENDEDOR_ID
   AND ap.MES_REFERENCIA = com.MES_REFERENCIA
WHERE com.SK_VENDEDOR <> -1;

COMMENT ON TABLE DM_VENDAS.VW_PREMIACAO_VENDEDOR_MENSAL IS 'Premiacao por vendedor/mes (todos os meses): comissao do ERP (VW_COMISSAO_ERP_MENSAL, devolucoes automaticas = N) x acelerador de margem+frete (VW_APURACAO_PREMIACAO_VENDEDOR, LEFT JOIN - sem apuracao = margem 0 / NAO ELEGIVEL) + bonus fixo, zerada se NAO ELEGIVEL. Fonte do historico do gerente (GET /api/premiacao/equipe?mes=) e base de VW_PREMIACAO_VENDEDOR_COMISSAO_ERP. Substitui FT_COMISSAO_HISTORICO.';
