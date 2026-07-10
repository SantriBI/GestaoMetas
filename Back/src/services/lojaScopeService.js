import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"

const LOJA_COLUMN_CANDIDATES = ["SK_EMPRESA", "SK_EMPRESAS"]
const lojaColumnCache = new Map()

/**
 * Descobre se a tabela/view usa SK_EMPRESA ou SK_EMPRESAS como coluna de loja (nome nao
 * padronizado no Oracle deste cliente). Resolve por empresa_id porque cada tenant tem sua
 * propria conexao Oracle. So cacheia um resultado positivo: se a introspeccao falhar ou nao
 * achar nenhuma das candidatas, tentamos de novo na proxima chamada em vez de fixar "sem coluna".
 */
export async function resolveLojaColumnName(empresaId, tableName) {
  const bareTableName = String(tableName).split(".").pop().toUpperCase()
  const cacheKey = `${empresaId}:${bareTableName}`

  if (lojaColumnCache.has(cacheKey)) {
    return lojaColumnCache.get(cacheKey)
  }

  const rows = await queryOracleByEmpresaId(
    empresaId,
    `
    SELECT column_name
    FROM all_tab_columns
    WHERE table_name = :table_name
      AND column_name IN ('SK_EMPRESA', 'SK_EMPRESAS')
    `,
    { table_name: bareTableName }
  )

  const available = new Set(rows.map((row) => String(row.COLUMN_NAME ?? row.column_name ?? "").toUpperCase()))
  const resolved = LOJA_COLUMN_CANDIDATES.find((candidate) => available.has(candidate)) ?? null

  if (resolved) {
    lojaColumnCache.set(cacheKey, resolved)
  }

  return resolved
}

/**
 * Monta a clausula IN (...) de loja para uma query, ja com os binds. Espelha buildSellerInCondition
 * de tenantSellerScope.js. `lojaScope` vem de getScopedLojaScope (requestScope.js): quando
 * lojaScope.applies e false, nao ha filtro de loja a aplicar (usuario/tenant sem mapeamento de
 * loja ainda, ou coluna de loja ausente nesta tabela) e a clausula fica neutra (1 = 1).
 */
export function buildLojaInCondition(columnName, lojaScope, bindPrefix = "loja_scope") {
  if (!columnName || !lojaScope?.applies) {
    return { clause: "1 = 1", binds: {} }
  }

  const values = lojaScope.lojaIds ?? []
  if (!values.length) {
    return { clause: "1 = 0", binds: {} }
  }

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
