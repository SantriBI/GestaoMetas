import "../src/config/env.js"
import centralPool from "../src/db/mysql.js"

const [rows] = await centralPool.query(
  "SELECT id_organizacao, nome FROM organizacoes_auth ORDER BY id_organizacao"
)
console.table(rows)
process.exit(0)
