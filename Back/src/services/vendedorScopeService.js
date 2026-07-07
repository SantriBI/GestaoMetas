import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"

function normalizarLinha(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

export async function resolverEscopoVendedor(codigoRecebido, empresaId) {
  if (!empresaId) {
    throw new Error("empresa_id e obrigatorio para resolver o vendedor.")
  }

  const rows = await queryOracleByEmpresaId(
    empresaId,
    `
    SELECT *
    FROM (
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM VW_RANKING_VENDEDORES
      WHERE sk_vendedor = :codigo OR vendedor_id = :codigo
      UNION ALL
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM VW_RANKING_VENDEDORES_DIA
      WHERE sk_vendedor = :codigo OR vendedor_id = :codigo
    )
    WHERE ROWNUM = 1
    `,
    { codigo: codigoRecebido }
  )

  const item = normalizarLinha(rows[0] ?? {})

  return {
    skVendedor: item.sk_vendedor ?? codigoRecebido,
    vendedorId: item.vendedor_id ?? codigoRecebido,
    nomeVendedor: item.nome_vendedor ?? null,
  }
}
