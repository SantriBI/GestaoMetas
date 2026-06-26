import oracledb from "oracledb"
import centralPool from "./mysql.js"
import { decryptSecret, encryptSecret, SecretDecryptError } from "../security/secrets.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [oracledb.CLOB]

function getOracleErrorCode(err) {
  if (typeof err?.errorNum === "number") return err.errorNum
  const match = String(err?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

const TRANSIENT_ORACLE_ERROR_CODES = new Set([8103])
const MAX_SELECT_RETRIES = 2
const RETRY_DELAY_MS = 150

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableSelectError(err, isDml) {
  return !isDml && TRANSIENT_ORACLE_ERROR_CODES.has(getOracleErrorCode(err))
}

async function getOracleConfigByEmpresaId(empresaId) {
  const [rows] = await centralPool.query(
    `SELECT id_organizacao, oracle_user, oracle_password, oracle_connect_string
     FROM organizacoes_auth
     WHERE id_organizacao = ?
     LIMIT 1`,
    [empresaId]
  )

  const org = rows[0]
  if (!org?.oracle_user || !org?.oracle_password || !org?.oracle_connect_string) {
    throw new Error(`Credenciais Oracle nao encontradas para empresa_id=${empresaId}`)
  }

  return {
    user: org.oracle_user,
    password: await decryptOraclePassword(org),
    connectString: org.oracle_connect_string,
  }
}

async function decryptOraclePassword(org) {
  try {
    return decryptSecret(org.oracle_password)
  } catch (error) {
    const fallback = process.env.ORACLE_TENANT_PASSWORD_FALLBACK

    if (!(error instanceof SecretDecryptError) || !fallback) {
      throw error
    }

    console.warn(
      `[oracle-tenants] Falha ao decriptar oracle_password da organizacao ${org.id_organizacao}. ` +
      "Usando ORACLE_TENANT_PASSWORD_FALLBACK e regravando com a APP_ENCRYPTION_KEY atual."
    )

    try {
      await centralPool.query(
        "UPDATE organizacoes_auth SET oracle_password = ? WHERE id_organizacao = ?",
        [encryptSecret(fallback), org.id_organizacao]
      )
    } catch (updateError) {
      console.warn(
        `[oracle-tenants] Nao foi possivel regravar oracle_password da organizacao ${org.id_organizacao}:`,
        updateError?.message ?? updateError
      )
    }

    return fallback
  }
}

export async function queryOracleByEmpresaId(empresaId, sql, binds = {}, options = {}) {
  if (!empresaId) {
    throw new Error("empresa_id e obrigatorio para consultar o Oracle do cliente.")
  }

  const config = await getOracleConfigByEmpresaId(empresaId)
  const isDml = /^\s*(INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql)
  const execOptions = { autoCommit: isDml, ...options }
  const maxAttempts = isDml ? 1 : MAX_SELECT_RETRIES + 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let connection = null

    try {
      connection = await oracledb.getConnection(config)
      const result = await connection.execute(sql, binds, execOptions)
      return result.rows ?? []
    } catch (err) {
      const canRetry = isRetryableSelectError(err, isDml) && attempt < maxAttempts
      if (!canRetry) throw err
      await sleep(RETRY_DELAY_MS * attempt)
    } finally {
      if (connection) {
        await connection.close()
      }
    }
  }

  return []
}
