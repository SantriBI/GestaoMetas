import { queryTenantByEmpresaId } from "../db/mysql-tenants.js"

function normalizeSellerCode(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const numberValue = Number(raw)
  return Number.isFinite(numberValue) && raw !== "" ? String(numberValue) : raw
}

export async function getAllowedSellerCodesByEmpresaId(empresaId) {
  if (!empresaId) return null

  const rows = await queryTenantByEmpresaId(
    empresaId,
    `
    SELECT DISTINCT sk_vendedor
    FROM usuarios_auth
    WHERE ativo = 'S'
      AND role = 'VENDEDOR'
      AND sk_vendedor IS NOT NULL
    `
  )

  return new Set(rows.map((row) => normalizeSellerCode(row.sk_vendedor)).filter(Boolean))
}

export function isSellerAllowed(allowedSellerCodes, skVendedor) {
  if (!allowedSellerCodes) return true
  const normalized = normalizeSellerCode(skVendedor)
  return !!normalized && allowedSellerCodes.has(normalized)
}

export function filterRowsByAllowedSeller(rows, allowedSellerCodes, key = "sk_vendedor") {
  if (!allowedSellerCodes) return rows
  return rows.filter((row) => {
    const value = row?.[key] ?? row?.[key.toUpperCase()] ?? row?.[key.toLowerCase()]
    return isSellerAllowed(allowedSellerCodes, value)
  })
}

export function buildSellerInCondition(columnName, allowedSellerCodes, bindPrefix = "seller_scope") {
  if (!allowedSellerCodes) return { clause: "1 = 1", binds: {} }

  const values = [...allowedSellerCodes]
  if (!values.length) return { clause: "1 = 0", binds: {} }

  const binds = {}
  const placeholders = values.map((value, index) => {
    const key = `${bindPrefix}_${index}`
    const numberValue = Number(value)
    binds[key] = Number.isFinite(numberValue) ? numberValue : value
    return `:${key}`
  })

  return {
    clause: `${columnName} IN (${placeholders.join(", ")})`,
    binds,
  }
}
