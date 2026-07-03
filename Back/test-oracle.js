import "./src/config/env.js"
import oracledb, {
  explainOracleConnectionError,
  getOracleRuntimeInfo,
  sanitizeConnectString,
} from "./src/db/oracleClient.js"

function isThickRequired() {
  return (
    (process.env.ORACLE_CLIENT_MODE ?? "").trim().toLowerCase() === "thick" ||
    ["1", "true", "yes"].includes((process.env.ORACLE_REQUIRE_THICK ?? "").trim().toLowerCase())
  )
}

async function test() {
  let connection = null

  try {
    const runtime = getOracleRuntimeInfo()
    console.log(
      `[oracle-smoke] mode=${runtime.mode}; client=${runtime.oracleClientVersion}; ` +
      `connectString=${sanitizeConnectString(process.env.DB_CONNECT_STRING)}`
    )

    if (isThickRequired() && oracledb.thin) {
      throw new Error("ORACLE_CLIENT_MODE=thick exigido, mas o node-oracledb esta em thin mode.")
    }

    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    })

    console.log("Conectado com sucesso ao Oracle.")

    const result = await connection.execute("SELECT 1 AS OK FROM dual")

    console.log(result.rows)
  } catch (err) {
    console.error("Erro ao conectar ao Oracle:", explainOracleConnectionError(err))
    process.exitCode = 1
  } finally {
    if (connection) {
      await connection.close()
    }
  }
}

test()
