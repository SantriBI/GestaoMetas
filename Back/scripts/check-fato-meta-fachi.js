import oracledb from "../src/db/oracleClient.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })

  const r = await conn.execute(`
    SELECT m.SK_EMPRESA, m.SK_VENDEDOR, v.VENDEDOR_ID, v.NOME_VENDEDOR, SUM(m.VL_META) AS META
    FROM FATO_META m
    LEFT JOIN DIM_VENDEDOR v ON v.SK_VENDEDOR = m.SK_VENDEDOR
    WHERE m.SK_DATA = 20260901 AND m.SK_EMPRESA IN (461, 481)
    GROUP BY m.SK_EMPRESA, m.SK_VENDEDOR, v.VENDEDOR_ID, v.NOME_VENDEDOR
    ORDER BY v.VENDEDOR_ID, m.SK_EMPRESA
  `)
  console.log(JSON.stringify(r.rows, null, 2))
  await conn.close()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
