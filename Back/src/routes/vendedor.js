import express from "express"
import { query } from "../db/oracle.js"

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

async function resolverVendedorId(sk_vendedor) {
  const vendedorRows = await query(
    `
    SELECT vendedor_id
    FROM (
      SELECT vendedor_id
      FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES
      WHERE sk_vendedor = :sk_vendedor
      UNION ALL
      SELECT vendedor_id
      FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES_DIA
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

async function carregarUsuarioFallback(sk_vendedor) {
  const rows = await query(
    `
    SELECT nome, empresa_id, sk_vendedor
    FROM GM_TB_USUARIOS_APP
    WHERE sk_vendedor = :sk_vendedor
    FETCH FIRST 1 ROWS ONLY
    `,
    { sk_vendedor }
  )

  return rows[0] ? normalizeRow(rows[0]) : null
}

router.get("/vendedor/:sk_vendedor", async (req, res) => {
  try {
    const { sk_vendedor } = req.params

    const [mensalRows, diarioRows, totalVendedoresRows, usuarioFallback] = await Promise.all([
      query(
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
          FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES
          WHERE sk_vendedor = :sk_vendedor
        )
        WHERE ROWNUM = 1
        `,
        { sk_vendedor }
      ),
      query(
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
          FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES_DIA
          WHERE sk_vendedor = :sk_vendedor
        )
        WHERE ROWNUM = 1
        `,
        { sk_vendedor }
      ),
      query(
        `
        SELECT COUNT(*) AS total_vendedores
        FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES
        `
      ),
      carregarUsuarioFallback(sk_vendedor),
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

router.get("/vendedor-panorama/:sk_vendedor", async (req, res) => {
  try {
    const { sk_vendedor } = req.params

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
      resolverVendedorId(sk_vendedor),
      query(
        `
        SELECT
          nome_vendedor,
          receita_mes,
          meta_mes,
          perc_atingimento,
          clientes_mes
        FROM DM_VENDAS.GM_VW_RANKING_VENDEDORES
        WHERE sk_vendedor = :sk_vendedor
        FETCH FIRST 1 ROWS ONLY
        `,
        { sk_vendedor }
      ),
      query(
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
        { sk_vendedor }
      ),
      query(
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
        { sk_vendedor }
      ),
      query(
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
          GROUP BY c.nome_cliente
          ORDER BY receita DESC
        )
        WHERE ROWNUM <= 5
        `,
        { sk_vendedor }
      ),
      query(
        `
        SELECT classificacao, COUNT(*) AS total
        FROM DM_VENDAS.FATO_RFV_VENDEDOR
        WHERE sk_vendedor = :sk_vendedor
        GROUP BY classificacao
        `,
        { sk_vendedor }
      ),
      query(
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
          GROUP BY cockpit.orcamento_id, c.nome_cliente, cockpit.sk_data
          ORDER BY cockpit.sk_data DESC, cockpit.orcamento_id DESC
        )
        WHERE ROWNUM <= 5
        `,
        { sk_vendedor }
      ),
    ])

    const orcamentosRows = await query(
      `
      SELECT
        -- Conta quantos orcamentos ainda podem virar venda.
        -- Usamos a view vw_orcamentos_gestao_metas.
        -- Apenas registros classificados como 'Possiveis Vendas'
        -- representam oportunidades comerciais abertas.
        COUNT(*) AS orcamentos_abertos,
        NVL(SUM(valor), 0) AS valor_orcamentos
      FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
      WHERE vendedor_id = :vendedor_id
        AND agrupamento = 'Possiveis Vendas'
      `,
      { vendedor_id }
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

router.get("/vendedor/:sk_vendedor/oportunidades", async (req, res) => {
  try {
    const { sk_vendedor } = req.params
    const vendedor_id = await resolverVendedorId(sk_vendedor)

    const [resumoRows, orcamentosRows] = await Promise.all([
      query(
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
          FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
          WHERE vendedor_id = :vendedor_id
        )
        SELECT
          COUNT(id) AS total_orcamentos,
          NVL(SUM(valor), 0) AS valor_total,
          NVL(SUM(CASE WHEN status_norm LIKE 'EM NEGOCIAC%' THEN valor ELSE 0 END), 0) AS em_negociacao,
          NVL(SUM(CASE WHEN status_norm LIKE 'COMBINADO NOVO CONTATO%' THEN valor ELSE 0 END), 0) AS novo_contato,
          NVL(SUM(CASE WHEN status_norm LIKE 'SEM ACOMPANHAMENTO%' THEN valor ELSE 0 END), 0) AS sem_acompanhamento
        FROM base
        `,
        { vendedor_id }
      ),
      query(
        `
        SELECT
          id,
          cliente,
          valor,
          data,
          telefone
        FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
        WHERE vendedor_id = :vendedor_id
        ORDER BY data DESC
        `,
        { vendedor_id }
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
