import express from "express"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { requireAuth } from "../middleware/auth.js"
import { getScopedEmpresaId } from "../services/requestScope.js"
import {
  getAllowedSellerCodesByEmpresaId,
  isSellerAllowed,
} from "../services/tenantSellerScope.js"

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

async function getQueryContext(empresaId) {
  return {
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
    rankingView: "VW_RANKING_VENDEDORES",
    rankingDayView: "VW_RANKING_VENDEDORES_DIA",
    orcamentosView: "VW_ORCAMENTOS_GESTAO_METAS",
  }
}

async function resolverEscopoVendedor(codigoRecebido, context) {
  const rows = await context.query(
    `
    SELECT *
    FROM (
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM ${context.rankingView}
      WHERE sk_vendedor = :codigo OR vendedor_id = :codigo
      UNION ALL
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM ${context.rankingDayView}
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

function consultaClientes(whereClause, orderByClause, orcamentosView) {
  const clienteNorm = normalizarTextoSql("cliente")
  const nomeClienteNorm = normalizarTextoSql("rfv.nome_cliente")

  return `
    WITH orcamentos_cliente AS (
      SELECT
        ${clienteNorm} AS cliente_norm,
        COUNT(*) AS orcamentos_abertos
      FROM ${orcamentosView}
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

function consultaResumoCategoria(whereClause, orcamentosView) {
  const clienteNorm = normalizarTextoSql("cliente")
  const nomeClienteNorm = normalizarTextoSql("rfv.nome_cliente")

  return `
    WITH orcamentos_cliente AS (
      SELECT
        ${clienteNorm} AS cliente_norm,
        COUNT(*) AS orcamentos_abertos
      FROM ${orcamentosView}
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

async function safeQuery(context, label, sql, binds = {}) {
  try {
    const result = await context.query(sql, binds)
    console.log(`[AreaAtaque] ${label}: ${result.length} linha(s)`)
    return result
  } catch (err) {
    console.error(`[AreaAtaque] ERRO em "${label}":`, err?.message ?? err)
    return []
  }
}

router.get("/area-ataque/:vendedor_id", requireAuth, async (req, res) => {
  try {
    const { vendedor_id } = req.params
    const empresa_id = getScopedEmpresaId(req)
    if (!empresa_id) {
      return res.status(400).json({ error: "empresa_id e obrigatorio para buscar area de ataque." })
    }
    console.log(`[AreaAtaque] Requisicao: vendedor_id=${vendedor_id}, empresa_id=${empresa_id}`)
    const context = await getQueryContext(empresa_id)
    const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(empresa_id)
    const vendedor = await resolverEscopoVendedor(vendedor_id, context).catch((err) => {
      console.warn("Area de ataque: falha ao resolver vendedor pelo ranking:", err?.message ?? err)
      return {
        skVendedor: vendedor_id,
        vendedorId: vendedor_id,
        nomeVendedor: null,
      }
    })
    if (String(req.auth?.role ?? "").toUpperCase() === "VENDEDOR" && String(req.auth?.sk_vendedor ?? "") !== String(vendedor.skVendedor)) {
      return res.status(403).json({ error: "Acesso permitido apenas aos dados do vendedor autenticado." })
    }
    if (!isSellerAllowed(allowedSellerCodes, vendedor.skVendedor)) {
      return res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
    }
    console.log(`[AreaAtaque] Vendedor resolvido: skVendedor=${vendedor.skVendedor}, vendedorId=${vendedor.vendedorId}`)
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
      safeQuery(context, "clientes campeoes", consultaClientes(filtroCampeoes, "rfv.valor DESC", context.orcamentosView), binds),
      safeQuery(context, "resumo campeoes", consultaResumoCategoria(filtroCampeoes, context.orcamentosView), binds),
      safeQuery(context, "clientes fieis", consultaClientes(filtroFieis, "rfv.valor DESC", context.orcamentosView), binds),
      safeQuery(context, "resumo fieis", consultaResumoCategoria(filtroFieis, context.orcamentosView), binds),
      safeQuery(context, "clientes em risco", consultaClientes(filtroRisco, "rfv.recencia DESC, rfv.valor DESC", context.orcamentosView), binds),
      safeQuery(context, "resumo risco", consultaResumoCategoria(filtroRisco, context.orcamentosView), binds),
      safeQuery(
        context,
        "resumo carteira",
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
      safeQuery(
        context,
        "produtos em alta",
        `
        SELECT
          NVL(p.nome_pai_nivel1, 'Sem grupo') AS nome,
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
        GROUP BY NVL(p.nome_pai_nivel1, 'Sem grupo')
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
    console.log(`[AreaAtaque] Totais: campeoes=${resumoCampeoes.total}, fieis=${resumoFieis.total}, risco=${resumoEmRisco.total}, valorHistorico=${valorHistoricoClientes}`)
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
