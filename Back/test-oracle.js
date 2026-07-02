import "dotenv/config"
import oracledb from "oracledb"
import "./src/db/oracleClient.js"

async function test() {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    })

    console.log("Conectado com sucesso ao Oracle.")

    const result = await connection.execute("SELECT 'Oracle OK' AS STATUS FROM dual")

    console.log(result.rows)

    await connection.close()
  } catch (err) {
    console.error("Erro ao conectar ao Oracle:", err)
  }
}

test()
