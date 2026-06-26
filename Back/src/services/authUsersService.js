import bcrypt from "bcrypt"
import centralPool from "../db/mysql.js"
import { queryTenantByEmpresaId } from "../db/mysql-tenants.js"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"

function normalizeCpf(value) {
  return String(value ?? "").replace(/\D/g, "")
}

function isCpfLike(value) {
  return /^\d{11}$/.test(normalizeCpf(value))
}

function pickColumn(columns, candidates) {
  const available = new Set(columns.map((column) => String(column).toUpperCase()))
  return candidates.find((candidate) => available.has(candidate)) ?? null
}

function needsResolvedName(user) {
  const nome = String(user?.nome ?? user?.nome_completo ?? "").trim()
  return !nome || isCpfLike(nome) || normalizeCpf(nome) === normalizeCpf(user?.login) || normalizeCpf(nome) === normalizeCpf(user?.cpf)
}

function normalizeRow(row, source = "central", empresaId = null) {
  if (!row) return null
  return {
    id_usuario: row.id_usuario,
    nome: row.nome ?? row.nome_completo ?? null,
    nome_completo: row.nome_completo ?? row.nome ?? null,
    login: row.login,
    senha_hash: row.senha_hash,
    role: row.role,
    empresa_id: row.empresa_id ?? empresaId ?? null,
    sk_vendedor: row.sk_vendedor ?? null,
    cpf: row.cpf ?? null,
    ativo: row.ativo,
    senha_temporaria: row.senha_temporaria ?? "N",
    foto_url: row.foto_url ?? null,
    ultimo_login: row.ultimo_login ?? null,
    token_version: Number(row.token_version ?? 0),
    vendedor_id: row.vendedor_id ?? null,
    funcionario_id: row.funcionario_id ?? null,
    source,
  }
}

export async function findEmployeeNameByCpf(empresaId, cpf) {
  const cpfNorm = normalizeCpf(cpf)
  if (!empresaId || cpfNorm.length !== 11) return null

  try {
    const columnsRows = await queryOracleByEmpresaId(
      empresaId,
      `
      SELECT column_name
      FROM all_tab_columns
      WHERE table_name = 'FATO_FUNCIONARIOS_ACESSOS'
      `
    )
    const columns = columnsRows.map((row) => row.COLUMN_NAME ?? row.column_name).filter(Boolean)
    const nomeColumn = pickColumn(columns, [
      "NOME_FUNCIONARIO",
      "NOME_COMPLETO",
      "NOME_COLABORADOR",
      "COLABORADOR",
      "FUNCIONARIO",
      "NOME_PESSOA",
      "NOME",
    ])
    const cpfColumn = pickColumn(columns, ["CPF_CNPJ_SEM_PONTOS", "CPF", "CPF_CNPJ"])

    if (!nomeColumn || !cpfColumn) return null

    const rows = await queryOracleByEmpresaId(
      empresaId,
      `
      SELECT ${nomeColumn} AS nome
      FROM fato_funcionarios_acessos
      WHERE REGEXP_REPLACE(${cpfColumn}, '[^0-9]', '') = :cpf
        AND ${nomeColumn} IS NOT NULL
        AND ROWNUM = 1
      `,
      { cpf: cpfNorm }
    )

    return String(rows[0]?.NOME ?? rows[0]?.nome ?? "").trim() || null
  } catch {
    return null
  }
}

export async function resolveAuthUserDisplayName(user) {
  if (!user || !needsResolvedName(user)) return user

  const resolvedName = await findEmployeeNameByCpf(user.empresa_id, user.cpf ?? user.login)
  if (!resolvedName) return user

  try {
    if (user.source === "tenant") {
      await queryTenantByEmpresaId(
        user.empresa_id,
        "UPDATE usuarios_auth SET nome = ?, nome_completo = ? WHERE id_usuario = ?",
        [resolvedName, resolvedName, user.id_usuario]
      )
    } else {
      await centralPool.query(
        "UPDATE usuarios_auth SET nome = ?, nome_completo = ? WHERE id_usuario = ?",
        [resolvedName, resolvedName, user.id_usuario]
      )
    }
  } catch {}

  return {
    ...user,
    nome: resolvedName,
    nome_completo: resolvedName,
  }
}

async function listActiveTenants() {
  const [rows] = await centralPool.query(
    "SELECT id_organizacao FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL ORDER BY id_organizacao"
  )
  return rows.map((row) => row.id_organizacao).filter(Boolean)
}

async function findCentralUserById(idUsuario) {
  const [rows] = await centralPool.query(
    "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
    [idUsuario]
  )
  return rows[0] ? normalizeRow(rows[0], "central") : null
}

async function findTenantUserById(idUsuario, empresaId) {
  const rows = await queryTenantByEmpresaId(
    empresaId,
    "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
    [idUsuario]
  )
  return rows[0] ? normalizeRow(rows[0], "tenant", empresaId) : null
}

export async function findAuthUserById(idUsuario, empresaId = null) {
  if (!idUsuario) return null

  if (empresaId) {
    try {
      const tenantUser = await findTenantUserById(idUsuario, empresaId)
      if (tenantUser) return tenantUser
    } catch {}
  }

  const centralUser = await findCentralUserById(idUsuario)
  if (centralUser) return centralUser

  for (const tenantEmpresaId of await listActiveTenants()) {
    try {
      const tenantUser = await findTenantUserById(idUsuario, tenantEmpresaId)
      if (tenantUser) return tenantUser
    } catch {}
  }

  return null
}

export async function findAuthUserBySkVendedor(skVendedor, empresaId = null) {
  if (!skVendedor) return null

  if (empresaId) {
    try {
      const rows = await queryTenantByEmpresaId(
        empresaId,
        "SELECT * FROM usuarios_auth WHERE sk_vendedor = ? AND ativo = 'S' LIMIT 1",
        [skVendedor]
      )
      if (rows[0]) return normalizeRow(rows[0], "tenant", empresaId)
    } catch {}
  }

  const [centralRows] = await centralPool.query(
    "SELECT * FROM usuarios_auth WHERE sk_vendedor = ? AND ativo = 'S' LIMIT 1",
    [skVendedor]
  )
  if (centralRows[0]) return normalizeRow(centralRows[0], "central")

  for (const tenantEmpresaId of await listActiveTenants()) {
    try {
      const rows = await queryTenantByEmpresaId(
        tenantEmpresaId,
        "SELECT * FROM usuarios_auth WHERE sk_vendedor = ? AND ativo = 'S' LIMIT 1",
        [skVendedor]
      )
      if (rows[0]) return normalizeRow(rows[0], "tenant", tenantEmpresaId)
    } catch {}
  }

  return null
}

export async function findAuthUserForPrivateMessage({ idUsuario, empresaId }) {
  if (!idUsuario || !empresaId) return null

  try {
    const tenantUser = await findTenantUserById(idUsuario, empresaId)
    if (tenantUser) return tenantUser
  } catch {}

  const [rows] = await centralPool.query(
    "SELECT * FROM usuarios_auth WHERE id_usuario = ? AND empresa_id = ? LIMIT 1",
    [idUsuario, empresaId]
  )
  return rows[0] ? normalizeRow(rows[0], "central") : null
}

export async function searchAuthUsersForPrivateMessage({ empresaId, usuarioId, termo, limit = 10 }) {
  const search = `%${String(termo ?? "").trim()}%`
  if (!empresaId || !String(termo ?? "").trim()) return []

  const sql = `
    SELECT id_usuario, nome, nome_completo, login, role, empresa_id, sk_vendedor, ativo
    FROM usuarios_auth
    WHERE ativo = 'S'
      AND id_usuario <> ?
      AND role IN ('VENDEDOR', 'GERENTE')
      AND (
        UPPER(COALESCE(nome, nome_completo, '')) LIKE UPPER(?)
        OR UPPER(login) LIKE UPPER(?)
        OR UPPER(role) LIKE UPPER(?)
      )
    ORDER BY COALESCE(nome, nome_completo, login)
    LIMIT ?
  `

  try {
    const rows = await queryTenantByEmpresaId(empresaId, sql, [usuarioId, search, search, search, limit])
    if (rows.length) return rows.map((row) => normalizeRow(row, "tenant", empresaId))
  } catch {}

  const [rows] = await centralPool.query(
    sql.replace("WHERE ativo = 'S'", "WHERE ativo = 'S' AND empresa_id = ?"),
    [empresaId, usuarioId, search, search, search, limit]
  )
  return rows.map((row) => normalizeRow(row, "central"))
}

export async function updateAuthUserPhoto({ idUsuario, empresaId = null, fotoUrl }) {
  const user = await findAuthUserById(idUsuario, empresaId)
  if (!user) return null

  if (user.source === "tenant") {
    await queryTenantByEmpresaId(
      user.empresa_id,
      "UPDATE usuarios_auth SET foto_url = ? WHERE id_usuario = ?",
      [fotoUrl, idUsuario]
    )
  } else {
    await centralPool.query(
      "UPDATE usuarios_auth SET foto_url = ? WHERE id_usuario = ?",
      [fotoUrl, idUsuario]
    )
  }

  return { ...user, foto_url: fotoUrl }
}

export async function updateAuthUserPassword({ idUsuario, empresaId = null, senhaAtual, novaSenha }) {
  const user = await findAuthUserById(idUsuario, empresaId)
  if (!user) return { ok: false, status: 404, error: "Usuario nao encontrado" }

  const senhaOk = await bcrypt.compare(senhaAtual, user.senha_hash ?? "")
  if (!senhaOk) return { ok: false, status: 401, error: "Senha atual invalida" }

  const novaSenhaHash = await bcrypt.hash(novaSenha, 10)
  if (user.source === "tenant") {
    await queryTenantByEmpresaId(
      user.empresa_id,
      "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
      [novaSenhaHash, idUsuario]
    )
  } else {
    await centralPool.query(
      "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
      [novaSenhaHash, idUsuario]
    )
  }

  return { ok: true }
}

export function normalizePublicManagedUser(row, empresaId = null, organizacaoNome = null) {
  const user = normalizeRow(row, "tenant", empresaId)
  return {
    id_usuario: user.id_usuario,
    nome: user.nome,
    nome_completo: user.nome_completo,
    login: user.login,
    role: user.role,
    empresa_id: user.empresa_id,
    organizacao_nome: organizacaoNome,
    sk_vendedor: user.sk_vendedor,
    cpf: user.cpf,
    ativo: user.ativo,
    ultimo_login: row.ultimo_login ?? null,
  }
}

export async function listManagedUsersByEmpresaId(empresaId, { roles = null, organizacaoNome = null } = {}) {
  if (!empresaId) return []

  const allowedRoles = Array.isArray(roles) && roles.length ? roles : ["GERENTE", "VENDEDOR", "PAINEL", "INDUSTRIA"]
  const placeholders = allowedRoles.map(() => "?").join(",")
  const rows = await queryTenantByEmpresaId(
    empresaId,
    `
    SELECT id_usuario, nome, nome_completo, login, role, empresa_id, sk_vendedor, cpf, ativo, ultimo_login
    FROM usuarios_auth
    WHERE role IN (${placeholders})
    ORDER BY role, COALESCE(nome, nome_completo, login)
    `,
    allowedRoles
  )

  const resolvedUsers = await Promise.all(
    rows.map((row) => resolveAuthUserDisplayName(normalizeRow(row, "tenant", empresaId)))
  )

  return resolvedUsers.map((user) => normalizePublicManagedUser(user, empresaId, organizacaoNome))
}

export async function findManagedUserById({ idUsuario, empresaId }) {
  if (!idUsuario || !empresaId) return null
  const rows = await queryTenantByEmpresaId(
    empresaId,
    "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
    [idUsuario]
  )
  return rows[0] ? normalizeRow(rows[0], "tenant", empresaId) : null
}

export async function setManagedUserPassword({ idUsuario, empresaId, novaSenha }) {
  if (!idUsuario || !empresaId) return false
  const senhaHash = await bcrypt.hash(novaSenha, 10)
  const result = await queryTenantByEmpresaId(
    empresaId,
    "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N', token_version = token_version + 1 WHERE id_usuario = ?",
    [senhaHash, idUsuario]
  )
  return Number(result?.affectedRows ?? 0) > 0
}

export async function setManagedUserActive({ idUsuario, empresaId, ativo }) {
  if (!idUsuario || !empresaId) return false
  const result = await queryTenantByEmpresaId(
    empresaId,
    "UPDATE usuarios_auth SET ativo = ?, token_version = token_version + 1 WHERE id_usuario = ?",
    [ativo, idUsuario]
  )
  return Number(result?.affectedRows ?? 0) > 0
}

export async function revokeManagedUserSession({ idUsuario, empresaId }) {
  if (!idUsuario || !empresaId) return false
  const result = await queryTenantByEmpresaId(
    empresaId,
    "UPDATE usuarios_auth SET token_version = token_version + 1 WHERE id_usuario = ?",
    [idUsuario]
  )
  return Number(result?.affectedRows ?? 0) > 0
}

export async function revokeManagedUsersByEmpresaId({ empresaId, roles = null, excludeUserId = null }) {
  if (!empresaId) return 0
  const allowedRoles = Array.isArray(roles) && roles.length ? roles : ["GERENTE", "VENDEDOR", "PAINEL", "INDUSTRIA"]
  const placeholders = allowedRoles.map(() => "?").join(",")
  const params = [...allowedRoles]
  let excludeSql = ""

  if (excludeUserId) {
    excludeSql = " AND id_usuario <> ?"
    params.push(excludeUserId)
  }

  const result = await queryTenantByEmpresaId(
    empresaId,
    `UPDATE usuarios_auth SET token_version = token_version + 1 WHERE role IN (${placeholders})${excludeSql}`,
    params
  )
  return Number(result?.affectedRows ?? 0)
}
