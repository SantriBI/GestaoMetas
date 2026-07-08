import centralPool from "../db/mysql.js"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { queryTenantByEmpresaId } from "../db/mysql-tenants.js"

function normalizeEmpresaId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function normalizeOrg(row) {
  return {
    id_organizacao: row.id_organizacao,
    nome: row.nome,
    codigo: row.codigo ?? null,
    descricao: row.descricao ?? null,
    db_name: row.db_name ?? null,
  }
}

export async function listSystemManagerOrganizations(idUsuario) {
  const [rows] = await centralPool.query(
    `
    SELECT
      org.id_organizacao,
      org.nome,
      org.codigo,
      org.descricao,
      org.db_name
    FROM gerente_sistema_organizacoes acesso
    JOIN organizacoes_auth org
      ON org.id_organizacao = acesso.empresa_id
    WHERE acesso.id_usuario = ?
      AND acesso.ativo = 'S'
      AND org.ativo = 'S'
    ORDER BY org.nome
    `,
    [idUsuario]
  )

  return rows.map(normalizeOrg)
}

export async function userCanAccessSystemManagerOrganization(idUsuario, empresaId) {
  const normalizedEmpresaId = normalizeEmpresaId(empresaId)
  if (!idUsuario || !normalizedEmpresaId) return false

  const [rows] = await centralPool.query(
    `
    SELECT 1
    FROM gerente_sistema_organizacoes acesso
    JOIN organizacoes_auth org
      ON org.id_organizacao = acesso.empresa_id
    WHERE acesso.id_usuario = ?
      AND acesso.empresa_id = ?
      AND acesso.ativo = 'S'
      AND org.ativo = 'S'
    LIMIT 1
    `,
    [idUsuario, normalizedEmpresaId]
  )

  return rows.length > 0
}

export async function assertSystemManagerOrganizationAccess(idUsuario, empresaId) {
  const allowed = await userCanAccessSystemManagerOrganization(idUsuario, empresaId)
  if (!allowed) {
    const error = new Error("Organizacao nao liberada para este Gerente de Sistemas.")
    error.status = 403
    throw error
  }
}

async function listTenantSellers(empresaId) {
  try {
    const rows = await queryTenantByEmpresaId(
      empresaId,
      `
      SELECT sk_vendedor, nome, nome_completo, login
      FROM usuarios_auth
      WHERE role = 'VENDEDOR'
        AND ativo = 'S'
        AND sk_vendedor IS NOT NULL
      ORDER BY COALESCE(nome_completo, nome, login)
      `
    )

    return rows.map((row) => ({
      sk_vendedor: row.sk_vendedor,
      nome: row.nome_completo ?? row.nome ?? row.login ?? `Vendedor ${row.sk_vendedor}`,
      origem: "tenant",
    }))
  } catch {
    return []
  }
}

async function listOracleSellers(empresaId) {
  try {
    const rows = await queryOracleByEmpresaId(
      empresaId,
      `
      SELECT sk_vendedor, nome_vendedor
      FROM VW_RANKING_VENDEDORES
      WHERE sk_vendedor IS NOT NULL
      ORDER BY nome_vendedor
      `
    )

    return rows.map((row) => ({
      sk_vendedor: row.SK_VENDEDOR ?? row.sk_vendedor,
      nome: row.NOME_VENDEDOR ?? row.nome_vendedor ?? `Vendedor ${row.SK_VENDEDOR ?? row.sk_vendedor}`,
      origem: "oracle",
    }))
  } catch {
    return []
  }
}

export async function listSystemManagerSellers({ idUsuario, empresaId }) {
  await assertSystemManagerOrganizationAccess(idUsuario, empresaId)

  const [tenantSellers, oracleSellers] = await Promise.all([
    listTenantSellers(empresaId),
    listOracleSellers(empresaId),
  ])

  const bySellerCode = new Map()
  for (const seller of [...tenantSellers, ...oracleSellers]) {
    const key = String(seller.sk_vendedor ?? "").trim()
    if (!key || bySellerCode.has(key)) continue
    bySellerCode.set(key, seller)
  }

  return [...bySellerCode.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
}

export async function replaceSystemManagerOrganizations({ idUsuario, empresaIds }) {
  const normalizedIds = [...new Set((empresaIds ?? []).map(normalizeEmpresaId).filter(Boolean))]

  const conn = await centralPool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query("DELETE FROM gerente_sistema_organizacoes WHERE id_usuario = ?", [idUsuario])

    for (const empresaId of normalizedIds) {
      await conn.query(
        `
        INSERT INTO gerente_sistema_organizacoes (id_usuario, empresa_id, ativo)
        VALUES (?, ?, 'S')
        `,
        [idUsuario, empresaId]
      )
    }

    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }

  return normalizedIds
}
