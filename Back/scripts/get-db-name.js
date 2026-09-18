import mysql from "mysql2/promise"

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  })
  const [rows] = await conn.query(
    "SELECT id_organizacao, nome, db_name FROM organizacoes_auth WHERE id_organizacao = ?",
    [22]
  )
  console.table(rows)
  await conn.end()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
