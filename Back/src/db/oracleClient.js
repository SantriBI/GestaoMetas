import "dotenv/config"
import oracledb from "oracledb"

// Ativa o modo thick do node-oracledb quando o Oracle Instant Client estiver
// disponivel. Alguns bancos Oracle de clientes (ex.: sqlnet.ora com Native
// Network Encryption / Data Integrity obrigatorios) rejeitam conexoes em modo
// thin (padrao) com o erro NJS-533. Se o Instant Client nao for encontrado,
// segue em modo thin para nao quebrar ambientes sem essa dependencia.
const libDir = process.env.ORACLE_CLIENT_LIB_DIR?.trim()

if (libDir) {
  try {
    oracledb.initOracleClient({ libDir })
    console.log(`[oracle] node-oracledb inicializado em modo thick (libDir=${libDir}).`)
  } catch (err) {
    throw new Error(
      "[oracle] Nao foi possivel inicializar o modo thick do node-oracledb. " +
      "Instale o Oracle Instant Client 64-bit e defina ORACLE_CLIENT_LIB_DIR para a pasta correta. " +
      `Detalhe: ${err?.message ?? err}`
    )
  }
} else {
  console.log("[oracle] ORACLE_CLIENT_LIB_DIR nao definido; usando node-oracledb em modo thin.")
}

export default oracledb
