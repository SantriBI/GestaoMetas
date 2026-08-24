-- =============================================================================
-- AJUSTE EM VW_APURACAO_PREMIACAO_VENDEDOR - INCLUI VALOR_OUTRAS_DESPESAS_ITEM
-- NO CALCULO DE MARGEM_MAIS_FRETE
-- Executar como DM_VENDAS (mesmo schema onde a view ja existe hoje - owner
-- confirmado via ALL_VIEWS em 2026-08-17, org SAO JORGE).
--
-- Contexto: VW_APURACAO_PREMIACAO_VENDEDOR e uma view pre-existente (nao criada
-- por este projeto - ver Back/Back/sql/vw_premiacao_vendedor_fase2.sql, que ja a
-- consome como "existente"). DDL original obtido via DBMS_METADATA.GET_DDL em
-- 2026-08-17 (org SAO JORGE) antes desta alteracao, para nao supor a formula
-- de negocio de memoria.
--
-- Pedido do usuario: FATO_VENDAS_LUCRATIVIDADE tem VALOR_OUTRAS_DESPESAS_ITEM
-- (grao item, mesmo grao ja usado pela view para VALOR_FRETE_ITEM - existe
-- tambem VALOR_OUTRAS_DESPESAS em grao capa/pedido, descartada de proposito
-- pois somaria duplicado quando um pedido tem mais de um item) - deve entrar
-- no calculo de MARGEM_MAIS_FRETE, com o MESMO tratamento que o frete ja tem
-- hoje (somado, sem inversao de sinal para TIPO = 'DEV').
--
-- Unica mudanca de formula: nova coluna OUTRAS_DESPESAS_TOTAL (somada por
-- vendedor/mes, mesmo padrao de MARGEM_TOTAL/FRETE_TOTAL) e
-- MARGEM_MAIS_FRETE = MARGEM_TOTAL + FRETE_TOTAL + OUTRAS_DESPESAS_TOTAL
-- (antes: MARGEM_TOTAL + FRETE_TOTAL). STATUS_GATILHO continua baseado so em
-- MARGEM_TOTAL (nao mudou - fora do escopo do pedido). FAIXA_ACELERADOR,
-- PERC_ACELERADOR e BONUS_FIXO_ADICIONAL continuam com os mesmos breakpoints,
-- apenas recebendo o MARGEM_MAIS_FRETE já com outras despesas somadas.
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

        -- RECEITA_COM_DEV_NEGATIVO
        CASE WHEN f.TIPO = 'DEV'
             THEN NVL(f.VALOR_LIQUIDO_ITEM, 0) * -1
             ELSE NVL(f.VALOR_LIQUIDO_ITEM, 0)
        END AS RECEITA_COM_DEV_NEGATIVO,

        -- CUSTO_COM_DEV_NEGATIVO
        CASE WHEN f.TIPO = 'DEV'
             THEN NVL(f.TOTAL_CUSTO_PRATICADO_ITEM, 0) * -1
             ELSE NVL(f.TOTAL_CUSTO_PRATICADO_ITEM, 0)
        END AS CUSTO_COM_DEV_NEGATIVO,

        -- BASE_PRESENTE_LUCRO_COM_DEV_NEGATIVO
        CASE WHEN f.TIPO = 'DEV'
             THEN NVL(f.BASE_LUCRO_PRESENTE_ITEM, 0) * -1
             ELSE NVL(f.BASE_LUCRO_PRESENTE_ITEM, 0)
        END AS BASE_PRESENTE_LUCRO_COM_DEV_NEGATIVO,

        NVL(f.PERC_CUSTO_FIXO_CUSTO_VENDA, 0) AS PERC_CUSTO_FIXO_CUSTO_VENDA,

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
        (
            BASE_PRESENTE_LUCRO_COM_DEV_NEGATIVO
            - CUSTO_COM_DEV_NEGATIVO
            + (RECEITA_COM_DEV_NEGATIVO * (PERC_CUSTO_FIXO_CUSTO_VENDA / 100))
        ) AS MARGEM_DE_CONTRIBUICAO,
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

    CASE WHEN t.MARGEM_TOTAL > 20000 THEN 'ELEGÍVEL' ELSE 'NÃO ELEGÍVEL' END AS STATUS_GATILHO,

    CASE
        WHEN t.MARGEM_TOTAL <= 20000        THEN 'Até 20.000,00'
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
        WHEN t.MARGEM_TOTAL <= 20000        THEN 0
        WHEN t.MARGEM_MAIS_FRETE <= 30000   THEN 0.50
        WHEN t.MARGEM_MAIS_FRETE <= 40000   THEN 1.00
        WHEN t.MARGEM_MAIS_FRETE <= 50000   THEN 1.50
        ELSE 2.00
    END AS PERC_ACELERADOR,

    CASE
        WHEN t.MARGEM_TOTAL <= 20000        THEN 0
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
