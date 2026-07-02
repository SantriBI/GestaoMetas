import "dotenv/config"
import oracledb from "oracledb"

const mode = (process.env.ORACLE_CLIENT_MODE ?? "auto").trim().toLowerCase()
const requireThick =
  mode === "thick" ||
  ["1", "true", "yes"].includes((process.env.ORACLE_REQUIRE_THICK ?? "").trim().toLowerCase())
const forceThin = mode === "thin"
const libDir = process.env.ORACLE_CLIENT_LIB_DIR?.trim()
const shouldInitThick = !forceThin && (requireThick || Boolean(libDir))

function isLinux() {
  return process.platform === "linux"
}

function getInitOptions() {
  if (!libDir) return undefined

  if (isLinux()) {
    console.warn(
      "[oracle] ORACLE_CLIENT_LIB_DIR foi ignorado no Linux. Configure o library search path " +
      "com ldconfig ou LD_LIBRARY_PATH antes de iniciar o Node.js."
    )
    return undefined
  }

  return { libDir }
}

function getClientVersionText() {
  if (oracledb.thin) return "nao disponivel em thin mode"
  return String(oracledb.oracleClientVersionString ?? oracledb.oracleClientVersion)
}

export function sanitizeConnectString(connectString) {
  if (!connectString) return "nao especificado"

  return String(connectString)
    .replace(/\/\/([^:/@]+):([^@]+)@/g, "//$1:***@")
    .replace(/(PASSWORD\s*=\s*)([^)\s]+)/gi, "$1***")
}

export function getOracleRuntimeInfo() {
  return {
    mode: oracledb.thin ? "thin" : "thick",
    thin: oracledb.thin,
    oracleClientVersion: getClientVersionText(),
  }
}

export function explainOracleConnectionError(err) {
  const message = String(err?.message ?? err ?? "")
  const code = err?.code ?? message.match(/\b(?:NJS|DPI|ORA)-\d+\b/)?.[0] ?? "oracle"

  if (message.includes("NJS-533")) {
    return (
      `${code}: Oracle exige Native Network Encryption/Data Integrity, mas o node-oracledb esta em thin mode. ` +
      "Habilite Thick mode com Oracle Instant Client e ORACLE_CLIENT_MODE=thick."
    )
  }

  if (message.includes("DPI-1047")) {
    return (
      `${code}: Oracle Instant Client nao foi carregado. ` +
      "No Linux/Docker, configure ldconfig ou LD_LIBRARY_PATH antes de iniciar o Node.js. " +
      "No Windows, defina ORACLE_CLIENT_LIB_DIR ou adicione o Instant Client ao PATH."
    )
  }

  return message || String(err)
}

if (shouldInitThick) {
  try {
    const options = getInitOptions()
    oracledb.initOracleClient(options)
    const source = options?.libDir ? `libDir=${options.libDir}` : "library search path"
    console.log(
      `[oracle] node-oracledb inicializado em modo thick (${source}; client=${getClientVersionText()}).`
    )
  } catch (err) {
    throw new Error(
      "[oracle] Nao foi possivel inicializar o modo thick do node-oracledb. " +
      "Instale o Oracle Instant Client 64-bit. No Linux/Docker, configure ldconfig ou LD_LIBRARY_PATH; " +
      "no Windows, defina ORACLE_CLIENT_LIB_DIR ou adicione o Instant Client ao PATH. " +
      `Detalhe: ${err?.message ?? err}`
    )
  }
} else {
  console.log("[oracle] node-oracledb usando thin mode. Defina ORACLE_CLIENT_MODE=thick para exigir Thick mode.")
}

if (requireThick && oracledb.thin) {
  throw new Error("[oracle] ORACLE_CLIENT_MODE=thick exigido, mas o node-oracledb continuou em thin mode.")
}

export default oracledb
