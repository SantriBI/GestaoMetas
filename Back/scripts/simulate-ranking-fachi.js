import oracledb from "../src/db/oracleClient.js"
import mysql from "mysql2/promise"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function main() {
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.TENANT_DATABASE, // ex: org_22_fachi
  })

  const [rows] = await mysqlConn.query(
    `SELECT DISTINCT sk_vendedor FROM usuarios_auth WHERE ativo='S' AND role='VENDEDOR' AND sk_vendedor IS NOT NULL`
  )
  const allowed = rows.map((r) => Number(r.sk_vendedor))
  console.log("Codigos permitidos (usuarios_auth, ao vivo):", allowed.sort((a, b) => a - b))
  await mysqlConn.end()

  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })

  for (const skEmpresa of [461, 481]) {
    const binds = {}
    const placeholders = allowed.map((v, i) => {
      binds[`p${i}`] = v
      return `:p${i}`
    })
    const r = await conn.execute(
      `
      SELECT SK_VENDEDOR, NOME_VENDEDOR, RECEITA_MES, META_MES
      FROM VW_RANKING_VENDEDORES
      WHERE SK_EMPRESA = :skEmpresa
        AND SK_VENDEDOR IN (${placeholders.join(", ")})
      ORDER BY NOME_VENDEDOR
      `,
      { skEmpresa, ...binds }
    )
    const total_receita = r.rows.reduce((s, row) => s + Number(row.RECEITA_MES ?? 0), 0)
    const total_meta = r.rows.reduce((s, row) => s + Number(row.META_MES ?? 0), 0)
    console.log(`\n=== SK_EMPRESA ${skEmpresa} === (simulando ranking-vendedores com escopo atual)`)
    console.log(r.rows)
    console.log(`TOTAL RECEITA=${total_receita} TOTAL META=${total_meta}`)
  }

  await conn.close()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
