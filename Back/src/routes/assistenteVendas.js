import express from "express"
import { query } from "../db/oracle.js"

const router = express.Router()
const ORACLE_TABLE_NOT_FOUND = 942
const ORACLE_UNIQUE_CONSTRAINT = 1
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1"
const IMPACTOS_VALIDOS = new Set(["alto", "medio", "rapido"])

function normalizarLinha(row) {
  return Object.fromEntries(
    Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  )
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function getOracleErrorCode(err) {
  if (typeof err?.errorNum === "number") {
    return err.errorNum
  }

  const match = String(err?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

function normalizarAcao(item) {
  if (typeof item === "string") {
    const acao = item.trim()
    return acao ? { acao, impacto: "medio" } : null
  }

  if (!item || typeof item !== "object") {
    return null
  }

  const acao = String(item.acao ?? item.texto ?? item.title ?? "").trim()
  const impactoBruto = String(item.impacto ?? "medio").trim().toLowerCase()
  const impacto = IMPACTOS_VALIDOS.has(impactoBruto) ? impactoBruto : "medio"

  return acao ? { acao, impacto } : null
}

function normalizarAcoes(items) {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map(normalizarAcao).filter(Boolean).slice(0, 4)
}

function extrairJson(texto) {
  const bruto = String(texto ?? "").trim()
  if (!bruto) return null

  const semCodeFence = bruto.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")

  try {
    return JSON.parse(semCodeFence)
  } catch {
    const match = semCodeFence.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (!match) return null

    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

async function resolverEscopoVendedor(codigoRecebido) {
  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM DM_VENDAS.VW_RANKING_VENDEDORES
      WHERE sk_vendedor = :codigo OR vendedor_id = :codigo
      UNION ALL
      SELECT sk_vendedor, vendedor_id, nome_vendedor
      FROM DM_VENDAS.VW_RANKING_VENDEDORES_DIA
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

async function carregarDadosAssistente(vendedor) {
  const [
    mensalRows,
    diarioRows,
    clientesPrioritariosRows,
    orcamentosTopRows,
    categoriaTopRows,
    categoriaQuedaRows,
    categoriaOportunidadeRows,
  ] = await Promise.all([
    query(
      `
      SELECT
        nome_vendedor,
        receita_mes,
        meta_mes,
        perc_atingimento
      FROM DM_VENDAS.VW_RANKING_VENDEDORES
      WHERE sk_vendedor = :sk_vendedor
      FETCH FIRST 1 ROWS ONLY
      `,
      { sk_vendedor: vendedor.skVendedor }
    ),
    query(
      `
      SELECT dias_restantes
      FROM DM_VENDAS.VW_RANKING_VENDEDORES_DIA
      WHERE sk_vendedor = :sk_vendedor
      FETCH FIRST 1 ROWS ONLY
      `,
      { sk_vendedor: vendedor.skVendedor }
    ),
    query(
      `
      SELECT *
      FROM (
        SELECT
          nome_cliente AS nome,
          telefone,
          NVL(recencia, 0) AS dias_sem_compra,
          NVL(valor, 0) AS receita_total
        FROM DM_VENDAS.FATO_RFV_VENDEDOR
        WHERE sk_vendedor = :sk_vendedor
          AND UPPER(TRIM(classificacao)) LIKE 'CAMPE%'
          AND NVL(recencia, 0) > 30
        ORDER BY valor DESC, recencia DESC
      )
      WHERE ROWNUM <= 3
      `,
      { sk_vendedor: vendedor.skVendedor }
    ),
    query(
      `
      SELECT *
      FROM (
        SELECT
          cliente,
          telefone,
          valor
        FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
        WHERE vendedor_id = :vendedor_id
        ORDER BY valor DESC NULLS LAST
      )
      WHERE ROWNUM <= 2
      `,
      { vendedor_id: vendedor.vendedorId }
    ),
    query(
      `
      SELECT grupo
      FROM (
        SELECT
          NVL(p.nome_pai_nivel1, 'Sem grupo') AS grupo,
          SUM(
            CASE
              WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
              ELSE NVL(f.valor_liquido_item, 0)
            END
          ) AS receita
        FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
        JOIN DM_VENDAS.DIM_PRODUTOS p
          ON p.sk_produto = f.sk_produto
        WHERE f.sk_vendedor = :sk_vendedor
          AND f.sk_dt_recebimento >= TO_NUMBER(TO_CHAR(SYSDATE - 90, 'YYYYMMDD'))
        GROUP BY NVL(p.nome_pai_nivel1, 'Sem grupo')
        ORDER BY receita DESC
      )
      WHERE ROWNUM = 1
      `,
      { sk_vendedor: vendedor.skVendedor }
    ),
    query(
      `
      WITH vendas_categoria AS (
        SELECT
          NVL(p.nome_pai_nivel1, 'Sem grupo') AS grupo,
          CASE
            WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
            ELSE NVL(f.valor_liquido_item, 0)
          END AS receita_liquida,
          f.sk_dt_recebimento AS sk_data
        FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
        JOIN DM_VENDAS.DIM_PRODUTOS p
          ON p.sk_produto = f.sk_produto
        WHERE f.sk_vendedor = :sk_vendedor
          AND f.sk_dt_recebimento IS NOT NULL
      ),
      consolidado AS (
        SELECT
          grupo,
          SUM(
            CASE
              WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(SYSDATE - 30, 'YYYYMMDD'))
                               AND TO_NUMBER(TO_CHAR(SYSDATE, 'YYYYMMDD'))
              THEN receita_liquida
              ELSE 0
            END
          ) AS receita_atual_30,
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
      SELECT grupo
      FROM (
        SELECT
          grupo,
          ROUND(
            ((receita_atual_30 - receita_ant_30) / NULLIF(receita_ant_30, 0)) * 100,
            0
          ) AS variacao_percentual
        FROM consolidado
        WHERE receita_ant_30 > 5000
        ORDER BY variacao_percentual ASC NULLS LAST
      )
      WHERE ROWNUM = 1
      `,
      { sk_vendedor: vendedor.skVendedor }
    ),
    query(
      `
      WITH vendas_categoria AS (
        SELECT
          NVL(p.nome_pai_nivel1, 'Sem grupo') AS grupo,
          CASE
            WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
            ELSE NVL(f.valor_liquido_item, 0)
          END AS receita_liquida,
          f.sk_dt_recebimento AS sk_data
        FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
        JOIN DM_VENDAS.DIM_PRODUTOS p
          ON p.sk_produto = f.sk_produto
        WHERE f.sk_vendedor = :sk_vendedor
          AND f.sk_dt_recebimento IS NOT NULL
      ),
      consolidado AS (
        SELECT
          grupo,
          SUM(
            CASE
              WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(SYSDATE - 30, 'YYYYMMDD'))
                               AND TO_NUMBER(TO_CHAR(SYSDATE, 'YYYYMMDD'))
              THEN receita_liquida
              ELSE 0
            END
          ) AS receita_atual_30,
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
      SELECT grupo
      FROM (
        SELECT
          grupo,
          ROUND(
            ((receita_atual_30 - receita_ant_30) / NULLIF(receita_ant_30, 0)) * 100,
            0
          ) AS variacao_percentual
        FROM consolidado
        WHERE receita_atual_30 > 3000
          AND receita_ant_30 > 0
        ORDER BY variacao_percentual DESC NULLS LAST
      )
      WHERE ROWNUM = 1
      `,
      { sk_vendedor: vendedor.skVendedor }
    ),
  ])

  const mensal = normalizarLinha(mensalRows[0] ?? {})
  const diario = normalizarLinha(diarioRows[0] ?? {})
  const categoriaTop = normalizarLinha(categoriaTopRows[0] ?? {})
  const categoriaQueda = normalizarLinha(categoriaQuedaRows[0] ?? {})
  const categoriaOportunidade = normalizarLinha(categoriaOportunidadeRows[0] ?? {})

  return {
    vendedor: mensal.nome_vendedor ?? vendedor.nomeVendedor ?? "Vendedor",
    status_meta: {
      meta_mensal: numero(mensal.meta_mes),
      receita_atual: numero(mensal.receita_mes),
      percentual_meta: Math.round(numero(mensal.perc_atingimento)),
      dias_restantes_mes: numero(diario.dias_restantes),
    },
    clientes_prioritarios: {
      clientes_campeoes_sem_compra: clientesPrioritariosRows.map((row) => {
        const item = normalizarLinha(row)
        return {
          nome: item.nome ?? "Cliente sem nome",
          telefone: item.telefone ?? null,
          dias_sem_compra: numero(item.dias_sem_compra),
          receita_total: numero(item.receita_total),
        }
      }),
    },
    orcamentos_estrategicos: {
      top_orcamentos: orcamentosTopRows.map((row) => {
        const item = normalizarLinha(row)
        return {
          cliente: item.cliente ?? "Cliente sem nome",
          telefone: item.telefone ?? null,
          valor: numero(item.valor),
        }
      }),
    },
    categorias: {
      categoria_mais_vendida: categoriaTop.grupo ?? "Sem grupo",
      categoria_em_queda: categoriaQueda.grupo ?? "Sem leitura",
      categoria_com_oportunidade: categoriaOportunidade.grupo ?? "Sem oportunidade clara",
    },
  }
}

function criarPrompt(payload) {
  return [
    "Voce e um especialista em vendas no varejo de material eletrico.",
    "",
    "Seu papel e ajudar vendedores a atingir a meta mensal com acoes praticas.",
    "",
    "Analise os dados abaixo e gere 4 acoes objetivas para o vendedor executar hoje.",
    "",
    "Regras:",
    "- Seja especifico",
    "- Cite clientes ou oportunidades quando possivel",
    "- Priorize acoes que impactam faturamento rapido",
    "- Evite recomendacoes genericas",
    "",
    "Formato da resposta:",
    'Retorne apenas um JSON com 4 objetos no formato [{"acao":"...", "impacto":"alto|medio|rapido"}].',
    "",
    "Dados do vendedor:",
    JSON.stringify(payload, null, 2),
  ].join("\n")
}

function gerarInsightsHeuristicos(payload) {
  const acoes = []
  const clientes = payload.clientes_prioritarios.clientes_campeoes_sem_compra
  const orcamentos = payload.orcamentos_estrategicos.top_orcamentos
  const categorias = payload.categorias

  if (clientes[0]) {
    acoes.push({
      acao: `Entre em contato com ${clientes[0].nome} hoje: cliente campeao ha ${clientes[0].dias_sem_compra} dias sem compra e historico de R$ ${clientes[0].receita_total.toLocaleString("pt-BR")}.`,
      impacto: "alto",
    })
  }

  if (orcamentos.length > 0) {
    const resumo = orcamentos
      .map((item) => `${item.cliente} (R$ ${item.valor.toLocaleString("pt-BR")})`)
      .join(" e ")

    acoes.push({
      acao: `Priorize os orcamentos de ${resumo}, pois representam potencial imediato de receita.`,
      impacto: "rapido",
    })
  }

  if (categorias.categoria_mais_vendida !== "Sem grupo") {
    acoes.push({
      acao: `Use ${categorias.categoria_mais_vendida} como produto de abertura e ofereca ${categorias.categoria_com_oportunidade} como venda complementar para aumentar o ticket.`,
      impacto: "medio",
    })
  }

  if (categorias.categoria_em_queda !== "Sem leitura") {
    acoes.push({
      acao: `Recupere vendas da categoria ${categorias.categoria_em_queda} com abordagem especifica para clientes industriais e obras em andamento.`,
      impacto: "alto",
    })
  }

  if (acoes.length < 4) {
    acoes.push({
      acao: `Com ${payload.status_meta.dias_restantes_mes} dias restantes no mes, concentre a agenda em clientes de recompra e orcamentos de maior valor.`,
      impacto: "rapido",
    })
  }

  return acoes.slice(0, 4)
}

async function buscarCache(vendedorId) {
  try {
    const rows = await query(
      `
      SELECT insights_json, origem, atualizado_em
      FROM INSIGHTS_VENDEDOR
      WHERE vendedor_id = :vendedor_id
        AND TRUNC(data_referencia) = TRUNC(SYSDATE)
      ORDER BY atualizado_em DESC
      FETCH FIRST 1 ROWS ONLY
      `,
      { vendedor_id: vendedorId }
    )

    const item = normalizarLinha(rows[0] ?? {})
    const insights = normalizarAcoes(extrairJson(item.insights_json))

    return insights.length
      ? {
          insights,
          origem: item.origem ?? "cache",
          atualizadoEm: item.atualizado_em ?? null,
          disponivel: true,
        }
      : { insights: [], origem: null, atualizadoEm: null, disponivel: true }
  } catch (err) {
    if (getOracleErrorCode(err) === ORACLE_TABLE_NOT_FOUND) {
      return { insights: [], origem: null, atualizadoEm: null, disponivel: false }
    }

    throw err
  }
}

async function salvarCache(vendedorId, insights, origem, payload) {
  const binds = {
    vendedor_id: vendedorId,
    insights_json: JSON.stringify(insights),
    origem,
    payload_json: JSON.stringify(payload),
  }

  try {
    await query(
      `
      MERGE INTO INSIGHTS_VENDEDOR destino
      USING (
        SELECT :vendedor_id AS vendedor_id, TRUNC(SYSDATE) AS data_referencia
        FROM dual
      ) origem_linha
      ON (
        destino.vendedor_id = origem_linha.vendedor_id
        AND TRUNC(destino.data_referencia) = origem_linha.data_referencia
      )
      WHEN MATCHED THEN
        UPDATE SET
          destino.insights_json = :insights_json,
          destino.origem = :origem,
          destino.payload_json = :payload_json,
          destino.atualizado_em = SYSDATE
      WHEN NOT MATCHED THEN
        INSERT (
          vendedor_id,
          data_referencia,
          insights_json,
          origem,
          payload_json,
          atualizado_em
        )
        VALUES (
          :vendedor_id,
          TRUNC(SYSDATE),
          :insights_json,
          :origem,
          :payload_json,
          SYSDATE
        )
      `,
      binds
    )

    return true
  } catch (err) {
    if (getOracleErrorCode(err) === ORACLE_TABLE_NOT_FOUND) {
      return false
    }

    if (getOracleErrorCode(err) === ORACLE_UNIQUE_CONSTRAINT) {
      await query(
        `
        UPDATE INSIGHTS_VENDEDOR
        SET insights_json = :insights_json,
            origem = :origem,
            payload_json = :payload_json,
            atualizado_em = SYSDATE
        WHERE vendedor_id = :vendedor_id
          AND TRUNC(data_referencia) = TRUNC(SYSDATE)
        `,
        binds
      )

      return true
    }

    throw err
  }
}

async function gerarInsightsOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            'Voce e um especialista em vendas e gestao comercial. Responda apenas com JSON valido no formato [{"acao":"...", "impacto":"alto|medio|rapido"}].',
        },
        {
          role: "user",
          content: criarPrompt(payload),
        },
      ],
    }),
  })

  if (!response.ok) {
    const detalhe = await response.text()
    throw new Error(`Falha OpenAI ${response.status}: ${detalhe}`)
  }

  const json = await response.json()
  const conteudo = json?.choices?.[0]?.message?.content ?? ""
  const insights = normalizarAcoes(extrairJson(conteudo))

  return insights.length ? insights : null
}

router.post("/assistente-vendas", async (req, res) => {
  try {
    const vendedorIdRecebido = req.body?.vendedor_id

    if (!vendedorIdRecebido) {
      return res.status(400).json({ error: "vendedor_id e obrigatorio" })
    }

    const vendedor = await resolverEscopoVendedor(vendedorIdRecebido)
    const payload = await carregarDadosAssistente(vendedor)
    const cache = await buscarCache(vendedor.skVendedor)

    if (cache.insights.length) {
      return res.json({
        insights: cache.insights,
        source: cache.origem ?? "cache",
        cached: true,
        cache_table_available: cache.disponivel,
        payload,
        updated_at: cache.atualizadoEm,
      })
    }

    let insights = null
    let source = "fallback"

    try {
      insights = await gerarInsightsOpenAI(payload)
      if (insights?.length) {
        source = "openai"
      }
    } catch (err) {
      console.error("Erro ao gerar insights com OpenAI:", err)
    }

    if (!insights?.length) {
      insights = gerarInsightsHeuristicos(payload)
      source = process.env.OPENAI_API_KEY ? "fallback-openai" : "fallback-sem-chave"
    }

    const cacheDisponivel = await salvarCache(vendedor.skVendedor, insights, source, payload)

    res.json({
      insights,
      source,
      cached: false,
      cache_table_available: cache.disponivel || cacheDisponivel,
      payload,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Erro no assistente de vendas:", err)
    res.status(500).json({ error: "Erro ao gerar insights do vendedor" })
  }
})

export default router
