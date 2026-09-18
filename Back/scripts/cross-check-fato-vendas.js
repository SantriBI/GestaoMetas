import oracledb from "../src/db/oracleClient.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })

  // Cruza FATO_VENDAS_LUCRATIVIDADE (fato bruto do ERP) com VW_RANKING_VENDEDORES
  // (o que a view/tela mostra), por vendedor, pro mes corrente. Se baterem, a view esta
  // correta; se nao baterem, o problema pode estar na view, nao so no cadastro.
  const r = await conn.execute(`
    WITH bruto AS (
      SELECT
        f.SK_VENDEDOR,
        f.SK_EMPRESA,
        SUM(f.VALOR_LIQUIDO_ITEM) AS RECEITA_BRUTO
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DIM_DATA dti ON dti.DATANUM = f.SK_DT_FECHAMENTO
      WHERE f.SK_VENDEDOR <> -1
        AND f.SK_EMPRESA IN (461, 481)
        AND TO_CHAR(dti.DATA, 'YYYYMM') = TO_CHAR(SYSDATE, 'YYYYMM')
      GROUP BY f.SK_VENDEDOR, f.SK_EMPRESA
    ),
    view_ranking AS (
      SELECT SK_VENDEDOR, SK_EMPRESA, RECEITA_MES
      FROM VW_RANKING_VENDEDORES
      WHERE SK_EMPRESA IN (461, 481)
    )
    SELECT
      NVL(b.SK_EMPRESA, v.SK_EMPRESA)   AS SK_EMPRESA,
      NVL(b.SK_VENDEDOR, v.SK_VENDEDOR) AS SK_VENDEDOR,
      dv.NOME_VENDEDOR,
      b.RECEITA_BRUTO,
      v.RECEITA_MES AS RECEITA_VIEW,
      ROUND(NVL(b.RECEITA_BRUTO, 0) - NVL(v.RECEITA_MES, 0), 2) AS DIFERENCA
    FROM bruto b
    FULL OUTER JOIN view_ranking v
      ON v.SK_VENDEDOR = b.SK_VENDEDOR AND v.SK_EMPRESA = b.SK_EMPRESA
    LEFT JOIN DIM_VENDEDOR dv ON dv.SK_VENDEDOR = NVL(b.SK_VENDEDOR, v.SK_VENDEDOR)
    ORDER BY SK_EMPRESA, NOME_VENDEDOR
  `)

  console.table(r.rows)

  const totalDiff = r.rows.reduce((s, row) => s + Math.abs(Number(row.DIFERENCA ?? 0)), 0)
  console.log(`\nSoma das diferencas absolutas: ${totalDiff.toFixed(2)}`)

  await conn.close()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
