import express from "express"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { requireAuth } from "../middleware/auth.js"
import { getScopedEmpresaId } from "../services/requestScope.js"
import {
  buildSellerInCondition,
  getAllowedSellerCodesByEmpresaId,
} from "../services/tenantSellerScope.js"

const router = express.Router()

function normalizeRow(row) {
  const lower = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    ...row,
    ...lower,
    nome: lower.nome_vendedor ?? null,
    receita: lower.receita_mes ?? lower.receita_dia ?? 0,
    meta: lower.meta_mes ?? lower.meta_diaria_necessaria ?? 0,
    percentual: lower.perc_atingimento ?? lower.perc_performance_dia ?? 0,
    posicao: lower.ranking_atingimento ?? lower.ranking_dia ?? null
  }
}

async function getQueryContext(empresaId) {
  return {
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
    rankingView: "VW_RANKING_VENDEDORES",
    rankingDayView: "VW_RANKING_VENDEDORES_DIA",
  }
}

// Replica a CTE "mes_referencia" da VW_RANKING_VENDEDORES (mes atual se ja tiver
// meta cadastrada, senao cai pro ultimo mes com meta) e so entao subtrai 1 mes
// com ADD_MONTHS. Nunca calcula o mes anterior direto a partir de SYSDATE.
export function buildMensalAnteriorSql(sellerScope) {
  return `
    SELECT * FROM (
      WITH mes_referencia AS (
          SELECT
              NVL(
                  MAX(CASE WHEN TO_CHAR(dti.DATA,'YYYYMM') = TO_CHAR(SYSDATE,'YYYYMM')
                           THEN TO_CHAR(dti.DATA,'YYYYMM') END),
                  MAX(TO_CHAR(dti.DATA,'YYYYMM'))
              ) AS yyyymm_ref
          FROM fato_meta meta
          JOIN dim_data dti ON dti.DATANUM = meta.SK_DATA
      ),
      mes_anterior AS (
          SELECT TO_CHAR(ADD_MONTHS(TO_DATE(yyyymm_ref, 'YYYYMM'), -1), 'YYYYMM') AS yyyymm_ref
          FROM mes_referencia
      ),
      base_meta AS (
          SELECT
              meta.SK_EMPRESA        AS sk_empresa,
              vendedor.SK_VENDEDOR   AS sk_vendedor,
              vendedor.VENDEDOR_ID   AS vendedor_id,
              vendedor.NOME_VENDEDOR AS nome_vendedor,
              SUM(meta.VL_META)      AS meta_mes
          FROM fato_meta meta
          LEFT JOIN dim_vendedor vendedor ON vendedor.SK_VENDEDOR = meta.SK_VENDEDOR
          LEFT JOIN dim_data dti          ON dti.DATANUM = meta.SK_DATA
          WHERE meta.SK_VENDEDOR <> -1
            AND TO_CHAR(dti.DATA,'YYYYMM') = (SELECT yyyymm_ref FROM mes_anterior)
          GROUP BY meta.SK_EMPRESA, vendedor.SK_VENDEDOR, vendedor.VENDEDOR_ID, vendedor.NOME_VENDEDOR
      ),
      base_vendas AS (
          SELECT
              cockpit.SK_EMPRESA   AS sk_empresa,
              vendedor.SK_VENDEDOR AS sk_vendedor,
              SUM(CASE WHEN tipo_orcamento.TIPO_SINTETICO = 'DEV'
                       THEN cockpit.VALOR_LIQUIDO_ITEM * -1
                       ELSE cockpit.VALOR_LIQUIDO_ITEM END) AS receita_mes,
              COUNT(DISTINCT cockpit.SK_CLIENTE)            AS clientes_mes
          FROM fato_cockpit cockpit
          LEFT JOIN dim_vendedor       vendedor       ON vendedor.SK_VENDEDOR           = cockpit.SK_VENDEDOR
          LEFT JOIN dim_data           dti            ON dti.DATANUM                    = cockpit.SK_DATA
          LEFT JOIN dim_tipo_orcamento tipo_orcamento ON tipo_orcamento.SK_TIPO_ORCAMENTO = cockpit.SK_TIPO_ORCAMENTO
          WHERE cockpit.SK_VENDEDOR <> -1
            AND TO_CHAR(dti.DATA,'YYYYMM') = (SELECT yyyymm_ref FROM mes_anterior)
          GROUP BY cockpit.SK_EMPRESA, vendedor.SK_VENDEDOR
      ),
      funcionario_dados AS (
          SELECT funcionario_id, MAX(CPF_CNPJ_SEM_PONTOS) AS CPF_CNPJ_SEM_PONTOS
          FROM fato_funcionarios_acessos
          GROUP BY funcionario_id
      )
      SELECT
          m.sk_empresa      AS SK_EMPRESA,
          m.sk_vendedor     AS SK_VENDEDOR,
          REGEXP_SUBSTR(
              TRIM(SUBSTR(m.nome_vendedor, 1, INSTR(m.nome_vendedor || '(','(') - 1)),
              '^\\S+'
          ) || ' ' ||
          REGEXP_SUBSTR(
              TRIM(SUBSTR(m.nome_vendedor, 1, INSTR(m.nome_vendedor || '(','(') - 1)),
              '\\S+$'
          )                                   AS NOME_VENDEDOR,
          TRUNC(NVL(v.receita_mes, 0), 2)      AS RECEITA_MES,
          TRUNC(m.meta_mes, 2)                 AS META_MES,
          NVL(v.clientes_mes, 0)               AS CLIENTES_MES,
          TRUNC(CASE WHEN m.meta_mes > 0
                     THEN NVL(v.receita_mes, 0) / m.meta_mes
                     ELSE 0 END, 2)            AS PERC_ATINGIMENTO,
          RANK() OVER (
              PARTITION BY m.sk_empresa
              ORDER BY CASE WHEN m.meta_mes > 0
                            THEN NVL(v.receita_mes,0) / m.meta_mes
                            ELSE 0 END DESC
          )                                    AS RANKING_ATINGIMENTO,
          0                                    AS META_HERDADA,
          m.vendedor_id                        AS VENDEDOR_ID,
          f.funcionario_id                     AS FUNCIONARIO_ID,
          f.CPF_CNPJ_SEM_PONTOS                AS CPF_CNPJ_SEM_PONTOS
      FROM base_meta m
      LEFT JOIN base_vendas     v ON v.sk_empresa  = m.sk_empresa  AND v.sk_vendedor = m.sk_vendedor
      LEFT JOIN funcionario_dados f ON f.funcionario_id = m.vendedor_id
    )
    WHERE ${sellerScope.clause}
    ORDER BY ranking_atingimento
  `
}

// Espelha a VW_RANKING_VENDEDORES_DIA (que ja usa GREATEST(MAX(data)) como
// referencia real, nunca SYSDATE) e so entao volta 1 dia a partir dessa
// referencia real para achar o "dia anterior".
export function buildDiarioAnteriorSql(sellerScope) {
  return `
    SELECT * FROM (
      WITH params AS (
          SELECT GREATEST(
              (SELECT MAX(dti.DATA) FROM FATO_COCKPIT fc  JOIN DIM_DATA dti ON dti.DATANUM = fc.SK_DATA),
              (SELECT MAX(dti.DATA) FROM FATO_META_DIA fmd JOIN DIM_DATA dti ON dti.DATANUM = fmd.SK_DATA)
          ) AS data_ref
          FROM dual
      ),
      params_anterior AS (
          SELECT (data_ref - 1) AS data_ref
          FROM params
      ),
      cal AS (
          SELECT p.data_ref,
                 TRUNC(p.data_ref, 'MM')       AS ini_mes_ref,
                 TO_CHAR(p.data_ref, 'YYYYMM') AS yyyymm_ref
          FROM params_anterior p
      ),
      base_dia AS (
          SELECT meta.SK_EMPRESA, meta.SK_VENDEDOR, vendedor.VENDEDOR_ID AS vendedor_id,
                 MAX(meta.DIAS_RESTANTES)  AS dias_restantes,
                 MAX(meta.VALOR_META_DIA)  AS valor_meta_dia
          FROM FATO_META_DIA meta
          JOIN DIM_DATA dti ON dti.DATANUM = meta.SK_DATA
          LEFT JOIN DIM_VENDEDOR vendedor ON vendedor.SK_VENDEDOR = meta.SK_VENDEDOR
          CROSS JOIN cal c
          WHERE meta.SK_VENDEDOR <> -1
            AND dti.DATA = (
                  SELECT MAX(d2.DATA)
                  FROM FATO_META_DIA m2
                  JOIN DIM_DATA d2 ON d2.DATANUM = m2.SK_DATA
                  WHERE m2.SK_EMPRESA  = meta.SK_EMPRESA
                    AND m2.SK_VENDEDOR = meta.SK_VENDEDOR
                    AND d2.DATA <= c.data_ref)
          GROUP BY meta.SK_EMPRESA, meta.SK_VENDEDOR, vendedor.VENDEDOR_ID
      ),
      vendas_hoje AS (
          SELECT cockpit.SK_EMPRESA, cockpit.SK_VENDEDOR,
                 SUM(CASE WHEN tipo_orcamento.TIPO_SINTETICO = 'DEV'
                          THEN cockpit.VALOR_LIQUIDO_ITEM * -1
                          ELSE cockpit.VALOR_LIQUIDO_ITEM END) AS receita_dia,
                 COUNT(DISTINCT cockpit.SK_CLIENTE)            AS clientes_dia
          FROM FATO_COCKPIT cockpit
          JOIN DIM_DATA dti ON dti.DATANUM = cockpit.SK_DATA
          LEFT JOIN DIM_TIPO_ORCAMENTO tipo_orcamento
              ON tipo_orcamento.SK_TIPO_ORCAMENTO = cockpit.SK_TIPO_ORCAMENTO
          CROSS JOIN cal c
          WHERE cockpit.SK_VENDEDOR <> -1 AND dti.DATA = c.data_ref
          GROUP BY cockpit.SK_EMPRESA, cockpit.SK_VENDEDOR
      ),
      mes_meta_ref AS (
          SELECT NVL(
              MAX(CASE WHEN TO_CHAR(dti.DATA,'YYYYMM') = c.yyyymm_ref
                       THEN TO_CHAR(dti.DATA,'YYYYMM') END),
              MAX(TO_CHAR(dti.DATA,'YYYYMM'))
          ) AS yyyymm_meta_ref
          FROM FATO_META meta
          JOIN DIM_DATA dti ON dti.DATANUM = meta.SK_DATA
          CROSS JOIN cal c
      ),
      meta_mensal AS (
          SELECT meta.SK_EMPRESA, meta.SK_VENDEDOR, SUM(meta.VL_META) AS meta_mes
          FROM FATO_META meta
          JOIN DIM_DATA dti ON dti.DATANUM = meta.SK_DATA
          WHERE meta.SK_VENDEDOR <> -1
            AND TO_CHAR(dti.DATA,'YYYYMM') = (SELECT yyyymm_meta_ref FROM mes_meta_ref)
          GROUP BY meta.SK_EMPRESA, meta.SK_VENDEDOR
      ),
      receita_mes AS (
          SELECT cockpit.SK_EMPRESA, cockpit.SK_VENDEDOR,
                 SUM(CASE WHEN tipo_orcamento.TIPO_SINTETICO = 'DEV'
                          THEN cockpit.VALOR_LIQUIDO_ITEM * -1
                          ELSE cockpit.VALOR_LIQUIDO_ITEM END) AS receita_mes_acumulada
          FROM FATO_COCKPIT cockpit
          JOIN DIM_DATA dti ON dti.DATANUM = cockpit.SK_DATA
          LEFT JOIN DIM_TIPO_ORCAMENTO tipo_orcamento
              ON tipo_orcamento.SK_TIPO_ORCAMENTO = cockpit.SK_TIPO_ORCAMENTO
          CROSS JOIN cal c
          WHERE cockpit.SK_VENDEDOR <> -1
            AND dti.DATA BETWEEN c.ini_mes_ref AND c.data_ref
          GROUP BY cockpit.SK_EMPRESA, cockpit.SK_VENDEDOR
      ),
      funcionario_cpf AS (
          SELECT funcionario_id, MAX(CPF_CNPJ_SEM_PONTOS) AS cpf
          FROM FATO_FUNCIONARIOS_ACESSOS
          GROUP BY funcionario_id
      )
      SELECT
          c.data_ref AS DATA_REFERENCIA,
          b.SK_EMPRESA AS SK_EMPRESA,
          emp.NOME_RESUMIDO AS NOME_RESUMIDO,
          b.SK_VENDEDOR AS SK_VENDEDOR,
          REGEXP_SUBSTR(
              TRIM(SUBSTR(vendedor.NOME_VENDEDOR, 1, INSTR(vendedor.NOME_VENDEDOR || '(','(') - 1)),
              '^\\S+'
          ) || ' ' ||
          REGEXP_SUBSTR(
              TRIM(SUBSTR(vendedor.NOME_VENDEDOR, 1, INSTR(vendedor.NOME_VENDEDOR || '(','(') - 1)),
              '\\S+$'
          ) AS NOME_VENDEDOR,
          NVL(v.receita_dia,  0)  AS RECEITA_DIA,
          NVL(v.clientes_dia, 0)  AS CLIENTES_DIA,
          CASE WHEN NVL(v.clientes_dia,0) > 0
               THEN NVL(v.receita_dia,0) / v.clientes_dia
               ELSE 0 END          AS TICKET_MEDIO_DIA,
          NVL(m.meta_mes, 0)       AS META_MES,
          b.dias_restantes         AS DIAS_RESTANTES,
          (m.meta_mes - NVL(rm.receita_mes_acumulada, 0)) AS META_RESTANTE,
          NVL(b.valor_meta_dia, 0) AS META_DIARIA_NECESSARIA,
          CASE WHEN NVL(v.receita_dia, 0) >= NVL(b.valor_meta_dia, 0)
               THEN 'OK' ELSE 'DEVENDO' END AS STATUS_DIA,
          CASE WHEN NVL(b.valor_meta_dia, 0) > 0
               THEN NVL(v.receita_dia, 0) / NVL(b.valor_meta_dia, 0)
               ELSE 0 END AS PERC_PERFORMANCE_DIA,
          RANK() OVER (
              PARTITION BY b.SK_EMPRESA
              ORDER BY NVL(v.receita_dia, 0) DESC
          ) AS RANKING_DIA,
          b.vendedor_id AS VENDEDOR_ID,
          f.cpf         AS CPF
      FROM base_dia b
      CROSS JOIN cal c
      LEFT JOIN DIM_VENDEDOR  vendedor ON vendedor.SK_VENDEDOR = b.SK_VENDEDOR
      LEFT JOIN DIM_EMPRESAS  emp      ON emp.SK_EMPRESAS      = b.SK_EMPRESA
      LEFT JOIN vendas_hoje   v        ON v.SK_EMPRESA = b.SK_EMPRESA  AND v.SK_VENDEDOR = b.SK_VENDEDOR
      LEFT JOIN meta_mensal   m        ON m.SK_EMPRESA = b.SK_EMPRESA  AND m.SK_VENDEDOR = b.SK_VENDEDOR
      LEFT JOIN receita_mes   rm       ON rm.SK_EMPRESA = b.SK_EMPRESA AND rm.SK_VENDEDOR = b.SK_VENDEDOR
      LEFT JOIN funcionario_cpf f      ON f.funcionario_id = b.vendedor_id
      WHERE m.meta_mes IS NOT NULL
    )
    WHERE ${sellerScope.clause}
    ORDER BY ranking_dia
  `
}

router.get("/ranking-vendedores", requireAuth, async (req, res) => {
  try {
    const modo = req.query.modo || "mensal"
    const periodo = req.query.periodo === "anterior" ? "anterior" : "atual"
    const empresaId = getScopedEmpresaId(req)
    if (!empresaId) {
      return res.status(400).json({ error: "empresa_id e obrigatorio para buscar ranking." })
    }

    const context = await getQueryContext(empresaId)
    const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(empresaId)
    const sellerScope = buildSellerInCondition("sk_vendedor", allowedSellerCodes)

    let sql = ""

    if (modo === "diario") {
      sql = periodo === "anterior"
        ? buildDiarioAnteriorSql(sellerScope)
        : `
        SELECT *
        FROM ${context.rankingDayView}
        WHERE ${sellerScope.clause}
        ORDER BY ranking_dia
      `
    } else {
      sql = periodo === "anterior"
        ? buildMensalAnteriorSql(sellerScope)
        : `
        SELECT *
        FROM ${context.rankingView}
        WHERE ${sellerScope.clause}
        ORDER BY ranking_atingimento
      `
    }

    const rows = await context.query(sql, sellerScope.binds)

    res.json(rows.map(normalizeRow))

  } catch (err) {
    console.error("Erro ranking vendedores:", err)
    res.status(500).json({ error: "Erro ao buscar ranking" })
  }
})

export default router
