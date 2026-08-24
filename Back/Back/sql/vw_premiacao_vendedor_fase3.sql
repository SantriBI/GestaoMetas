-- =============================================================================
-- FASE 3 DO MOTOR DE PREMIACAO - VW_PREMIACAO_VENDEDOR_COMISSAO_ERP
-- Executar como DM_VENDAS (mesmo schema usado pela API em runtime).
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
    com.SK_VENDEDOR,
    com.SK_EMPRESAS,
    dv.VENDEDOR_ID,
    dv.NOME_VENDEDOR,
    ap.MES_REFERENCIA,
    com.VALOR_COMISSAO_A_PAGAR,
    ap.MARGEM_MAIS_FRETE,
    ap.STATUS_GATILHO,
    ap.FAIXA_ACELERADOR,
    ap.PERC_ACELERADOR,
    ap.BONUS_FIXO_ADICIONAL,
    CASE
        WHEN ap.STATUS_GATILHO = 'NÃO ELEGÍVEL' THEN 0
        ELSE (com.VALOR_COMISSAO_A_PAGAR * ap.PERC_ACELERADOR) + NVL(ap.BONUS_FIXO_ADICIONAL, 0)
    END AS VALOR_PREMIACAO_FINAL
FROM FT_COMISSAO_PARAMETRIZADA com
JOIN DIM_VENDEDOR dv
    ON dv.SK_VENDEDOR = com.SK_VENDEDOR
JOIN VW_APURACAO_PREMIACAO_VENDEDOR ap
    ON ap.VENDEDOR_ID = dv.VENDEDOR_ID
   AND ap.MES_REFERENCIA = TO_CHAR(SYSDATE, 'MM/YYYY')
WHERE com.SK_VENDEDOR <> -1;

COMMENT ON TABLE VW_PREMIACAO_VENDEDOR_COMISSAO_ERP IS 'Premiacao final do vendedor no mes corrente: comissao pronta do ERP (FT_COMISSAO_PARAMETRIZADA.VALOR_COMISSAO_A_PAGAR) x acelerador da faixa de margem+frete (VW_APURACAO_PREMIACAO_VENDEDOR), mais bonus fixo, zerado se NAO ELEGIVEL (margem+frete < R$20.000). Fase 3 do motor de premiacao - exposta ao vendedor via GET /api/premiacao/minha-premiacao e a equipe do gerente via GET /api/premiacao/equipe. SK_EMPRESAS (de FT_COMISSAO_PARAMETRIZADA) e o mesmo dominio de DIM_EMPRESAS.SK_EMPRESAS, usado para filtrar por loja no escopo do gerente.';
