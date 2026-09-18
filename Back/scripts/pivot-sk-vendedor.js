import oracledb from "../src/db/oracleClient.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })

  const r = await conn.execute(`
    SELECT
        NVL(v461.VENDEDOR_ID, v481.VENDEDOR_ID)     AS VENDEDOR_ID,
        NVL(v461.NOME_VENDEDOR, v481.NOME_VENDEDOR) AS NOME_VENDEDOR,
        v461.SK_VENDEDOR AS SK_VENDEDOR_461,
        v481.SK_VENDEDOR AS SK_VENDEDOR_481
    FROM (
        SELECT dv.VENDEDOR_ID, dv.SK_VENDEDOR, dv.NOME_VENDEDOR
        FROM DIM_VENDEDOR dv
        WHERE dv.SK_VENDEDOR IN (SELECT DISTINCT SK_VENDEDOR FROM VW_RANKING_VENDEDORES WHERE SK_EMPRESA = 461)
    ) v461
    FULL OUTER JOIN (
        SELECT dv.VENDEDOR_ID, dv.SK_VENDEDOR, dv.NOME_VENDEDOR
        FROM DIM_VENDEDOR dv
        WHERE dv.SK_VENDEDOR IN (SELECT DISTINCT SK_VENDEDOR FROM VW_RANKING_VENDEDORES WHERE SK_EMPRESA = 481)
    ) v481
        ON v481.VENDEDOR_ID = v461.VENDEDOR_ID
    ORDER BY NOME_VENDEDOR
  `)
  console.table(r.rows)

  await conn.close()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
