import { maskDocumento } from "./kanbanCardService.js"
import { isRfvVendedorDisponivel } from "./kanbanQueries.js"
import { buildLojaInCondition, resolveLojaColumnName } from "../lojaScopeService.js"

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function texto(value) {
  return value === null || value === undefined ? null : String(value).trim()
}

/**
 * "Carteira" do vendedor = UNION de sk_cliente presentes em qualquer um dos fatos que carregam
 * sk_vendedor (DIM_CLIENTE nao tem FK direta de vendedor).
 */
export async function buscarClientesCarteira({ dbQuery, empresaId, skVendedor, termo, lojaScope = null }) {
  const termoLimpo = String(termo ?? "").trim()
  if (!termoLimpo) return []

  const qNumerico = termoLimpo.replace(/\D/g, "")
  const rfvDisponivel = await isRfvVendedorDisponivel(dbQuery, empresaId)
  const vendasLojaColumn = await resolveLojaColumnName(empresaId, "FATO_VENDAS_LUCRATIVIDADE")
  const vendasLojaCondition = buildLojaInCondition(vendasLojaColumn, lojaScope, "kanban_busca_venda_loja")
  const cockpitLojaColumn = await resolveLojaColumnName(empresaId, "FATO_COCKPIT")
  const cockpitLojaCondition = buildLojaInCondition(cockpitLojaColumn, lojaScope, "kanban_busca_cockpit_loja")
  const binds = {
    sk_vendedor: skVendedor,
    q_texto: termoLimpo,
    ...vendasLojaCondition.binds,
    ...cockpitLojaCondition.binds,
  }

  const condicaoNumerica = qNumerico
    ? `REGEXP_REPLACE(NVL(cli.cpf, ''), '[^0-9]', '') = :q_numerico
       OR REGEXP_REPLACE(NVL(cli.cnpj, ''), '[^0-9]', '') = :q_numerico
       OR `
    : ""
  const ordemCase = qNumerico
    ? `CASE
         WHEN REGEXP_REPLACE(NVL(cli.cpf, ''), '[^0-9]', '') = :q_numerico THEN 1
         WHEN REGEXP_REPLACE(NVL(cli.cnpj, ''), '[^0-9]', '') = :q_numerico THEN 2
         WHEN UPPER(cli.nome_cliente) = UPPER(:q_texto) THEN 3
         ELSE 4
       END`
    : `CASE WHEN UPPER(cli.nome_cliente) = UPPER(:q_texto) THEN 1 ELSE 2 END`

  if (qNumerico) binds.q_numerico = qNumerico

  const rows = await dbQuery(
    `
    WITH carteira AS (
      ${rfvDisponivel ? "SELECT sk_cliente FROM DM_VENDAS.FATO_RFV_VENDEDOR WHERE sk_vendedor = :sk_vendedor UNION" : ""}
      SELECT sk_cliente FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE WHERE sk_vendedor = :sk_vendedor AND ${vendasLojaCondition.clause}
      UNION
      SELECT sk_cliente FROM DM_VENDAS.FATO_COCKPIT WHERE sk_vendedor = :sk_vendedor AND ${cockpitLojaCondition.clause}
    )
    SELECT *
    FROM (
      SELECT
        cli.sk_cliente,
        cli.nome_cliente,
        cli.cpf,
        cli.cnpj,
        cli.tipo_cliente,
        card.id AS kanban_card_id,
        card.arquivado AS kanban_card_arquivado
      FROM carteira cart
      JOIN DM_VENDAS.DIM_CLIENTE cli ON cli.sk_cliente = cart.sk_cliente
      LEFT JOIN CRM_KANBAN_CARD card ON card.sk_cliente = cli.sk_cliente AND card.sk_vendedor = :sk_vendedor
      WHERE ${condicaoNumerica}UPPER(cli.nome_cliente) LIKE '%' || UPPER(:q_texto) || '%'
      ORDER BY ${ordemCase}, cli.nome_cliente
    )
    FETCH FIRST 20 ROWS ONLY
    `,
    binds
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      sk_cliente: item.sk_cliente,
      nome_cliente: texto(item.nome_cliente),
      cpf: maskDocumento(item.cpf),
      cnpj: maskDocumento(item.cnpj),
      tipo_cliente: texto(item.tipo_cliente),
      jaNoKanban: item.kanban_card_id != null && item.kanban_card_arquivado !== "S",
    }
  })
}
