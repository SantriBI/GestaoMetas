-- =============================================================================
-- FASE 2 DO MOTOR DE PREMIACAO - VW_VALOR_BASE_PREMIACAO_VENDEDOR e
-- VW_PREMIACAO_VENDEDOR_FINAL
-- Executar como DM_VENDAS (mesmo schema usado pela API em runtime), depois de
-- PARAM_PERCENTUAL_GRUPO_PREMIACAO ja existir (ver ddl_gestao_metas.sql).
--
-- Fontes confirmadas antes de escrever este script (nao supor nomes de coluna):
--   - Receita por item + inversao de DEV: DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE
--     (SK_VENDEDOR, SK_PRODUTO, TIPO, VALOR_LIQUIDO_ITEM, SK_DT_RECEBIMENTO),
--     mesma tabela e mesma logica ja usadas em varios modulos do sistema
--     (ex.: objetivoVendedorService.js, areaAtaque.js, assistenteVendas.js).
--   - Hierarquia de produto: DM_VENDAS.DIM_PRODUTOS.NOME_PAI_NIVEL1/2/3
--     (confirmado via SELECT direto - NAO e NOME_NIVEL1/2/3 como a Fase 1
--     assumiu por engano; ja corrigido em parametrosPremiacaoService.js).
--   - Vendedor: FATO_VENDAS_LUCRATIVIDADE traz SK_VENDEDOR, mas
--     VW_APURACAO_PREMIACAO_VENDEDOR (existente, grao mensal de margem/frete/
--     gatilho/acelerador) chaveia por VENDEDOR_ID - por isso o DE-PARA via
--     DM_VENDAS.DIM_VENDEDOR (SK_VENDEDOR -> VENDEDOR_ID) e necessario aqui.
--   - MES_REFERENCIA em VW_APURACAO_PREMIACAO_VENDEDOR e VARCHAR2 no formato
--     'MM/YYYY' (confirmado via SELECT: ex. '05/2026') - as duas views usam
--     esse mesmo formato para o join funcionar sem conversao implicita de tipo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. VW_VALOR_BASE_PREMIACAO_VENDEDOR
-- Grao: VENDEDOR_ID + MES_REFERENCIA (regime de caixa, via SK_DT_RECEBIMENTO -
-- mesma base de data usada pela apuracao de margem, para os dois calculos
-- ficarem no mesmo periodo).
--
-- Resolucao do percentual por item, por precedencia de nivel (3 > 2 > 1),
-- vigente na DATA_RECEBIMENTO daquele item especifico - via COALESCE de 3
-- LEFT JOINs (nao via funcao PL/SQL por linha, por performance). Se nenhum
-- nivel tiver regra cadastrada, PERCENTUAL_RESOLVIDO = 0 e a receita do item
-- entra em RECEITA_SEM_PERCENTUAL_CADASTRADO (ver relatorio de cobertura no
-- backend - GET /api/parametros-premiacao/grupos-sem-percentual).
--
-- Observacao de integridade: assume-se que, para uma (NIVEL, NOME_GRUPO) e uma
-- data, no maximo uma linha de PARAM_PERCENTUAL_GRUPO_PREMIACAO esta vigente -
-- invariante ja garantido por salvarPercentualGrupo (fecha a vigencia anterior
-- antes de inserir a nova, na mesma transacao). Se essa invariante for violada
-- por edicao manual direta na tabela, o LEFT JOIN retorna mais de uma linha e
-- infla a soma - nao ha protecao extra aqui de proposito, para manter a view
-- em JOINs simples (sem window function) e rapida.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW VW_VALOR_BASE_PREMIACAO_VENDEDOR AS
WITH itens AS (
    SELECT
        f.SK_VENDEDOR,
        v.VENDEDOR_ID,
        TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD')                              AS DATA_RECEBIMENTO,
        TO_CHAR(TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD'), 'MM/YYYY')          AS MES_REFERENCIA,
        CASE
            WHEN f.TIPO = 'DEV' THEN NVL(f.VALOR_LIQUIDO_ITEM, 0) * -1
            ELSE NVL(f.VALOR_LIQUIDO_ITEM, 0)
        END                                                                            AS RECEITA_COM_DEV_NEGATIVO,
        p.NOME_PAI_NIVEL1,
        p.NOME_PAI_NIVEL2,
        p.NOME_PAI_NIVEL3
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    JOIN DM_VENDAS.DIM_VENDEDOR v
        ON v.SK_VENDEDOR = f.SK_VENDEDOR
    JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.SK_PRODUTO = f.SK_PRODUTO
    WHERE f.SK_DT_RECEBIMENTO IS NOT NULL
),
itens_com_percentual AS (
    SELECT
        i.VENDEDOR_ID,
        i.MES_REFERENCIA,
        i.RECEITA_COM_DEV_NEGATIVO,
        COALESCE(pn3.PERCENTUAL, pn2.PERCENTUAL, pn1.PERCENTUAL, 0) AS PERCENTUAL_RESOLVIDO
    FROM itens i
    LEFT JOIN PARAM_PERCENTUAL_GRUPO_PREMIACAO pn3
        ON pn3.NIVEL = 3
       AND pn3.NOME_GRUPO = i.NOME_PAI_NIVEL3
       AND pn3.DT_INICIO_VIGENCIA <= i.DATA_RECEBIMENTO
       AND (pn3.DT_FIM_VIGENCIA IS NULL OR pn3.DT_FIM_VIGENCIA >= i.DATA_RECEBIMENTO)
    LEFT JOIN PARAM_PERCENTUAL_GRUPO_PREMIACAO pn2
        ON pn2.NIVEL = 2
       AND pn2.NOME_GRUPO = i.NOME_PAI_NIVEL2
       AND pn2.DT_INICIO_VIGENCIA <= i.DATA_RECEBIMENTO
       AND (pn2.DT_FIM_VIGENCIA IS NULL OR pn2.DT_FIM_VIGENCIA >= i.DATA_RECEBIMENTO)
    LEFT JOIN PARAM_PERCENTUAL_GRUPO_PREMIACAO pn1
        ON pn1.NIVEL = 1
       AND pn1.NOME_GRUPO = i.NOME_PAI_NIVEL1
       AND pn1.DT_INICIO_VIGENCIA <= i.DATA_RECEBIMENTO
       AND (pn1.DT_FIM_VIGENCIA IS NULL OR pn1.DT_FIM_VIGENCIA >= i.DATA_RECEBIMENTO)
)
SELECT
    VENDEDOR_ID,
    MES_REFERENCIA,
    SUM(RECEITA_COM_DEV_NEGATIVO * (PERCENTUAL_RESOLVIDO / 100))                          AS VALOR_BASE_PREMIACAO,
    SUM(CASE WHEN PERCENTUAL_RESOLVIDO = 0 THEN RECEITA_COM_DEV_NEGATIVO ELSE 0 END)       AS RECEITA_SEM_PERCENTUAL_CADASTRADO
FROM itens_com_percentual
GROUP BY VENDEDOR_ID, MES_REFERENCIA;

COMMENT ON TABLE VW_VALOR_BASE_PREMIACAO_VENDEDOR IS 'Valor base de premiacao por vendedor/mes, calculado item a item com o percentual vigente do grupo de produto (NIVEL 3 > 2 > 1).';


-- -----------------------------------------------------------------------------
-- 2. VW_PREMIACAO_VENDEDOR_FINAL
-- Junta a apuracao de margem/gatilho/acelerador (ja existente) com o valor
-- base de premiacao (view acima), pelo grao VENDEDOR_ID + MES_REFERENCIA.
--
-- PERC_ACELERADOR e usado como veio de VW_APURACAO_PREMIACAO_VENDEDOR, sem
-- normalizacao adicional (a formula do negocio ja multiplica direto, ex.:
-- 50% de acelerador = fator 0.50) - conferir contra dado real antes de expor
-- ao usuario final na Fase 3.
--
-- Nao exposta ainda ao vendedor/gerente na tela (isso e Fase 3).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW VW_PREMIACAO_VENDEDOR_FINAL AS
SELECT
    a.VENDEDOR_ID,
    a.NOME_VENDEDOR,
    a.MES_REFERENCIA,
    a.MARGEM_TOTAL,
    a.FRETE_TOTAL,
    a.MARGEM_MAIS_FRETE,
    a.STATUS_GATILHO,
    a.FAIXA_ACELERADOR,
    a.PERC_ACELERADOR,
    a.BONUS_FIXO_ADICIONAL,
    NVL(b.VALOR_BASE_PREMIACAO, 0)                AS VALOR_BASE_PREMIACAO,
    NVL(b.RECEITA_SEM_PERCENTUAL_CADASTRADO, 0)    AS RECEITA_SEM_PERCENTUAL_CADASTRADO,
    CASE
        WHEN a.STATUS_GATILHO = 'NÃO ELEGÍVEL' THEN 0
        ELSE (NVL(b.VALOR_BASE_PREMIACAO, 0) * a.PERC_ACELERADOR) + NVL(a.BONUS_FIXO_ADICIONAL, 0)
    END                                            AS VALOR_PREMIACAO_FINAL
FROM VW_APURACAO_PREMIACAO_VENDEDOR a
LEFT JOIN VW_VALOR_BASE_PREMIACAO_VENDEDOR b
    ON b.VENDEDOR_ID = a.VENDEDOR_ID
   AND b.MES_REFERENCIA = a.MES_REFERENCIA;

COMMENT ON TABLE VW_PREMIACAO_VENDEDOR_FINAL IS 'Valor final de premiacao por vendedor/mes: valor base (grupo de produto) x acelerador de margem+frete, mais bonus fixo, zerado se NAO ELEGIVEL. Motor de calculo apenas - ainda nao exposta na tela (Fase 3).';
