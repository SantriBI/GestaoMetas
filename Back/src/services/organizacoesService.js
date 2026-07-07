import crypto from "node:crypto"
import oracledb from "../db/oracleClient.js"
import { query } from "../db/oracle.js"
import { resolveOracleObjectName } from "../db/oracleObjectNames.js"
import {
  dropOracleProvisionedViews,
  provisionOracleSchemaObjects,
  provisionOracleViews,
} from "./oracleProvisioningService.js"

const ENCRYPT_ALGORITHM = "aes-256-gcm"
const ENCRYPT_KEY_LENGTH = 32
const ENCRYPT_IV_LENGTH = 16
const ENCRYPT_TAG_LENGTH = 16

function getEncryptKey() {
  const raw = process.env.ORGANIZACOES_ENCRYPT_SECRET ?? ""
  if (!raw) {
    throw new Error("ORGANIZACOES_ENCRYPT_SECRET nao configurado no ambiente.")
  }
  return crypto.scryptSync(raw, "sip-orgs-salt", ENCRYPT_KEY_LENGTH)
}

function encryptPassword(plainText) {
  const key = getEncryptKey()
  const iv = crypto.randomBytes(ENCRYPT_IV_LENGTH)
  const cipher = crypto.createCipheriv(ENCRYPT_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

function decryptPassword(encoded) {
  const key = getEncryptKey()
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, ENCRYPT_IV_LENGTH)
  const tag = buf.subarray(ENCRYPT_IV_LENGTH, ENCRYPT_IV_LENGTH + ENCRYPT_TAG_LENGTH)
  const encrypted = buf.subarray(ENCRYPT_IV_LENGTH + ENCRYPT_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ENCRYPT_ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8")
}

async function getOrgsTable() {
  return resolveOracleObjectName("organizacoesTable")
}

function normalizeRow(row) {
  if (!row) return null
  return {
    id: row.ID ?? row.id,
    nome: row.NOME ?? row.nome,
    descricao: row.DESCRICAO ?? row.descricao ?? null,
    status: row.STATUS ?? row.status,
    db_user: row.DB_USER ?? row.db_user,
    db_connect_string: row.DB_CONNECT_STRING ?? row.db_connect_string,
    criado_em: row.CRIADO_EM ?? row.criado_em,
    atualizado_em: row.ATUALIZADO_EM ?? row.atualizado_em,
  }
}

export async function listOrganizacoes() {
  const table = await getOrgsTable()
  const rows = await query(
    `SELECT id, nome, descricao, status, db_user, db_connect_string, criado_em, atualizado_em
     FROM ${table}
     ORDER BY nome ASC`
  )
  return rows.map(normalizeRow)
}

export async function getOrganizacaoById(id) {
  const table = await getOrgsTable()
  const rows = await query(
    `SELECT id, nome, descricao, status, db_user, db_connect_string, criado_em, atualizado_em
     FROM ${table}
     WHERE id = :id`,
    { id: Number(id) }
  )
  if (!rows.length) {
    const err = new Error("organizacao nao encontrada")
    err.status = 404
    throw err
  }
  return normalizeRow(rows[0])
}

function validatePayload(data) {
  const nome = String(data.nome ?? "").trim()
  const dbUser = String(data.db_user ?? "").trim()
  const dbPassword = String(data.db_password ?? "").trim()
  const dbConnectString = String(data.db_connect_string ?? "").trim()

  if (!nome) throw Object.assign(new Error("nome obrigatorio"), { status: 400 })
  if (!dbUser) throw Object.assign(new Error("db_user obrigatorio"), { status: 400 })
  if (!dbPassword) throw Object.assign(new Error("db_password obrigatorio"), { status: 400 })
  if (!dbConnectString) throw Object.assign(new Error("db_connect_string obrigatorio"), { status: 400 })

  const status = String(data.status ?? "ATIVA").trim().toUpperCase()
  if (!["ATIVA", "INATIVA"].includes(status)) {
    throw Object.assign(new Error("status invalido. Use ATIVA ou INATIVA"), { status: 400 })
  }

  return { nome, dbUser, dbPassword, dbConnectString, status, descricao: String(data.descricao ?? "").trim() || null }
}

export async function createOrganizacao(data) {
  const { nome, dbUser, dbPassword, dbConnectString, status, descricao } = validatePayload(data)
  const table = await getOrgsTable()
  const dbPasswordEnc = encryptPassword(dbPassword)
  const oracleSchema = await provisionOracleSchemaObjects({
    user: dbUser,
    password: dbPassword,
    connectString: dbConnectString,
  })
  const oracleViews = await provisionOracleViews({
    user: dbUser,
    password: dbPassword,
    connectString: dbConnectString,
  })

  await query(
    `INSERT INTO ${table} (nome, descricao, status, db_user, db_password_enc, db_connect_string)
     VALUES (:nome, :descricao, :status, :dbUser, :dbPasswordEnc, :dbConnectString)`,
    { nome, descricao, status, dbUser, dbPasswordEnc, dbConnectString }
  )

  const rows = await query(
    `SELECT id, nome, descricao, status, db_user, db_connect_string, criado_em, atualizado_em
     FROM ${table}
     WHERE criado_em = (SELECT MAX(criado_em) FROM ${table} WHERE nome = :nome AND db_user = :dbUser)
       AND nome = :nome AND db_user = :dbUser
       AND ROWNUM = 1`,
    { nome, dbUser }
  )

  return { ...normalizeRow(rows[0]), oracle_schema: oracleSchema, oracle_views: oracleViews }
}

export async function updateOrganizacao(id, data) {
  const table = await getOrgsTable()
  const existing = await query(
    `SELECT id, db_password_enc FROM ${table} WHERE id = :id`,
    { id: Number(id) }
  )

  if (!existing.length) {
    throw Object.assign(new Error("organizacao nao encontrada"), { status: 404 })
  }

  const { nome, dbUser, dbPassword, dbConnectString, status, descricao } = validatePayload({
    ...data,
    db_password: data.db_password || "placeholder",
  })

  const row = existing[0]
  const currentEnc = row.DB_PASSWORD_ENC ?? row.db_password_enc

  const dbPasswordEnc = data.db_password && String(data.db_password).trim()
    ? encryptPassword(String(data.db_password).trim())
    : currentEnc
  const dbPasswordToProvision = data.db_password && String(data.db_password).trim()
    ? String(data.db_password).trim()
    : decryptPassword(currentEnc)

  const oracleSchema = await provisionOracleSchemaObjects({
    user: dbUser,
    password: dbPasswordToProvision,
    connectString: dbConnectString,
  })
  const oracleViews = await provisionOracleViews({
    user: dbUser,
    password: dbPasswordToProvision,
    connectString: dbConnectString,
  })

  await query(
    `UPDATE ${table}
     SET nome = :nome,
         descricao = :descricao,
         status = :status,
         db_user = :dbUser,
         db_password_enc = :dbPasswordEnc,
         db_connect_string = :dbConnectString,
         atualizado_em = SYSDATE
     WHERE id = :id`,
    { nome, descricao, status, dbUser, dbPasswordEnc, dbConnectString, id: Number(id) }
  )

  const updated = await getOrganizacaoById(id)
  return { ...updated, oracle_schema: oracleSchema, oracle_views: oracleViews }
}

export async function deleteOrganizacao(id) {
  const table = await getOrgsTable()
  const existing = await query(
    `SELECT id, db_user, db_password_enc, db_connect_string FROM ${table} WHERE id = :id`,
    { id: Number(id) }
  )
  if (!existing.length) {
    throw Object.assign(new Error("organizacao nao encontrada"), { status: 404 })
  }
  const row = existing[0]
  const oracleCleanup = await dropOracleProvisionedViews({
    user: row.DB_USER ?? row.db_user,
    password: decryptPassword(row.DB_PASSWORD_ENC ?? row.db_password_enc),
    connectString: row.DB_CONNECT_STRING ?? row.db_connect_string,
  })

  await query(`DELETE FROM ${table} WHERE id = :id`, { id: Number(id) })
  return { message: "Organizacao removida com sucesso.", oracle_cleanup: oracleCleanup }
}

export async function testarConexaoOracle(db_user, db_password, db_connect_string) {
  const user = String(db_user ?? "").trim()
  const password = String(db_password ?? "").trim()
  const connectString = String(db_connect_string ?? "").trim()

  if (!user || !password || !connectString) {
    throw Object.assign(
      new Error("db_user, db_password e db_connect_string sao obrigatorios"),
      { status: 400 }
    )
  }

  let connection = null
  try {
    connection = await oracledb.getConnection({ user, password, connectString })
    await connection.execute("SELECT 1 FROM DUAL")
    return { sucesso: true, mensagem: "Conexao realizada com sucesso." }
  } catch (err) {
    const detail = String(err?.message ?? "").split("\n")[0]
    return { sucesso: false, mensagem: "Falha ao conectar.", detalhe: detail }
  } finally {
    if (connection) {
      try { await connection.close() } catch {}
    }
  }
}

export async function testarConexaoOrganizacaoSalva(id) {
  const table = await getOrgsTable()
  const rows = await query(
    `SELECT db_user, db_password_enc, db_connect_string FROM ${table} WHERE id = :id`,
    { id: Number(id) }
  )
  if (!rows.length) {
    throw Object.assign(new Error("organizacao nao encontrada"), { status: 404 })
  }
  const row = rows[0]
  const dbUser = row.DB_USER ?? row.db_user
  const dbPasswordEnc = row.DB_PASSWORD_ENC ?? row.db_password_enc
  const dbConnectString = row.DB_CONNECT_STRING ?? row.db_connect_string
  const dbPassword = decryptPassword(dbPasswordEnc)
  return testarConexaoOracle(dbUser, dbPassword, dbConnectString)
}
