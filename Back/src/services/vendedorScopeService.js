import { query } from "../db/oracle.js"
import {
  getRankingVendorsDayViewName,
  getRankingVendorsViewName,
} from "../db/oracleObjectNames.js"

function normalizarLinha(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

export async function resolverEscopoVendedor(codigoRecebido) {
  const [rankingView, rankingDayView] = await Promise.all([
    getRankingVendorsViewName(),
    getRankingVendorsDayViewName(),
  ])
  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM ${rankingView}
      WHERE sk_vendedor = :codigo OR vendedor_id = :codigo
      UNION ALL
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM ${rankingDayView}
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
