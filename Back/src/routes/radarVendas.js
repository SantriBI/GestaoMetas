import express from "express"
import { query } from "../db/oracle.js"

const router = express.Router()

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function percentualInteiro(value) {
  return Math.round(numero(value) * 100)
}

function criarAlerta(tipo_alerta, mensagem) {
  return { tipo_alerta, mensagem }
}

function normalizarNomeVendedor(value) {
  return String(value ?? "Vendedor").trim().toUpperCase()
}

function normalizarGrupo(value) {
  return String(value ?? "Sem grupo").trim().toLowerCase()
}

function selecionarTopCategorias(categorias, criterio, limite = 2) {
  return categorias.filter(criterio).slice(0, limite)
}

async function carregarRankingMensal() {
  return query(`
    SELECT
      nome_vendedor,
      receita_mes,
      meta_mes,
      perc_atingimento,
      ranking_atingimento
    FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES
    ORDER BY ranking_atingimento
  `)
}

async function carregarResumoRfv() {
  const rows = await query(`
    SELECT
      SUM(
        CASE
          WHEN UPPER(TRIM(classificacao)) LIKE 'CAMPE%' AND NVL(recencia, 0) > 30 THEN 1
          ELSE 0
        END
      ) AS clientes_campeoes_esfriando,
      SUM(
        CASE
          WHEN UPPER(TRIM(TRANSLATE(classificacao, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC'))) LIKE 'CLIENTES FI%'
            AND NVL(recencia, 0) > 45
          THEN 1
          ELSE 0
        END
      ) AS clientes_fieis_esfriando
    FROM DM_VENDAS.FATO_RFV_VENDEDOR
  `)

  return rows[0] ?? {}
}

async function carregarTendenciasCategorias() {
  return query(`
    WITH vendas_categoria AS (
      SELECT
        NVL(p.nome_pai_nivel1, 'Sem grupo') AS grupo,
        -- Calcula receita considerando devolucoes (DEV) como valor negativo.
        CASE
          WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
          ELSE NVL(f.valor_liquido_item, 0)
        END AS receita_liquida,
        f.sk_dt_recebimento AS sk_data
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.sk_produto = f.sk_produto
      WHERE f.sk_dt_recebimento IS NOT NULL
    ),
    consolidado AS (
      SELECT
        grupo,
        -- Receita do periodo atual: ultimos 30 dias ate hoje.
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(SYSDATE - 30, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(SYSDATE, 'YYYYMMDD'))
            THEN receita_liquida
            ELSE 0
          END
        ) AS receita_atual_30,
        -- Receita do periodo anterior: de 60 a 31 dias atras.
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(SYSDATE - 60, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(SYSDATE - 31, 'YYYYMMDD'))
            THEN receita_liquida
            ELSE 0
          END
        ) AS receita_ant_30
      FROM vendas_categoria
      GROUP BY grupo
    )
    SELECT
      grupo,
      receita_atual_30,
      receita_ant_30,
      -- Calcula variacao percentual comparando o periodo atual com o anterior.
      ROUND(((receita_atual_30 - receita_ant_30) / NULLIF(receita_ant_30, 0)) * 100, 0) AS variacao_percentual
    FROM consolidado
    -- Evita alertas irrelevantes exigindo base minima no periodo anterior.
    WHERE receita_ant_30 > 5000
  `)
}

function gerarAlertasVendedores(rankingRows) {
  if (!rankingRows.length) {
    return []
  }

  const ranking = rankingRows.map((row) => ({
    nome: normalizarNomeVendedor(row.NOME_VENDEDOR ?? row.nome_vendedor),
    receita: numero(row.RECEITA_MES ?? row.receita_mes),
    percentual: percentualInteiro(row.PERC_ATINGIMENTO ?? row.perc_atingimento),
  }))

  const rankingPorPercentual = [...ranking].sort((a, b) => b.percentual - a.percentual)
  const lider = rankingPorPercentual[0]
  // Busca o vendedor com menor percentual de meta.
  // Usado para gerar alerta de ultimo colocado.
  const ultimoColocado = [...rankingPorPercentual].sort((a, b) => a.percentual - b.percentual)[0]
  const vendedoresEmRisco = ranking.filter((item) => item.percentual < 30)
  const semVendas = ranking.find((item) => item.receita <= 0)
  const alertas = [
    criarAlerta("sucesso", `🚀 ${lider.nome} lidera a equipe com ${lider.percentual}% da meta`),
  ]

  if (ultimoColocado) {
    alertas.push(
      criarAlerta(
        "alerta",
        `📉 ${ultimoColocado.nome} esta na ultima posicao com ${ultimoColocado.percentual}% da meta`
      )
    )
  }

  if (vendedoresEmRisco.length > 0) {
    alertas.push(
      criarAlerta("alerta", `⚠️ ${vendedoresEmRisco.length} vendedores precisam de atencao`)
    )
  }

  if (semVendas) {
    alertas.push(
      criarAlerta("alerta", `⚠️ ${semVendas.nome} ainda nao realizou vendas no periodo`)
    )
  }

  return alertas
}

function gerarAlertasRfv(rfvResumo) {
  const alertas = []
  const campeoesEsfriando = numero(
    rfvResumo.CLIENTES_CAMPEOES_ESFRIANDO ?? rfvResumo.clientes_campeoes_esfriando
  )
  const fieisEsfriando = numero(
    rfvResumo.CLIENTES_FIEIS_ESFRIANDO ?? rfvResumo.clientes_fieis_esfriando
  )

  if (campeoesEsfriando > 0) {
    alertas.push(
      criarAlerta(
        "alerta",
        `⚠️ ${campeoesEsfriando} clientes campeoes estao esfriando`
      )
    )
  }

  if (fieisEsfriando > 0) {
    alertas.push(
      criarAlerta("alerta", `⚠️ ${fieisEsfriando} clientes fieis estao esfriando`)
    )
  }

  return alertas
}

function gerarAlertasCategorias(categoriasRows) {
  const categorias = categoriasRows
    .map((row) => ({
      grupo: normalizarGrupo(row.GRUPO ?? row.grupo),
      variacao: numero(row.VARIACAO_PERCENTUAL ?? row.variacao_percentual),
    }))
    .filter((item) => Number.isFinite(item.variacao))
    .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))

  const quedas = selecionarTopCategorias(categorias, (item) => item.variacao <= -20)
  const crescimentos = selecionarTopCategorias(categorias, (item) => item.variacao >= 25)
  const alertas = []

  for (const item of quedas) {
    alertas.push(
      criarAlerta("queda", `📉 Categoria ${item.grupo} caiu ${Math.abs(item.variacao)}%`)
    )
  }

  for (const item of crescimentos) {
    alertas.push(
      criarAlerta("sucesso", `🚀 Categoria ${item.grupo} cresceu ${item.variacao}%`)
    )
  }

  return alertas
}

router.get("/radar-vendas", async (req, res) => {
  try {
    const [rankingRows, rfvResumo, categoriasRows] = await Promise.all([
      carregarRankingMensal(),
      carregarResumoRfv(),
      carregarTendenciasCategorias(),
    ])

    const alertas = [
      ...gerarAlertasVendedores(rankingRows),
      ...gerarAlertasRfv(rfvResumo),
      ...gerarAlertasCategorias(categoriasRows),
    ]

    return res.json({
      alertas: alertas.length
        ? alertas
        : [criarAlerta("sucesso", "🚀 Nenhuma queda relevante foi identificada nos ultimos 30 dias")],
    })
  } catch (err) {
    console.error("Erro radar-vendas:", err)
    return res.status(500).json({ error: "Erro ao gerar radar de vendas" })
  }
})

export default router
