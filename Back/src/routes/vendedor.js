import express from "express"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { findAuthUserBySkVendedor } from "../services/authUsersService.js"
import { requireAuth } from "../middleware/auth.js"
import { getScopedEmpresaId, getScopedLojaScope } from "../services/requestScope.js"
import {
  buildSellerInCondition,
  getAllowedSellerCodesByEmpresaId,
  isSellerAllowed,
} from "../services/tenantSellerScope.js"
import { buildLojaInCondition, resolveLojaColumnName } from "../services/lojaScopeService.js"

const router = express.Router()

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  )
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizarClassificacao(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

async function getEmpresaScope(req, res) {
  const empresaId = getScopedEmpresaId(req)
  if (!empresaId) {
    res.status(400).json({ error: "empresa_id e obrigatorio para buscar dados do vendedor." })
    return { allowed: false, empresaId: null, lojaScope: null }
  }

  const lojaScope = await getScopedLojaScope(req)
  if (lojaScope.error) {
    res.status(lojaScope.error.status).json({ error: lojaScope.error.message })
    return { allowed: false, empresaId: null, lojaScope: null }
  }

  return { allowed: true, empresaId, lojaScope }
}

function canAccessVendedor(req, skVendedor) {
  const role = String(req.auth?.role ?? "").toUpperCase()
  if (role !== "VENDEDOR") return true
  return String(req.auth?.sk_vendedor ?? "") === String(skVendedor)
}

async function getQueryContext(empresaId) {
  return {
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
    rankingView: "VW_RANKING_VENDEDORES",
    rankingDayView: "VW_RANKING_VENDEDORES_DIA",
    orcamentosView: "VW_ORCAMENTOS_GESTAO_METAS",
  }
}

async function resolverVendedorId(sk_vendedor, context = null) {
  const ctx = context ?? await getQueryContext(null)
  const vendedorRows = await ctx.query(
    `
    SELECT vendedor_id
    FROM (
      SELECT vendedor_id
      FROM ${ctx.rankingView}
      WHERE sk_vendedor = :sk_vendedor
      UNION ALL
      SELECT vendedor_id
      FROM ${ctx.rankingDayView}
      WHERE sk_vendedor = :sk_vendedor
    )
    WHERE ROWNUM = 1
    `,
    { sk_vendedor }
  )

  return (
    vendedorRows[0]?.VENDEDOR_ID ??
    vendedorRows[0]?.vendedor_id ??
    sk_vendedor
  )
}

async function carregarUsuarioFallback(sk_vendedor, empresaId = null) {
  return findAuthUserBySkVendedor(sk_vendedor, empresaId)
}

router.get("/vendedor/:sk_vendedor", requireAuth, async (req, res) => {
  try {
    const { sk_vendedor } = req.params
    if (!canAccessVendedor(req, sk_vendedor)) {
      return res.status(403).json({ error: "Acesso permitido apenas aos dados do vendedor autenticado." })
    }
    const scope = await getEmpresaScope(req, res)
    if (!scope.allowed) return

    const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(scope.empresaId)
    if (!isSellerAllowed(allowedSellerCodes, sk_vendedor)) {
      return res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
    }

    const context = await getQueryContext(scope.empresaId)
    const sellerScope = buildSellerInCondition("sk_vendedor", allowedSellerCodes)
    const rankingLojaColumn = await resolveLojaColumnName(scope.empresaId, context.rankingView)
    const rankingLojaCondition = buildLojaInCondition(rankingLojaColumn, scope.lojaScope, "vendedor_ranking_loja")
    const rankingDayLojaColumn = await resolveLojaColumnName(scope.empresaId, context.rankingDayView)
    const rankingDayLojaCondition = buildLojaInCondition(rankingDayLojaColumn, scope.lojaScope, "vendedor_ranking_dia_loja")

    const [mensalRows, diarioRows, totalVendedoresRows, usuarioFallback] = await Promise.all([
      context.query(
        `
        SELECT *
        FROM (
          SELECT
            nome_vendedor,
            receita_mes,
            meta_mes,
            meta_herdada,
            perc_atingimento,
            ranking_atingimento,
            clientes_mes
          FROM ${context.rankingView}
          WHERE sk_vendedor = :sk_vendedor
            AND ${sellerScope.clause}
            AND ${rankingLojaCondition.clause}
        )
        WHERE ROWNUM = 1
        `,
        { sk_vendedor, ...sellerScope.binds, ...rankingLojaCondition.binds }
      ),
      context.query(
        `
        SELECT *
        FROM (
          SELECT
            data_referencia,
            receita_dia,
            clientes_dia,
            ticket_medio_dia,
            meta_diaria_necessaria,
            dias_restantes,
            status_dia,
            perc_performance_dia
          FROM ${context.rankingDayView}
          WHERE sk_vendedor = :sk_vendedor
            AND ${sellerScope.clause}
            AND ${rankingDayLojaCondition.clause}
        )
        WHERE ROWNUM = 1
        `,
        { sk_vendedor, ...sellerScope.binds, ...rankingDayLojaCondition.binds }
      ),
      context.query(
        `
        SELECT COUNT(*) AS total_vendedores
        FROM ${context.rankingView}
        WHERE ${sellerScope.clause}
          AND ${rankingLojaCondition.clause}
        `,
        { ...sellerScope.binds, ...rankingLojaCondition.binds }
      ),
      carregarUsuarioFallback(sk_vendedor, scope.empresaId),
    ])

    if (!mensalRows.length && !diarioRows.length && !usuarioFallback) {
      return res.status(404).json({ error: "Vendedor não encontrado" })
    }

    const mensalData = mensalRows[0] ? normalizeRow(mensalRows[0]) : {}
    const diarioData = diarioRows[0] ? normalizeRow(diarioRows[0]) : {}
    const totalVendedoresData = totalVendedoresRows[0] ? normalizeRow(totalVendedoresRows[0]) : {}

    res.json({
      nome: mensalData.nome_vendedor ?? usuarioFallback?.nome ?? `Vendedor ${sk_vendedor}`,
      receita: mensalData.receita_mes ?? 0,
      meta: mensalData.meta_mes ?? 0,
      metaHerdada: Number(mensalData.meta_herdada),
      percentual: mensalData.perc_atingimento ?? 0,
      posicao: mensalData.ranking_atingimento ?? 0,
      totalVendedores: numero(totalVendedoresData.total_vendedores),
      clientesMes: mensalData.clientes_mes ?? 0,
      ticketMedioMes:
        numero(mensalData.clientes_mes) > 0
          ? numero(mensalData.receita_mes) / numero(mensalData.clientes_mes)
          : 0,
      dataReferencia: diarioData.data_referencia ?? null,
      vendasHoje: diarioData.receita_dia ?? 0,
      clientesDia: diarioData.clientes_dia ?? 0,
      ticketMedioDia: diarioData.ticket_medio_dia ?? 0,
      metaDia: diarioData.meta_diaria_necessaria ?? 0,
      diasRestantes: diarioData.dias_restantes ?? 0,
      statusDia: diarioData.status_dia ?? "OK",
      percentualDia: diarioData.perc_performance_dia ?? 0
    })
  } catch (err) {
    console.error("Erro ao buscar vendedor:", err)
    res.status(500).json({ error: "Erro ao buscar vendedor" })
  }
})

router.get("/vendedor-panorama/:sk_vendedor", requireAuth, async (req, res) => {
  try {
    const { sk_vendedor } = req.params
    if (!canAccessVendedor(req, sk_vendedor)) {
      return res.status(403).json({ error: "Acesso permitido apenas aos dados do vendedor autenticado." })
    }
    const scope = await getEmpresaScope(req, res)
    if (!scope.allowed) return

    const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(scope.empresaId)
    if (!isSellerAllowed(allowedSellerCodes, sk_vendedor)) {
      return res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
    }

    const context = await getQueryContext(scope.empresaId)
    const sellerScope = buildSellerInCondition("sk_vendedor", allowedSellerCodes)
    const rankingLojaColumn = await resolveLojaColumnName(scope.empresaId, context.rankingView)
    const rankingLojaCondition = buildLojaInCondition(rankingLojaColumn, scope.lojaScope, "panorama_ranking_loja")
    const cockpitLojaColumn = await resolveLojaColumnName(scope.empresaId, "FATO_COCKPIT")
    const cockpitLojaCondition = buildLojaInCondition(cockpitLojaColumn ? `cockpit.${cockpitLojaColumn}` : null, scope.lojaScope, "panorama_cockpit_loja")
    const vendasLojaColumn = await resolveLojaColumnName(scope.empresaId, "FATO_VENDAS_LUCRATIVIDADE")
    const vendasLojaCondition = buildLojaInCondition(vendasLojaColumn ? `f.${vendasLojaColumn}` : null, scope.lojaScope, "panorama_venda_loja")

    // Parte das consultas depende apenas de sk_vendedor.
    // Elas rodam em paralelo enquanto resolvemos o vendedor_id usado nos orcamentos.
    const [
      vendedor_id,
      mensalRows,
      performanceRows,
      topProdutosRows,
      topClientesRows,
      rfvRows,
      ultimasVendasRows,
    ] = await Promise.all([
      resolverVendedorId(sk_vendedor, context),
      context.query(
        `
        SELECT
          nome_vendedor,
          receita_mes,
          meta_mes,
          perc_atingimento,
          clientes_mes
        FROM ${context.rankingView}
        WHERE sk_vendedor = :sk_vendedor
          AND ${sellerScope.clause}
          AND ${rankingLojaCondition.clause}
        FETCH FIRST 1 ROWS ONLY
        `,
        { sk_vendedor, ...sellerScope.binds, ...rankingLojaCondition.binds }
      ),
      context.query(
        `
        WITH base AS (
          SELECT
            cockpit.orcamento_id,
            -- No cockpit, SK_DATA representa a data operacional de recebimento
            -- usada no ranking diario. Evitamos usar data de fechamento aqui.
            cockpit.sk_data AS sk_dt_recebimento,
            CASE
              WHEN tipo_orcamento.tipo_sintetico = 'dev' THEN NVL(cockpit.valor_liquido_item, 0) * -1
              ELSE NVL(cockpit.valor_liquido_item, 0)
            END AS valor_item
          FROM DM_VENDAS.FATO_COCKPIT cockpit
          LEFT JOIN DM_VENDAS.DIM_TIPO_ORCAMENTO tipo_orcamento
            ON tipo_orcamento.sk_tipo_orcamento = cockpit.sk_tipo_orcamento
          WHERE cockpit.sk_vendedor = :sk_vendedor
            AND ${cockpitLojaCondition.clause}
        )
        SELECT
          COUNT(DISTINCT orcamento_id) AS quantidade_vendas,
          ROUND(NVL(SUM(valor_item), 0), 2) AS receita_total,
          ROUND(
            CASE
              WHEN COUNT(DISTINCT orcamento_id) = 0 THEN 0
              ELSE SUM(valor_item) / COUNT(DISTINCT orcamento_id)
            END,
            2
          ) AS ticket_medio,
          MAX(sk_dt_recebimento) AS ultima_venda
        FROM base
        `,
        { sk_vendedor, ...cockpitLojaCondition.binds }
      ),
      context.query(
        `
        WITH base AS (
          SELECT
            NVL(p.nome_pai_nivel1, 'Sem grupo') AS grupo,
            CASE
              WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
              ELSE NVL(f.valor_liquido_item, 0)
            END AS receita
          FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
          JOIN DM_VENDAS.DIM_PRODUTOS p
            ON p.sk_produto = f.sk_produto
          WHERE f.sk_vendedor = :sk_vendedor
            AND ${vendasLojaCondition.clause}
        ),
        total AS (
          SELECT NVL(SUM(receita), 0) AS receita_total
          FROM base
        )
        SELECT
          grupo,
          ROUND(SUM(receita), 2) AS receita,
          ROUND(
            CASE
              WHEN (SELECT receita_total FROM total) = 0 THEN 0
              ELSE (SUM(receita) / (SELECT receita_total FROM total)) * 100
            END,
            2
          ) AS participacao
        FROM base
        GROUP BY grupo
        ORDER BY receita DESC
        FETCH FIRST 5 ROWS ONLY
        `,
        { sk_vendedor, ...vendasLojaCondition.binds }
      ),
      context.query(
        `
        SELECT
          nome_cliente,
          classificacao,
          receita,
          ultima_compra
        FROM (
          SELECT
            c.nome_cliente,
            MAX(rfv.classificacao) AS classificacao,
            ROUND(
              SUM(
                CASE
                  WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
                  ELSE NVL(f.valor_liquido_item, 0)
                END
              ),
              2
            ) AS receita,
            MAX(f.sk_dt_recebimento) AS ultima_compra
          FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
          JOIN DM_VENDAS.DIM_CLIENTE c
            ON c.sk_cliente = f.sk_cliente
          LEFT JOIN DM_VENDAS.FATO_RFV_VENDEDOR rfv
            ON rfv.sk_vendedor = f.sk_vendedor
           AND rfv.sk_cliente = f.sk_cliente
          WHERE f.sk_vendedor = :sk_vendedor
            AND f.sk_dt_recebimento >= TO_NUMBER(TO_CHAR(SYSDATE - 90, 'YYYYMMDD'))
            AND ${vendasLojaCondition.clause}
          GROUP BY c.nome_cliente
          ORDER BY receita DESC
        )
        WHERE ROWNUM <= 5
        `,
        { sk_vendedor, ...vendasLojaCondition.binds }
      ),
      // FATO_RFV_VENDEDOR nao tem coluna de loja - sem filtro de loja aqui.
      context.query(
        `
        SELECT classificacao, COUNT(*) AS total
        FROM DM_VENDAS.FATO_RFV_VENDEDOR
        WHERE sk_vendedor = :sk_vendedor
        GROUP BY classificacao
        `,
        { sk_vendedor }
      ),
      context.query(
        `
        SELECT
          nome_cliente,
          data,
          valor_total,
          qtd_produtos
        FROM (
          SELECT
            cockpit.orcamento_id,
            c.nome_cliente,
            cockpit.sk_data AS data,
            ROUND(
              SUM(
                CASE
                  WHEN tipo_orcamento.tipo_sintetico = 'dev' THEN NVL(cockpit.valor_liquido_item, 0) * -1
                  ELSE NVL(cockpit.valor_liquido_item, 0)
                END
              ),
              2
            ) AS valor_total,
            COUNT(DISTINCT cockpit.sk_produto) AS qtd_produtos
          FROM DM_VENDAS.FATO_COCKPIT cockpit
          JOIN DM_VENDAS.DIM_CLIENTE c
            ON c.sk_cliente = cockpit.sk_cliente
          LEFT JOIN DM_VENDAS.DIM_TIPO_ORCAMENTO tipo_orcamento
            ON tipo_orcamento.sk_tipo_orcamento = cockpit.sk_tipo_orcamento
          WHERE cockpit.sk_vendedor = :sk_vendedor
            AND ${cockpitLojaCondition.clause}
          GROUP BY cockpit.orcamento_id, c.nome_cliente, cockpit.sk_data
          ORDER BY cockpit.sk_data DESC, cockpit.orcamento_id DESC
        )
        WHERE ROWNUM <= 5
        `,
        { sk_vendedor, ...cockpitLojaCondition.binds }
      ),
    ])

    const orcamentosLojaColumn = await resolveLojaColumnName(scope.empresaId, context.orcamentosView)
    const orcamentosLojaCondition = buildLojaInCondition(orcamentosLojaColumn, scope.lojaScope, "panorama_orcamentos_loja")
    const orcamentosRows = await context.query(
      `
      SELECT
        -- Conta quantos orcamentos ainda podem virar venda.
        -- Usamos a view vw_orcamentos_gestao_metas.
        -- Apenas registros classificados como 'Possiveis Vendas'
        -- representam oportunidades comerciais abertas.
        COUNT(*) AS orcamentos_abertos,
        NVL(SUM(valor), 0) AS valor_orcamentos
      FROM ${context.orcamentosView}
      WHERE vendedor_id = :vendedor_id
        AND agrupamento = 'Possiveis Vendas'
        AND ${orcamentosLojaCondition.clause}
      `,
      { vendedor_id, ...orcamentosLojaCondition.binds }
    )

    if (!mensalRows.length) {
      return res.status(404).json({ error: "Vendedor não encontrado" })
    }

    const mensal = normalizeRow(mensalRows[0])
    const performance = normalizeRow(performanceRows[0] ?? {})
    const orcamentos = normalizeRow(orcamentosRows[0] ?? {})
    const receitaMes = numero(mensal.receita_mes)
    const metaMes = numero(mensal.meta_mes)
    const faltaMeta = Math.max(metaMes - receitaMes, 0)

    const rfvResumo = {
      campeoes: 0,
      fieis: 0,
      emRisco: 0,
      novos: 0,
    }

    for (const row of rfvRows.map(normalizeRow)) {
      const classificacao = normalizarClassificacao(row.classificacao)
      const total = numero(row.total)

      if (classificacao.includes("CAMPE")) rfvResumo.campeoes += total
      else if (classificacao.includes("FIE")) rfvResumo.fieis += total
      else if (classificacao.includes("RISCO")) rfvResumo.emRisco += total
      else if (classificacao.includes("NOV")) rfvResumo.novos += total
    }

    return res.json({
      indicadores: {
        vendedorId: vendedor_id,
        nome: mensal.nome_vendedor ?? null,
        receita_mes: receitaMes,
        meta_mensal: metaMes,
        falta_meta: faltaMeta,
        percentual_meta: Math.round(numero(mensal.perc_atingimento) * 100),
      },
      performance: {
        clientes_atendidos_mes: numero(mensal.clientes_mes),
        ticket_medio: numero(performance.ticket_medio),
        quantidade_vendas: numero(performance.quantidade_vendas),
        ultima_venda: performance.ultima_venda ?? null,
        orcamentos_abertos: numero(orcamentos.orcamentos_abertos),
        valor_orcamentos: numero(orcamentos.valor_orcamentos),
      },
      top_produtos: topProdutosRows.map((row) => {
        const item = normalizeRow(row)
        return {
          grupo: item.grupo ?? "Sem grupo",
          receita: numero(item.receita),
          participacao: numero(item.participacao),
        }
      }),
      top_clientes: topClientesRows.map((row) => {
        const item = normalizeRow(row)
        return {
          nome_cliente: item.nome_cliente ?? null,
          classificacao: item.classificacao ?? null,
          receita: numero(item.receita),
          ultima_compra: item.ultima_compra ?? null,
        }
      }),
      rfv: rfvResumo,
      ultimas_vendas: ultimasVendasRows.map((row) => {
        const item = normalizeRow(row)
        return {
          cliente: item.nome_cliente ?? null,
          valor: numero(item.valor_total),
          qtd_produtos: numero(item.qtd_produtos),
          data: item.data ?? null,
        }
      }),
    })
  } catch (err) {
    console.error("Erro ao buscar panorama do vendedor:", err)
    res.status(500).json({ error: "Erro ao buscar panorama do vendedor" })
  }
})

router.get("/vendedor/:sk_vendedor/oportunidades", requireAuth, async (req, res) => {
  try {
    const { sk_vendedor } = req.params
    if (!canAccessVendedor(req, sk_vendedor)) {
      return res.status(403).json({ error: "Acesso permitido apenas aos dados do vendedor autenticado." })
    }
    const scope = await getEmpresaScope(req, res)
    if (!scope.allowed) return

    const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(scope.empresaId)
    if (!isSellerAllowed(allowedSellerCodes, sk_vendedor)) {
      return res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
    }

    const context = await getQueryContext(scope.empresaId)
    const vendedor_id = await resolverVendedorId(sk_vendedor, context)
    const orcamentosLojaColumn = await resolveLojaColumnName(scope.empresaId, context.orcamentosView)
    const orcamentosLojaCondition = buildLojaInCondition(orcamentosLojaColumn, scope.lojaScope, "oportunidades_loja")

    const [resumoRows, orcamentosRows] = await Promise.all([
      context.query(
        `
        WITH base AS (
          SELECT
            id,
            valor,
            UPPER(
              TRIM(
                TRANSLATE(
                  descricao_status,
                  'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                  'AAAAAEEEEIIIIOOOOOUUUUC'
                )
              )
            ) AS status_norm
          FROM ${context.orcamentosView}
          WHERE vendedor_id = :vendedor_id
            AND ${orcamentosLojaCondition.clause}
        )
        SELECT
          COUNT(id) AS total_orcamentos,
          NVL(SUM(valor), 0) AS valor_total,
          NVL(SUM(CASE WHEN status_norm LIKE 'EM NEGOCIAC%' THEN valor ELSE 0 END), 0) AS em_negociacao,
          NVL(SUM(CASE WHEN status_norm LIKE 'COMBINADO NOVO CONTATO%' THEN valor ELSE 0 END), 0) AS novo_contato,
          NVL(SUM(CASE WHEN status_norm LIKE 'SEM ACOMPANHAMENTO%' THEN valor ELSE 0 END), 0) AS sem_acompanhamento
        FROM base
        `,
        { vendedor_id, ...orcamentosLojaCondition.binds }
      ),
      context.query(
        `
        SELECT
          id,
          cliente,
          valor,
          data,
          telefone
        FROM ${context.orcamentosView}
        WHERE vendedor_id = :vendedor_id
          AND ${orcamentosLojaCondition.clause}
        ORDER BY data DESC
        `,
        { vendedor_id, ...orcamentosLojaCondition.binds }
      )
    ])

    const resumoData = normalizeRow(resumoRows[0] ?? {})
    const orcamentos = orcamentosRows.map(normalizeRow).map((item) => ({
      id: item.id ?? null,
      cliente: item.cliente ?? null,
      valor: Number(item.valor ?? 0),
      data: item.data ?? null,
      telefone: item.telefone ?? null
    }))

    res.json({
      resumo: {
        total_orcamentos: Number(resumoData.total_orcamentos ?? 0),
        valor_total: Number(resumoData.valor_total ?? 0),
        em_negociacao: Number(resumoData.em_negociacao ?? 0),
        novo_contato: Number(resumoData.novo_contato ?? 0),
        sem_acompanhamento: Number(resumoData.sem_acompanhamento ?? 0)
      },
      orcamentos
    })
  } catch (err) {
    console.error("Erro ao buscar oportunidades do vendedor:", err)
    res.status(500).json({ error: "Erro ao buscar oportunidades do vendedor" })
  }
})

export default router
