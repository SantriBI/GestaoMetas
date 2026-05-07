import express from "express"
import { query } from "../db/oracle.js"
import {
  getRankingVendorsDayViewName,
  getRankingVendorsViewName,
} from "../db/oracleObjectNames.js"

const router = express.Router()

const LIMITE_RECENCIA_CAMPEOES = 20
const LIMITE_RECENCIA_RISCO = 30

function normalizarLinha(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function montarWhatsapp(telefone) {
  const limpo = String(telefone ?? "").replace(/\D/g, "")
  return limpo ? `https://wa.me/55${limpo}` : null
}

function normalizarTextoSql(expr) {
  return `UPPER(TRIM(TRANSLATE(NVL(${expr}, ''), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')))`
}

function mapearCliente(row) {
  const item = normalizarLinha(row)

  return {
    skCliente: item.sk_cliente ?? null,
    nome: item.nome_cliente ?? null,
    telefone: item.telefone ?? null,
    whatsapp: montarWhatsapp(item.telefone),
    ultimaCompra: item.ultima_compra ?? null,
    recencia: numero(item.recencia),
    frequencia: numero(item.frequencia),
    valor: numero(item.valor),
    classificacao: item.classificacao ?? null,
    orcamentosAbertos: numero(item.orcamentos_abertos),
  }
}

async function resolverEscopoVendedor(codigoRecebido) {
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

function montarAlertasERecomendacoes({
  campeoes,
  fieis,
  emRisco,
  produtosEmAlta,
  valorHistoricoClientes,
}) {
  const alertasEstrategicos = []
  const recomendacoes = []

  const campeoesFrios = campeoes.filter((cliente) => numero(cliente.recencia) > LIMITE_RECENCIA_CAMPEOES).length

  if (campeoesFrios > 0) {
    alertasEstrategicos.push(
      `${campeoesFrios} clientes campeoes estao ha mais de ${LIMITE_RECENCIA_CAMPEOES} dias sem comprar.`
    )
    recomendacoes.push("Ligue hoje para seus campeoes com maior recencia e mantenha os clientes mais valiosos aquecidos.")
  }

  if (emRisco.some((cliente) => numero(cliente.recencia) > LIMITE_RECENCIA_RISCO)) {
    alertasEstrategicos.push("Existem clientes em risco com recencia critica e chance real de recuperacao.")
    recomendacoes.push("Ataque primeiro os clientes em risco com maior historico gasto e recencia mais critica.")
  }

  if (valorHistoricoClientes > 0) {
    alertasEstrategicos.push("A carteira priorizada ja movimentou valor relevante e merece acompanhamento proximo.")
  }

  if (fieis.length > 0) {
    alertasEstrategicos.push("Seus clientes fieis tem potencial para aumentar ticket medio.")
    recomendacoes.push("Ofereca mix complementar para os clientes fieis e amplie o ticket medio nas proximas abordagens.")
  }

  if (produtosEmAlta.length > 0) {
    alertasEstrategicos.push("Os produtos mais vendidos do mes podem acelerar novas vendas.")
    recomendacoes.push(`Use ${produtosEmAlta[0].nome ?? "seus produtos lideres"} como abertura comercial nas proximas negociacoes.`)
  }

  if (emRisco.length > 0 && emRisco[0]?.nome) {
    recomendacoes.push(`Priorize ${emRisco[0].nome} na agenda de recuperacao para proteger receita dessa carteira.`)
  }

  return {
    alertasEstrategicos: [...new Set(alertasEstrategicos)].slice(0, 6),
    recomendacoes: [...new Set(recomendacoes)].slice(0, 6),
  }
}

function consultaClientes(whereClause, orderByClause) {
  const clienteNorm = normalizarTextoSql("cliente")
  const nomeClienteNorm = normalizarTextoSql("rfv.nome_cliente")

  return `
    WITH orcamentos_cliente AS (
      SELECT
        ${clienteNorm} AS cliente_norm,
        COUNT(*) AS orcamentos_abertos
      FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
      WHERE vendedor_id = :vendedor_comercial
      GROUP BY ${clienteNorm}
    )
    SELECT
      rfv.sk_cliente,
      rfv.nome_cliente,
      rfv.telefone,
      rfv.ultima_compra,
      rfv.recencia,
      rfv.frequencia,
      rfv.valor,
      rfv.classificacao,
      NVL(orc.orcamentos_abertos, 0) AS orcamentos_abertos
    FROM DM_VENDAS.FATO_RFV_VENDEDOR rfv
    LEFT JOIN orcamentos_cliente orc
      ON ${nomeClienteNorm} = orc.cliente_norm
    WHERE rfv.sk_vendedor = :vendedor_id
      AND ${whereClause}
    ORDER BY ${orderByClause}
    FETCH FIRST 10 ROWS ONLY
  `
}

function consultaResumoCategoria(whereClause) {
  const clienteNorm = normalizarTextoSql("cliente")
  const nomeClienteNorm = normalizarTextoSql("rfv.nome_cliente")

  return `
    WITH orcamentos_cliente AS (
      SELECT
        ${clienteNorm} AS cliente_norm,
        COUNT(*) AS orcamentos_abertos
      FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
      WHERE vendedor_id = :vendedor_comercial
      GROUP BY ${clienteNorm}
    )
    SELECT
      COUNT(*) AS total,
      NVL(SUM(NVL(orc.orcamentos_abertos, 0)), 0) AS orcamentos_abertos
    FROM DM_VENDAS.FATO_RFV_VENDEDOR rfv
    LEFT JOIN orcamentos_cliente orc
      ON ${nomeClienteNorm} = orc.cliente_norm
    WHERE rfv.sk_vendedor = :vendedor_id
      AND ${whereClause}
  `
}

router.get("/area-ataque/:vendedor_id", async (req, res) => {
  try {
    const { vendedor_id } = req.params
    const vendedor = await resolverEscopoVendedor(vendedor_id)
    const binds = {
      vendedor_id: vendedor.skVendedor,
      vendedor_comercial: vendedor.vendedorId,
    }

    const filtroCampeoes = "UPPER(TRIM(rfv.classificacao)) LIKE 'CAMPE%'"
    const filtroFieis = "UPPER(TRIM(rfv.classificacao)) LIKE 'CLIENTES FI%'"
    const filtroRisco = "UPPER(TRIM(rfv.classificacao)) = 'EM RISCO'"
    const filtroCarteiraPriorizada = `(${filtroCampeoes} OR ${filtroFieis} OR ${filtroRisco})`

    const [
      campeoesRows,
      campeoesResumoRows,
      fieisRows,
      fieisResumoRows,
      emRiscoRows,
      emRiscoResumoRows,
      carteiraResumoRows,
      produtosRows,
    ] = await Promise.all([
      query(consultaClientes(filtroCampeoes, "rfv.valor DESC"), binds),
      query(consultaResumoCategoria(filtroCampeoes), binds),
      query(consultaClientes(filtroFieis, "rfv.valor DESC"), binds),
      query(consultaResumoCategoria(filtroFieis), binds),
      query(consultaClientes(filtroRisco, "rfv.recencia DESC, rfv.valor DESC"), binds),
      query(consultaResumoCategoria(filtroRisco), binds),
      query(
        `
        SELECT
          NVL(SUM(valor), 0) AS valor_historico_clientes,
          MIN(ultima_compra) AS periodo_inicio,
          MAX(ultima_compra) AS periodo_fim
        FROM DM_VENDAS.FATO_RFV_VENDEDOR rfv
        WHERE rfv.sk_vendedor = :vendedor_id
          AND ${filtroCarteiraPriorizada}
        `,
        { vendedor_id: vendedor.skVendedor }
      ),
      query(
        `
        SELECT
          p.nome,
          SUM(
            CASE
              WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
              ELSE NVL(f.valor_liquido_item, 0)
            END
          ) AS total_vendido
        FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
        JOIN DM_VENDAS.DIM_PRODUTOS p
          ON f.sk_produto = p.sk_produto
        WHERE f.sk_vendedor = :vendedor_id
        GROUP BY p.nome
        ORDER BY total_vendido DESC
        FETCH FIRST 5 ROWS ONLY
        `,
        { vendedor_id: vendedor.skVendedor }
      ),
    ])

    const campeoes = campeoesRows.map(mapearCliente)
    const fieis = fieisRows.map(mapearCliente)
    const emRisco = emRiscoRows.map(mapearCliente)
    const produtosEmAlta = produtosRows.map((row) => {
      const item = normalizarLinha(row)
      return {
        nome: item.nome ?? null,
        totalVendido: numero(item.total_vendido),
      }
    })

    const resumoCampeoes = normalizarLinha(campeoesResumoRows[0] ?? {})
    const resumoFieis = normalizarLinha(fieisResumoRows[0] ?? {})
    const resumoEmRisco = normalizarLinha(emRiscoResumoRows[0] ?? {})
    const resumoCarteira = normalizarLinha(carteiraResumoRows[0] ?? {})

    const valorHistoricoClientes = numero(resumoCarteira.valor_historico_clientes)
    const inteligencia = montarAlertasERecomendacoes({
      campeoes,
      fieis,
      emRisco,
      produtosEmAlta,
      valorHistoricoClientes,
    })

    res.json({
      resumo: {
        campeoes: numero(resumoCampeoes.total),
        fieis: numero(resumoFieis.total),
        emRisco: numero(resumoEmRisco.total),
        valorHistoricoClientes,
        periodoHistoricoInicio: resumoCarteira.periodo_inicio ?? null,
        periodoHistoricoFim: resumoCarteira.periodo_fim ?? null,
        orcamentosAbertosCampeoes: numero(resumoCampeoes.orcamentos_abertos),
        orcamentosAbertosFieis: numero(resumoFieis.orcamentos_abertos),
        orcamentosAbertosRisco: numero(resumoEmRisco.orcamentos_abertos),
      },
      campeoes,
      fieis,
      emRisco,
      produtosEmAlta,
      alertasEstrategicos: inteligencia.alertasEstrategicos,
      recomendacoes: inteligencia.recomendacoes,
    })
  } catch (err) {
    console.error("Erro ao buscar area de ataque:", err)
    res.status(500).json({ error: "Erro ao buscar area de ataque" })
  }
})

export default router
