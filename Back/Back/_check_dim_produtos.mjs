import "./src/config/env.js"
import { queryOracleByEmpresaId } from "./src/db/oracle-tenants.js"

try {
  const rows = await queryOracleByEmpresaId(
    19,
    "SELECT column_name FROM all_tab_columns WHERE table_name = 'DIM_PRODUTOS' ORDER BY column_id",
    {}
  )
  console.log(JSON.stringify(rows, null, 2))
} catch (err) {
  console.error("ERRO:", err.message)
}
process.exit(0)
