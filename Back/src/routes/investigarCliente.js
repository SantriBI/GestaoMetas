import express from "express"
import { query } from "../db/oracle.js"

const router = express.Router()

function normalizarLinha(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  )
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

router.get("/investigar-cliente", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim()

    if (!q) {
      return res.status(400).json({ error: "Informe CPF, CNPJ ou nome do cliente" })
    }

    const qNumerico = q.replace(/\D/g, "")

    const clienteRows = await query(
      `
      SELECT *
      FROM (
        SELECT
          sk_cliente,
          nome_cliente,
          cpf,
          cnpj,
          tipo_cliente,
          cliente_desde,
          nome_grupo
        FROM DM_VENDAS.DIM_CLIENTE
        WHERE REGEXP_REPLACE(NVL(cpf, ''), '[^0-9]', '') = :qNumerico
           OR REGEXP_REPLACE(NVL(cnpj, ''), '[^0-9]', '') = :qNumerico
           OR UPPER(nome_cliente) LIKE '%' || UPPER(:qTexto) || '%'
        ORDER BY
          CASE
            WHEN REGEXP_REPLACE(NVL(cpf, ''), '[^0-9]', '') = :qNumerico THEN 1
            WHEN REGEXP_REPLACE(NVL(cnpj, ''), '[^0-9]', '') = :qNumerico THEN 2
            WHEN UPPER(nome_cliente) = UPPER(:qTexto) THEN 3
            ELSE 4
          END,
          nome_cliente
      )
      FETCH FIRST 1 ROWS ONLY
      `,
      {
        qTexto: q,
        qNumerico
      }
    )

    if (!clienteRows.length) {
      return res.status(404).json({ error: "Cliente não encontrado" })
    }

    const cliente = normalizarLinha(clienteRows[0])
    const sk_cliente = cliente.sk_cliente

    const [rfvRows, financeiroRows, ultimaVendaRows, topProdutosRows, topCategoriasRows, ultimasComprasRows] =
      await Promise.all([
        query(
          `
          SELECT
            classificacao,
            recencia,
            frequencia,
            valor
          FROM DM_VENDAS.FATO_RFV_CLIENTE
          WHERE sk_cliente = :sk_cliente
          FETCH FIRST 1 ROWS ONLY
          `,
          { sk_cliente }
        ),
        query(
          `
          WITH base AS (
            SELECT
              CASE
                WHEN tipo = 'DEV' THEN NVL(valor_liquido_item, 0) * -1
                ELSE NVL(valor_liquido_item, 0)
              END AS faturamento_item,
              orcamento_id,
              sk_dt_fechamento
            FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE
            WHERE sk_cliente = :sk_cliente
          )
          SELECT
            NVL(SUM(faturamento_item), 0) AS total_gasto,
            COUNT(DISTINCT orcamento_id) AS total_compras,
            ROUND(
              CASE
                WHEN COUNT(DISTINCT orcamento_id) = 0 THEN 0
                ELSE SUM(faturamento_item) / COUNT(DISTINCT orcamento_id)
              END,
              2
            ) AS ticket_medio,
            MAX(sk_dt_fechamento) AS ultima_compra
          FROM base
          `,
          { sk_cliente }
        ),
        query(
          `
          SELECT
            v.sk_cliente,
            REGEXP_SUBSTR(
              TRIM(SUBSTR(d.nome_vendedor, 1, INSTR(d.nome_vendedor || '(', '(') - 1)),
              '^\\S+'
            )
            || ' ' ||
            REGEXP_SUBSTR(
              TRIM(SUBSTR(d.nome_vendedor, 1, INSTR(d.nome_vendedor || '(', '(') - 1)),
              '\\S+$'
            ) AS nome_vendedor,
            MAX(v.sk_dt_recebimento) AS data_ultima_compra
          FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE v
          LEFT JOIN DM_VENDAS.DIM_VENDEDOR d
            ON v.sk_vendedor = d.sk_vendedor
          WHERE v.sk_cliente = :sk_cliente
          GROUP BY
            v.sk_cliente,
            d.nome_vendedor
          ORDER BY data_ultima_compra DESC
          FETCH FIRST 1 ROWS ONLY
          `,
          { sk_cliente }
        ),
        query(
          `
          SELECT
            p.nome,
            SUM(f.quantidade_item) AS quantidade,
            SUM(
              CASE
                WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
                ELSE NVL(f.valor_liquido_item, 0)
              END
            ) AS valor
          FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
          JOIN DM_VENDAS.DIM_PRODUTOS p
            ON p.sk_produto = f.sk_produto
          WHERE f.sk_cliente = :sk_cliente
          GROUP BY p.nome
          ORDER BY valor DESC
          FETCH FIRST 5 ROWS ONLY
          `,
          { sk_cliente }
        ),
        query(
          `
          SELECT
            p.nome_pai_nivel1 AS grupo,
            SUM(
              CASE
                WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
                ELSE NVL(f.valor_liquido_item, 0)
              END
            ) AS valor
          FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
          JOIN DM_VENDAS.DIM_PRODUTOS p
            ON p.sk_produto = f.sk_produto
          WHERE f.sk_cliente = :sk_cliente
          GROUP BY p.nome_pai_nivel1
          ORDER BY valor DESC
          FETCH FIRST 5 ROWS ONLY
          `,
          { sk_cliente }
        ),
        query(
          `
          SELECT
            p.nome,
            f.quantidade_item,
            f.sk_dt_fechamento
          FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
          JOIN DM_VENDAS.DIM_PRODUTOS p
            ON p.sk_produto = f.sk_produto
          WHERE f.sk_cliente = :sk_cliente
          ORDER BY f.sk_dt_fechamento DESC
          FETCH FIRST 3 ROWS ONLY
          `,
          { sk_cliente }
        )
      ])

    const rfv = normalizarLinha(rfvRows[0] ?? {})
    const financeiro = normalizarLinha(financeiroRows[0] ?? {})
    const ultimaVenda = normalizarLinha(ultimaVendaRows[0] ?? {})

    res.json({
      cliente: {
        sk_cliente: cliente.sk_cliente ?? null,
        nome_cliente: cliente.nome_cliente ?? null,
        cpf: cliente.cpf ?? null,
        cnpj: cliente.cnpj ?? null,
        tipo_cliente: cliente.tipo_cliente ?? null,
        cliente_desde: cliente.cliente_desde ?? null,
        nome_grupo: cliente.nome_grupo ?? null
      },
      rfv: {
        classificacao: rfv.classificacao ?? null,
        recencia: numero(rfv.recencia),
        frequencia: numero(rfv.frequencia),
        valor: numero(rfv.valor)
      },
      financeiro: {
        total_gasto: numero(financeiro.total_gasto),
        total_compras: numero(financeiro.total_compras),
        ticket_medio: numero(financeiro.ticket_medio),
        ultima_compra: financeiro.ultima_compra ?? null
      },
      ultimo_vendedor: ultimaVenda.nome_vendedor ?? null,
      data_ultima_compra: ultimaVenda.data_ultima_compra ?? financeiro.ultima_compra ?? null,
      top_produtos: topProdutosRows.map((row) => {
        const item = normalizarLinha(row)
        return {
          nome: item.nome ?? null,
          quantidade: numero(item.quantidade),
          valor: numero(item.valor)
        }
      }),
      top_categorias: topCategoriasRows.map((row) => {
        const item = normalizarLinha(row)
        return {
          grupo: item.grupo ?? "Sem grupo",
          valor: numero(item.valor)
        }
      }),
      ultimas_compras: ultimasComprasRows.map((row) => {
        const item = normalizarLinha(row)
        return {
          nome: item.nome ?? null,
          quantidade_item: numero(item.quantidade_item),
          sk_dt_fechamento: item.sk_dt_fechamento ?? null
        }
      })
    })
  } catch (err) {
    console.error("Erro ao investigar cliente:", err)
    res.status(500).json({ error: "Erro ao investigar cliente" })
  }
})

export default router
