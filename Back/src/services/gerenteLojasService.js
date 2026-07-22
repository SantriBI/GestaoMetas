import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { queryTenantByEmpresaId } from "../db/mysql-tenants.js"

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

/**
 * Lista todas as lojas cadastradas em DIM_EMPRESAS do tenant, para popular os checkboxes
 * de liberacao manual no cadastro/edicao de gerente.
 */
export async function listDimEmpresas(empresaId) {
  const rows = await queryOracleByEmpresaId(
    empresaId,
    `
    SELECT EMPRESA_ID AS empresa_id, NOME_RESUMIDO AS nome_resumido
    FROM DIM_EMPRESAS
    WHERE NOME_RESUMIDO IS NOT NULL
    ORDER BY NOME_RESUMIDO
    `
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      empresaAcesso: String(item.empresa_id),
      nomeResumido: String(item.nome_resumido),
    }
  })
}

/**
 * Resolve nome_resumido e sk_empresas (dominio usado nas tabelas de fato) para um conjunto de
 * codigos EMPRESA_ID/EMPRESA_ACESSO, via DIM_EMPRESAS. Usado para "completar" as lojas liberadas
 * manualmente com os mesmos campos que getLojasAcessoByCpf ja devolve para as lojas automaticas.
 */
export async function resolveLojasByCodigos(empresaId, codigos) {
  const unique = [...new Set((codigos ?? []).map((c) => String(c ?? "").trim()).filter(Boolean))]
  if (!unique.length) return []

  const binds = {}
  const placeholders = unique.map((codigo, index) => {
    const key = `codigo_${index}`
    binds[key] = codigo
    return `:${key}`
  })

  const rows = await queryOracleByEmpresaId(
    empresaId,
    `
    SELECT EMPRESA_ID AS empresa_id, NOME_RESUMIDO AS nome_resumido, SK_EMPRESAS AS sk_empresas
    FROM DIM_EMPRESAS
    WHERE TO_CHAR(EMPRESA_ID) IN (${placeholders.join(", ")})
    `,
    binds
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      empresaAcesso: String(item.empresa_id),
      nomeResumido: item.nome_resumido ? String(item.nome_resumido) : String(item.empresa_id),
      skEmpresas: item.sk_empresas !== null && item.sk_empresas !== undefined ? String(item.sk_empresas) : null,
      gerente: true,
    }
  })
}

/**
 * Lojas liberadas manualmente por um admin para um gerente (tabela gerente_lojas_liberadas,
 * MySQL do tenant). Nao inclui as lojas automaticas (GERENTE='S' no Oracle) - essas vem sempre
 * de getLojasAcessoByCpf/getLojasForRole.
 */
export async function getLojasManuaisPorUsuario(empresaId, idUsuario) {
  if (!empresaId || !idUsuario) return []

  const rows = await queryTenantByEmpresaId(
    empresaId,
    "SELECT empresa_acesso, nome_resumido FROM gerente_lojas_liberadas WHERE id_usuario = ? ORDER BY nome_resumido",
    [idUsuario]
  )

  return rows.map((row) => ({
    empresaAcesso: String(row.empresa_acesso),
    nomeResumido: row.nome_resumido ? String(row.nome_resumido) : String(row.empresa_acesso),
  }))
}

/**
 * Substitui o conjunto de lojas liberadas manualmente para um gerente. `lojas` e a lista completa
 * de codigos EMPRESA_ID marcados no formulario (padrao + extras) - guardar o padrao junto e
 * inofensivo, pois getLojasForRole faz a uniao por codigo na leitura.
 */
export async function replaceLojasManuais({ empresaId, idUsuario, lojas }) {
  const codigos = [...new Set((lojas ?? []).map((l) => String(l ?? "").trim()).filter(Boolean))]

  await queryTenantByEmpresaId(empresaId, "DELETE FROM gerente_lojas_liberadas WHERE id_usuario = ?", [idUsuario])

  if (!codigos.length) return []

  const resolved = await resolveLojasByCodigos(empresaId, codigos).catch(() => [])
  const nomeByCodigo = new Map(resolved.map((l) => [l.empresaAcesso, l.nomeResumido]))

  for (const codigo of codigos) {
    await queryTenantByEmpresaId(
      empresaId,
      "INSERT INTO gerente_lojas_liberadas (id_usuario, empresa_acesso, nome_resumido) VALUES (?, ?, ?)",
      [idUsuario, codigo, nomeByCodigo.get(codigo) ?? null]
    )
  }

  return codigos
}
