import oracledb from "../src/db/oracleClient.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })

  const tabs = await conn.execute(
    `SELECT table_name FROM all_tables WHERE table_name LIKE '%DEPART%' ORDER BY table_name`
  )
  console.log("Tabelas candidatas:", tabs.rows)

  for (const t of tabs.rows) {
    const cols = await conn.execute(
      `SELECT column_name, column_id FROM all_tab_columns WHERE table_name = :t ORDER BY column_id`,
      { t: t.TABLE_NAME }
    )
    console.log(`\n${t.TABLE_NAME}:`, cols.rows)
  }

  await conn.close()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
