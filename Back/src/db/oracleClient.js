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
    console.warn(
      "[oracle] Nao foi possivel inicializar o modo thick do node-oracledb; seguindo em modo thin. " +
      "Bancos que exigem Native Network Encryption/Data Integrity vao falhar com NJS-533. " +
      "Instale o Oracle Instant Client 64-bit e defina ORACLE_CLIENT_LIB_DIR para a pasta correta.",
      err?.message ?? err
    )
  }
} else {
  console.log("[oracle] ORACLE_CLIENT_LIB_DIR nao definido; usando node-oracledb em modo thin.")
}
