import oracledb, {
  explainOracleConnectionError,
  getOracleRuntimeInfo,
  sanitizeConnectString,
} from "./oracleClient.js"
import centralPool from "./mysql.js"
import { decryptSecret, SecretDecryptError, KEY_FINGERPRINT } from "../security/secrets.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [oracledb.CLOB]

function getOracleErrorCode(err) {
  if (typeof err?.errorNum === "number") return err.errorNum
  const match = String(err?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

const TRANSIENT_ORACLE_ERROR_CODES = new Set([8103])
// Teto por chamada ao banco (execute/fetch). Sem ele, uma consulta lenta segurava a conexao e
// a thread do libuv indefinidamente e, com poucas delas, esgotava o pool (NJS-040, 2026-10-01).
const ORACLE_CALL_TIMEOUT_MS = 30000
// NJS-123: callTimeout estourou (DPI-1067 no thick). NJS-500: conexao morta (DPI-1080,
// ORA-03113...). Em ambos a sessao pode ter ficado em estado indefinido - descarta do pool
// (close com drop) em vez de devolver para o proximo request reaproveitar.
const DISCARD_CONNECTION_ERROR_CODES = new Set(["NJS-123", "NJS-500"])
const MAX_SELECT_RETRIES = 2
const RETRY_DELAY_MS = 150
const LEGACY_ENCRYPTED_PASSWORD_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i

// Um pool por organizacao (cada tenant tem usuario/senha/connect string proprios). Sem isso,
// toda consulta abria uma conexao fisica nova (handshake TNS do zero) - com varias consultas
// por pagina, isso somava segundos de latencia so em conexao. O pool mantem conexoes vivas e
// reaproveitaveis entre requests.
const poolCache = new Map() // empresaId -> Promise<{ pool, connectString }>

async function getOraclePoolEntry(empresaId) {
  if (poolCache.has(empresaId)) {
    return poolCache.get(empresaId)
  }

  const entryPromise = (async () => {
    const { user, password, connectString } = await getOracleConfigByEmpresaId(empresaId)
    try {
      const pool = await oracledb.createPool({
        user,
        password,
        connectString,
        poolMin: 1,
        poolMax: 5,
        poolIncrement: 1,
        poolTimeout: 60,
      })
      return { pool, connectString }
    } catch (err) {
      poolCache.delete(empresaId)
      throw err
    }
  })()

  poolCache.set(empresaId, entryPromise)
  return entryPromise
}

/**
 * Derruba o pool em cache de uma organizacao. Precisa ser chamado sempre que as credenciais
 * Oracle dela mudam (ex.: admin reinformando a senha) - sem isso, o pool ja aberto continua
 * sendo reaproveitado com o usuario/senha antigos ate o processo reiniciar, e toda consulta
 * passa a falhar (autenticacao) mesmo com a senha nova correta salva no banco.
 */
export async function invalidateOraclePool(empresaId) {
  const entryPromise = poolCache.get(empresaId)
  if (!entryPromise) return

  poolCache.delete(empresaId)

  try {
    const { pool } = await entryPromise
    await pool.close(0)
  } catch {
    // Pool nunca chegou a abrir ou ja fechou - nada a fazer, so garantir que saiu do cache.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableSelectError(err, isDml) {
  return !isDml && TRANSIENT_ORACLE_ERROR_CODES.has(getOracleErrorCode(err))
}

function shouldDiscardConnection(err) {
  return DISCARD_CONNECTION_ERROR_CODES.has(err?.code) || /DPI-1067|DPI-1080|ORA-03156/.test(String(err?.message ?? ""))
}

async function releaseConnection(connection, discard, empresaId) {
  if (!discard) {
    await connection.close()
    return
  }

  try {
    await connection.close({ drop: true })
  } catch (closeErr) {
    // A sessao ja estava quebrada; o pool decrementa connectionsOut mesmo se o drop falhar
    // (finally de pool._release), entao a vaga e liberada de qualquer jeito.
    console.error(`[oracle-tenants] falha ao descartar conexao da organizacao ${empresaId}:`, closeErr?.message)
  }
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
    organizationId: org.id_organizacao,
  }
}

const ORACLE_CREDENTIALS_UNAVAILABLE_MESSAGE =
  "Nao foi possivel conectar aos dados desta organizacao no momento. Tente novamente em instantes ou contate o suporte."

function throwOracleCredentialsUnavailable(org, technicalDetail) {
  console.error(
    `Credenciais Oracle indisponiveis para organizacao ${org.id_organizacao}: ${technicalDetail}`
  )
  const error = new Error(ORACLE_CREDENTIALS_UNAVAILABLE_MESSAGE)
  error.status = 503
  error.code = "ORACLE_CREDENTIALS_UNAVAILABLE"
  throw error
}

async function decryptOraclePassword(org) {
  const raw = String(org.oracle_password ?? "")

  if (!LEGACY_ENCRYPTED_PASSWORD_RE.test(raw)) {
    throwOracleCredentialsUnavailable(
      org,
      "senha nao esta criptografada; rode Back/scripts/migrate-oracle-passwords.js"
    )
  }

  try {
    return decryptSecret(raw)
  } catch (error) {
    if (error instanceof SecretDecryptError) {
      throwOracleCredentialsUnavailable(
        org,
        `falha ao decriptar; APP_ENCRYPTION_KEY pode estar incorreta ou ter sido rotacionada ` +
        `(fingerprint atual do processo: ${KEY_FINGERPRINT}), ` +
        "corrija a chave ou reinforme a senha Oracle da organizacao no admin"
      )
    }
    throw error
  }
}

export async function queryOracleByEmpresaId(empresaId, sql, binds = {}, options = {}) {
  if (!empresaId) {
    throw new Error("empresa_id e obrigatorio para consultar o Oracle do cliente.")
  }

  const runtime = getOracleRuntimeInfo()
  const isDml = /^\s*(INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql)
  const { suppressErrorLog = false, ...oracleOptions } = options
  const execOptions = { autoCommit: isDml, ...oracleOptions }
  const maxAttempts = isDml ? 1 : MAX_SELECT_RETRIES + 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let connection = null
    let connectStringForLog = null
    let discardConnection = false

    try {
      const { pool, connectString } = await getOraclePoolEntry(empresaId)
      connectStringForLog = connectString
      connection = await pool.getConnection()
      connection.callTimeout = ORACLE_CALL_TIMEOUT_MS
      const result = await connection.execute(sql, binds, execOptions)
      return result.rows ?? []
    } catch (err) {
      discardConnection = shouldDiscardConnection(err)
      const canRetry = isRetryableSelectError(err, isDml) && attempt < maxAttempts
      if (!canRetry) {
        if (!suppressErrorLog) {
          console.error(
            `[oracle-tenants] falha na consulta Oracle da organizacao ${empresaId} ` +
            `(mode=${runtime.mode}; client=${runtime.oracleClientVersion}; ` +
            `connectString=${sanitizeConnectString(connectStringForLog)}):`,
            explainOracleConnectionError(err)
          )
        }
        throw err
      }
      await sleep(RETRY_DELAY_MS * attempt)
    } finally {
      if (connection) {
        await releaseConnection(connection, discardConnection, empresaId)
      }
    }
  }

  return []
}
