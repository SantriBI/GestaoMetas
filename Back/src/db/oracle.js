import oracledb from "./oracleClient.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [oracledb.CLOB]

const TRANSIENT_ORACLE_ERROR_CODES = new Set([8103])
const MAX_SELECT_RETRIES = 2
const RETRY_DELAY_MS = 150

let poolPromise = null

function getLegacyOracleConfig() {
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const connectString = process.env.DB_CONNECT_STRING

  if (!user || !password || !connectString) {
    throw new Error(
      "Oracle legado nao configurado. Defina DB_USER, DB_PASSWORD e DB_CONNECT_STRING no Back/.env."
    )
  }

  return {
    user,
    password,
    connectString,
    poolMin: 4,
    poolMax: 25,
    poolIncrement: 2
  }
}

export async function getPool() {
  if (!poolPromise) {
    poolPromise = oracledb.createPool(getLegacyOracleConfig()).catch((err) => {
      poolPromise = null
      throw err
    })
  }

  return poolPromise
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getOracleErrorCode(err) {
  if (typeof err?.errorNum === "number") {
    return err.errorNum
  }

  const match = String(err?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

function isRetryableSelectError(err, isDml) {
  if (isDml) {
    return false
  }

  return TRANSIENT_ORACLE_ERROR_CODES.has(getOracleErrorCode(err))
}

// Funcao utilitaria para SELECT e DML.
// DML usa autoCommit para persistir alteracoes.
export async function query(sql, binds = {}, options = {}) {
  const isDml = /^\s*(INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql)
  const execOptions = { autoCommit: isDml, ...options }
  const maxAttempts = isDml ? 1 : MAX_SELECT_RETRIES + 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pool = await getPool()
    const connection = await pool.getConnection()

    try {
      const result = await connection.execute(sql, binds, execOptions)
      return result.rows ?? []
    } catch (err) {
      const canRetry = isRetryableSelectError(err, isDml) && attempt < maxAttempts

      if (!canRetry) {
        throw err
      }

      console.warn(
        `Oracle transient read error ORA-${String(getOracleErrorCode(err)).padStart(5, "0")} on attempt ${attempt}/${maxAttempts}. Retrying query.`
      )
      await sleep(RETRY_DELAY_MS * attempt)
    } finally {
      await connection.close()
    }
  }
}

export default getPool
