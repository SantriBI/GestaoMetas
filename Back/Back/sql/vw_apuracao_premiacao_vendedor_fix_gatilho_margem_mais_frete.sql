-- =============================================================================
-- FIX EM VW_APURACAO_PREMIACAO_VENDEDOR - GATILHO E FAIXA/ACELERADOR PASSAM A
-- USAR MARGEM_MAIS_FRETE (E NAO MARGEM_TOTAL) DE FORMA CONSISTENTE
-- Executar como DM_VENDAS (mesmo schema onde a view ja existe hoje).
--
-- Bug encontrado (2026-08-19, achado pelo usuario comparando VITOR GABRIEL
-- TOMACHESKI x RENATA PEREIRA BOEIRA na tela de premiacao):
--   - STATUS_GATILHO e a PRIMEIRA condicao dos CASE de FAIXA_ACELERADOR,
--     PERC_ACELERADOR e BONUS_FIXO_ADICIONAL comparavam t.MARGEM_TOTAL contra
--     20000, enquanto todas as demais condicoes desses mesmos CASE comparavam
--     t.MARGEM_MAIS_FRETE (margem + frete + outras despesas). Isso misturava
--     dois criterios diferentes dentro do mesmo CASE.
--   - Exemplo real que expos o bug: VITOR GABRIEL TOMACHESKI tinha
--     MARGEM_TOTAL = 19.063,67 (<= 20000) mas MARGEM_MAIS_FRETE = 21.574,64
--     (> 20000) - caiu como NAO ELEGIVEL / 'Ate 20.000,00' / 0% mesmo com o
--     valor exibido na tela (MARGEM_MAIS_FRETE) acima do gatilho de R$20.000.
--   - RENATA PEREIRA BOEIRA e o contraexemplo que confirma a regra correta:
--     MARGEM_TOTAL = 53.176,29 mas MARGEM_MAIS_FRETE = 62.345,28 - ficou
--     corretamente na faixa '60.000,01 até 70.000,00' porque a partir da
--     segunda condicao do CASE ja se usava MARGEM_MAIS_FRETE.
--
-- Decisao do usuario (2026-08-19): o gatilho e o acelerador devem sempre
-- considerar a margem ja somada com frete e outras despesas
-- (MARGEM_MAIS_FRETE), nunca MARGEM_TOTAL isolado. MARGEM_TOTAL continua
-- exposto na view so como informacao (nao usado em nenhum CASE de
-- elegibilidade/faixa/acelerador/bonus a partir deste fix).
--
-- Unica mudanca de formula: toda comparacao contra 20000 nos CASE de
-- STATUS_GATILHO, FAIXA_ACELERADOR, PERC_ACELERADOR e BONUS_FIXO_ADICIONAL
-- passa a usar t.MARGEM_MAIS_FRETE em vez de t.MARGEM_TOTAL. Colunas de
-- saida, nomes, grao (VENDEDOR_ID + MES_REFERENCIA) e demais breakpoints
-- (30000/40000/.../130000) NAO mudam.
-- =============================================================================

CREATE OR REPLACE FORCE EDITIONABLE VIEW "DM_VENDAS"."VW_APURACAO_PREMIACAO_VENDEDOR" (
    "VENDEDOR_ID", "NOME_VENDEDOR", "MES_REFERENCIA", "MARGEM_TOTAL", "FRETE_TOTAL",
    "OUTRAS_DESPESAS_TOTAL", "MARGEM_MAIS_FRETE", "STATUS_GATILHO", "FAIXA_ACELERADOR",
    "PERC_ACELERADOR", "BONUS_FIXO_ADICIONAL"
) AS
WITH base_ajustada AS (
    SELECT
        f.SK_VENDEDOR,
        TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD') AS DATA_RECEBIMENTO,

        -- LUCRO_PRESENTE_COM_DEV_NEGATIVO
        CASE WHEN f.TIPO = 'DEV'
             THEN NVL(f.VALOR_LUCRO_PRESENTE_ITEM, 0) * -1
             ELSE NVL(f.VALOR_LUCRO_PRESENTE_ITEM, 0)
        END AS LUCRO_PRESENTE_COM_DEV_NEGATIVO,

        NVL(f.VALOR_FRETE_ITEM, 0) AS VALOR_FRETE_ITEM,
        NVL(f.VALOR_OUTRAS_DESPESAS_ITEM, 0) AS VALOR_OUTRAS_DESPESAS_ITEM
    FROM FATO_VENDAS_LUCRATIVIDADE f
    WHERE f.SK_DT_RECEBIMENTO IS NOT NULL
),
margem_por_linha AS (
    SELECT
        SK_VENDEDOR,
        DATA_RECEBIMENTO,
        TRUNC(DATA_RECEBIMENTO, 'MM') AS MES_REFERENCIA,   -- usado só pra agrupar a apuração mensal
        LUCRO_PRESENTE_COM_DEV_NEGATIVO AS MARGEM_DE_CONTRIBUICAO,
        VALOR_FRETE_ITEM,
        VALOR_OUTRAS_DESPESAS_ITEM
    FROM base_ajustada
),
totais_por_vendedor AS (
    SELECT
        SK_VENDEDOR,
        MES_REFERENCIA,
        ROUND(SUM(MARGEM_DE_CONTRIBUICAO), 2)                                                          AS MARGEM_TOTAL,
        ROUND(SUM(VALOR_FRETE_ITEM), 2)                                                                AS FRETE_TOTAL,
        ROUND(SUM(VALOR_OUTRAS_DESPESAS_ITEM), 2)                                                      AS OUTRAS_DESPESAS_TOTAL,
        ROUND(SUM(MARGEM_DE_CONTRIBUICAO) + SUM(VALOR_FRETE_ITEM) + SUM(VALOR_OUTRAS_DESPESAS_ITEM), 2) AS MARGEM_MAIS_FRETE
    FROM margem_por_linha
    GROUP BY SK_VENDEDOR, MES_REFERENCIA
)
SELECT
    dv.vendedor_id,
    dv.NOME_VENDEDOR,
    TO_CHAR(t.MES_REFERENCIA, 'MM/YYYY') AS MES_REFERENCIA,
    t.MARGEM_TOTAL,
    t.FRETE_TOTAL,
    t.OUTRAS_DESPESAS_TOTAL,
    t.MARGEM_MAIS_FRETE,

    CASE WHEN t.MARGEM_MAIS_FRETE > 20000 THEN 'ELEGÍVEL' ELSE 'NÃO ELEGÍVEL' END AS STATUS_GATILHO,

    CASE
        WHEN t.MARGEM_MAIS_FRETE <= 20000   THEN 'Até 20.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 30000   THEN '20.000,01 até 30.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 40000   THEN '30.000,01 até 40.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 50000   THEN '40.000,01 até 50.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 60000   THEN '50.000,01 até 60.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 70000   THEN '60.000,01 até 70.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 80000   THEN '70.000,01 até 80.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 90000   THEN '80.000,01 até 90.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 100000  THEN '90.000,01 até 100.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 110000  THEN '100.000,01 até 110.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 120000  THEN '110.000,01 até 120.000,00'
        WHEN t.MARGEM_MAIS_FRETE <= 130000  THEN '120.000,01 até 130.000,00'
        ELSE 'Acima de 130.000,00 (FORA DA TABELA)'
    END AS FAIXA_ACELERADOR,

    CASE
        WHEN t.MARGEM_MAIS_FRETE <= 20000   THEN 0
        WHEN t.MARGEM_MAIS_FRETE <= 30000   THEN 0.50
        WHEN t.MARGEM_MAIS_FRETE <= 40000   THEN 1.00
        WHEN t.MARGEM_MAIS_FRETE <= 50000   THEN 1.50
        ELSE 2.00
    END AS PERC_ACELERADOR,

    CASE
        WHEN t.MARGEM_MAIS_FRETE <= 20000   THEN 0
        WHEN t.MARGEM_MAIS_FRETE <= 60000   THEN 0
        WHEN t.MARGEM_MAIS_FRETE <= 70000   THEN 500
        WHEN t.MARGEM_MAIS_FRETE <= 80000   THEN 1000
        WHEN t.MARGEM_MAIS_FRETE <= 90000   THEN 1500
        WHEN t.MARGEM_MAIS_FRETE <= 100000  THEN 2000
        WHEN t.MARGEM_MAIS_FRETE <= 110000  THEN 2500
        WHEN t.MARGEM_MAIS_FRETE <= 120000  THEN 3500
        WHEN t.MARGEM_MAIS_FRETE <= 130000  THEN 4000
        ELSE NULL
    END AS BONUS_FIXO_ADICIONAL

FROM totais_por_vendedor t
JOIN DIM_VENDEDOR dv ON dv.SK_VENDEDOR = t.SK_VENDEDOR
ORDER BY t.MES_REFERENCIA, dv.NOME_VENDEDOR;
