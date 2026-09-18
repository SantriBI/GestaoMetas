import oracledb from "../src/db/oracleClient.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const Q1 = `
SELECT
    e.NOME_RESUMIDO   AS LOJA,
    v.SK_EMPRESA,
    v.NOME_VENDEDOR,
    v.SK_VENDEDOR,
    v.RECEITA_MES     AS FATURAMENTO_MES,
    v.META_MES,
    ROUND(CASE WHEN v.META_MES > 0 THEN v.RECEITA_MES / v.META_MES * 100 ELSE 0 END, 1) AS PERC_ATINGIMENTO
FROM VW_RANKING_VENDEDORES v
JOIN DIM_EMPRESAS e ON e.SK_EMPRESAS = v.SK_EMPRESA
WHERE v.SK_EMPRESA IN (461, 481)
ORDER BY e.NOME_RESUMIDO, v.NOME_VENDEDOR
`

const Q2 = `
SELECT
    e.NOME_RESUMIDO AS LOJA,
    e.SK_EMPRESAS,
    SUM(v.RECEITA_MES) AS FATURAMENTO_TOTAL,
    SUM(v.META_MES)    AS META_TOTAL_VENDEDORES
FROM VW_RANKING_VENDEDORES v
JOIN DIM_EMPRESAS e ON e.SK_EMPRESAS = v.SK_EMPRESA
WHERE v.SK_EMPRESA IN (461, 481)
GROUP BY e.NOME_RESUMIDO, e.SK_EMPRESAS
ORDER BY e.NOME_RESUMIDO
`

const Q3 = `
SELECT
    emp.NOME_RESUMIDO      AS LOJA,
    m.SK_EMPRESA,
    dep.NOME_DEPARTAMENTO,
    m.SK_DEPARTAMENTO,
    m.SK_DATA,
    m.VL_META,
    m.PERC_LUCRO_META,
    m.VALOR_LUCRO
FROM FATO_META m
JOIN DIM_EMPRESAS emp       ON emp.SK_EMPRESAS = m.SK_EMPRESA
LEFT JOIN DIM_DEPARTAMENTO dep ON dep.SK_DEPARTAMENTO = m.SK_DEPARTAMENTO
WHERE m.SK_VENDEDOR = -1
  AND m.SK_DATA = 20260901
  AND m.SK_EMPRESA IN (461, 481)
ORDER BY LOJA, m.SK_DEPARTAMENTO
`

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })

  console.log("\n===== Q1: Meta x Receita por vendedor =====")
  console.log((await conn.execute(Q1)).rows)

  console.log("\n===== Q2: Resumo por loja (soma dos vendedores) =====")
  console.log((await conn.execute(Q2)).rows)

  console.log("\n===== Q3: Metas sem vendedor associado (por departamento) =====")
  console.log((await conn.execute(Q3)).rows)

  await conn.close()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
