import { queryOracleByEmpresaId } from "../../db/oracle-tenants.js"
import {
  ORCAMENTO_STATUS_DESCRICAO,
  JANELA_ORCAMENTO_RELEVANTE_DIAS,
  buildOrcamentosClienteCTE,
  isRfvVendedorDisponivel,
} from "./kanbanQueries.js"
import { buildLojaInCondition, resolveLojaColumnName } from "../lojaScopeService.js"

export const COLUNAS_KANBAN = ["A_CONTATAR", "EM_CONTATO", "ORCAMENTO_ENVIADO", "CONVERTIDO", "NAO_CONVERTIDO"]
const COLUNAS_ABERTAS = ["A_CONTATAR", "EM_CONTATO", "ORCAMENTO_ENVIADO"]
const TIPOS_INTERACAO_MANUAL = ["ANOTACAO", "LIGACAO", "WHATSAPP", "EMAIL", "REUNIAO"]

export class KanbanError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = "KanbanError"
    this.statusCode = statusCode
  }
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function numero(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function texto(value) {
  return value === null || value === undefined ? null : String(value).trim()
}

function isUniqueViolation(error) {
  return String(error?.message ?? "").includes("ORA-00001")
}

export function getScopedQuery(empresaId) {
  if (!empresaId) throw new KanbanError("empresa_id e obrigatorio para o kanban de carteira.", 400)
  return (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options)
}

async function nextId(sequenceName, dbQuery) {
  const rows = await dbQuery(`SELECT ${sequenceName}.NEXTVAL AS ID FROM DUAL`)
  return numero(rows[0]?.ID ?? rows[0]?.id, 0)
}

async function proximaOrdem(dbQuery, skVendedor, coluna) {
  const rows = await dbQuery(
    `SELECT NVL(MAX(ORDEM), 0) + 1 AS PROXIMA
     FROM CRM_KANBAN_CARD
     WHERE SK_VENDEDOR = :sk_vendedor AND COLUNA_ATUAL = :coluna`,
    { sk_vendedor: skVendedor, coluna }
  )
  return numero(rows[0]?.PROXIMA ?? rows[0]?.proxima, 1)
}

export function maskDocumento(value) {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (digits.length < 6) return texto(value)
  const inicio = digits.slice(0, 3)
  const fim = digits.slice(-2)
  const meio = "*".repeat(digits.length - 5)
  return `${inicio}${meio}${fim}`
}

async function inserirInteracao(dbQuery, { cardId, tipo, conteudo = null, colunaOrigem = null, colunaDestino = null, autor = null }) {
  const id = await nextId("CRM_KANBAN_INTERACAO_SEQ", dbQuery)
  await dbQuery(
    `INSERT INTO CRM_KANBAN_INTERACAO
       (ID, CARD_ID, TIPO, CONTEUDO, COLUNA_ORIGEM, COLUNA_DESTINO, AUTOR, DATA)
     VALUES (:id, :card_id, :tipo, :conteudo, :coluna_origem, :coluna_destino, :autor, SYSDATE)`,
    { id, card_id: cardId, tipo, conteudo, coluna_origem: colunaOrigem, coluna_destino: colunaDestino, autor }
  )
  return id
}

async function buscarCard(dbQuery, { cardId, skVendedor }) {
  const rows = await dbQuery(
    `SELECT * FROM CRM_KANBAN_CARD WHERE ID = :card_id AND SK_VENDEDOR = :sk_vendedor`,
    { card_id: cardId, sk_vendedor: skVendedor }
  )
  if (!rows.length) throw new KanbanError("Card nao encontrado.", 404)
  return normalizeRow(rows[0])
}

async function buscarCardPorCliente(dbQuery, { skVendedor, skCliente }) {
  const rows = await dbQuery(
    `SELECT * FROM CRM_KANBAN_CARD WHERE SK_VENDEDOR = :sk_vendedor AND SK_CLIENTE = :sk_cliente`,
    { sk_vendedor: skVendedor, sk_cliente: skCliente }
  )
  return rows.length ? normalizeRow(rows[0]) : null
}

/**
 * Usado exclusivamente pela sincronizacao automatica. Nunca ressuscita um card arquivado
 * e nunca recria um card ja existente (ativo ou arquivado) - quem decide o que fazer com um
 * card ja existente e o kanbanSyncService, chamando moverCard em seguida.
 */
export async function criarCardAutomatico({ dbQuery, empresaId, skVendedor, skCliente, colunaInicial }) {
  if (!COLUNAS_ABERTAS.includes(colunaInicial)) {
    throw new KanbanError("Card automatico so pode nascer em uma coluna aberta do funil.", 400)
  }

  const existente = await buscarCardPorCliente(dbQuery, { skVendedor, skCliente })
  if (existente) return null

  const id = await nextId("CRM_KANBAN_CARD_SEQ", dbQuery)
  const ordem = await proximaOrdem(dbQuery, skVendedor, colunaInicial)

  try {
    await dbQuery(
      `INSERT INTO CRM_KANBAN_CARD
         (ID, EMPRESA_ID, SK_VENDEDOR, SK_CLIENTE, COLUNA_ATUAL, ORIGEM_STATUS, ORDEM,
          DATA_CRIACAO, DATA_ULTIMA_ATUALIZACAO, DATA_ULTIMA_MOVIMENTACAO, ARQUIVADO)
       VALUES (:id, :empresa_id, :sk_vendedor, :sk_cliente, :coluna_inicial, 'AUTOMATICO', :ordem,
               SYSDATE, SYSDATE, SYSDATE, 'N')`,
      { id, empresa_id: empresaId, sk_vendedor: skVendedor, sk_cliente: skCliente, coluna_inicial: colunaInicial, ordem }
    )
  } catch (error) {
    if (isUniqueViolation(error)) return null
    throw error
  }

  await inserirInteracao(dbQuery, {
    cardId: id,
    tipo: "MUDANCA_COLUNA",
    conteudo: "Card criado automaticamente.",
    colunaDestino: colunaInicial,
    autor: "Sistema",
  })

  return { id, coluna_atual: colunaInicial }
}

/**
 * Usado pelo endpoint "+ Adicionar cliente". Reativa um card arquivado do mesmo cliente
 * ou cria um novo; bloqueia duplicar cliente ja ativo no kanban.
 */
export async function criarCardManual({ dbQuery, empresaId, skVendedor, skCliente, colunaInicial = "A_CONTATAR", autor }) {
  if (!COLUNAS_KANBAN.includes(colunaInicial)) {
    throw new KanbanError("Coluna inicial invalida.", 400)
  }

  const existente = await buscarCardPorCliente(dbQuery, { skVendedor, skCliente })

  if (existente) {
    if (existente.arquivado !== "S") {
      throw new KanbanError("Este cliente ja esta no kanban.", 400)
    }

    const ordem = await proximaOrdem(dbQuery, skVendedor, colunaInicial)
    await dbQuery(
      `UPDATE CRM_KANBAN_CARD
         SET COLUNA_ATUAL = :coluna_inicial,
             ORIGEM_STATUS = 'MANUAL',
             ORDEM = :ordem,
             ARQUIVADO = 'N',
             DATA_ULTIMA_ATUALIZACAO = SYSDATE,
             DATA_ULTIMA_MOVIMENTACAO = SYSDATE
       WHERE ID = :id`,
      { coluna_inicial: colunaInicial, ordem, id: existente.id }
    )

    await inserirInteracao(dbQuery, {
      cardId: existente.id,
      tipo: "MUDANCA_COLUNA",
      conteudo: "Card reativado manualmente.",
      colunaOrigem: existente.coluna_atual,
      colunaDestino: colunaInicial,
      autor,
    })

    return { id: existente.id, coluna_atual: colunaInicial, reativado: true }
  }

  const id = await nextId("CRM_KANBAN_CARD_SEQ", dbQuery)
  const ordem = await proximaOrdem(dbQuery, skVendedor, colunaInicial)

  try {
    await dbQuery(
      `INSERT INTO CRM_KANBAN_CARD
         (ID, EMPRESA_ID, SK_VENDEDOR, SK_CLIENTE, COLUNA_ATUAL, ORIGEM_STATUS, ORDEM,
          DATA_CRIACAO, DATA_ULTIMA_ATUALIZACAO, DATA_ULTIMA_MOVIMENTACAO, ARQUIVADO)
       VALUES (:id, :empresa_id, :sk_vendedor, :sk_cliente, :coluna_inicial, 'MANUAL', :ordem,
               SYSDATE, SYSDATE, SYSDATE, 'N')`,
      { id, empresa_id: empresaId, sk_vendedor: skVendedor, sk_cliente: skCliente, coluna_inicial: colunaInicial, ordem }
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new KanbanError("Este cliente ja esta no kanban.", 400)
    }
    throw error
  }

  await inserirInteracao(dbQuery, {
    cardId: id,
    tipo: "MUDANCA_COLUNA",
    conteudo: "Card criado manualmente.",
    colunaDestino: colunaInicial,
    autor,
  })

  return { id, coluna_atual: colunaInicial, reativado: false }
}

/**
 * Motor de movimentacao reaproveitado pela sync (origem AUTOMATICO) e pelo drag manual
 * (origem MANUAL). No-op se o card ja esta na coluna destino.
 */
export async function moverCard(dbQuery, { cardId, skVendedor, novaColuna, origem = null, autor = "Sistema", motivo = null }) {
  if (!COLUNAS_KANBAN.includes(novaColuna)) {
    throw new KanbanError("Coluna de destino invalida.", 400)
  }

  const card = await buscarCard(dbQuery, { cardId, skVendedor })

  if (card.coluna_atual === novaColuna) {
    return { id: card.id, coluna_atual: card.coluna_atual, alterado: false }
  }

  const ordem = await proximaOrdem(dbQuery, skVendedor, novaColuna)
  const novaOrigem = origem ?? card.origem_status

  await dbQuery(
    `UPDATE CRM_KANBAN_CARD
       SET COLUNA_ATUAL = :nova_coluna,
           ORIGEM_STATUS = :nova_origem,
           ORDEM = :ordem,
           DATA_ULTIMA_ATUALIZACAO = SYSDATE,
           DATA_ULTIMA_MOVIMENTACAO = SYSDATE
     WHERE ID = :id`,
    { nova_coluna: novaColuna, nova_origem: novaOrigem, ordem, id: card.id }
  )

  await inserirInteracao(dbQuery, {
    cardId: card.id,
    tipo: "MUDANCA_COLUNA",
    conteudo: motivo,
    colunaOrigem: card.coluna_atual,
    colunaDestino: novaColuna,
    autor,
  })

  return { id: card.id, coluna_atual: novaColuna, alterado: true }
}

export async function moverCardManual({ dbQuery, cardId, skVendedor, novaColuna, autor }) {
  return moverCard(dbQuery, { cardId, skVendedor, novaColuna, origem: "MANUAL", autor })
}

export async function toggleArquivar({ dbQuery, cardId, skVendedor, arquivar, autor = "Sistema" }) {
  const card = await buscarCard(dbQuery, { cardId, skVendedor })
  const novoValor = arquivar ? "S" : "N"

  if (card.arquivado === novoValor) {
    return { id: card.id, arquivado: arquivar }
  }

  await dbQuery(
    `UPDATE CRM_KANBAN_CARD SET ARQUIVADO = :novo_valor, DATA_ULTIMA_ATUALIZACAO = SYSDATE WHERE ID = :id`,
    { novo_valor: novoValor, id: card.id }
  )

  await inserirInteracao(dbQuery, {
    cardId: card.id,
    tipo: "ANOTACAO",
    conteudo: arquivar ? "Card arquivado." : "Card desarquivado.",
    autor,
  })

  return { id: card.id, arquivado: arquivar }
}

export async function addInteracao({ dbQuery, cardId, skVendedor, tipo, conteudo, autor }) {
  if (!TIPOS_INTERACAO_MANUAL.includes(tipo)) {
    throw new KanbanError("Tipo de interacao invalido.", 400)
  }
  if (!texto(conteudo)) {
    throw new KanbanError("Conteudo da interacao e obrigatorio.", 400)
  }

  const card = await buscarCard(dbQuery, { cardId, skVendedor })
  const id = await inserirInteracao(dbQuery, { cardId: card.id, tipo, conteudo: texto(conteudo), autor })

  await dbQuery(`UPDATE CRM_KANBAN_CARD SET DATA_ULTIMA_ATUALIZACAO = SYSDATE WHERE ID = :id`, { id: card.id })

  return { id }
}

/** Score 0-1 de prioridade, calculado apenas para cards em A_CONTATAR. */
export function calcularPrioridade({ valorOrcamento, diasDesdeUltimoSinal }, valorMaxColuna) {
  const valorNormalizado = valorMaxColuna > 0 ? Math.min(numero(valorOrcamento) / valorMaxColuna, 1) : 0
  const recenciaNormalizada =
    diasDesdeUltimoSinal === null || diasDesdeUltimoSinal === undefined
      ? 0
      : Math.max(0, 1 - Math.min(numero(diasDesdeUltimoSinal), JANELA_ORCAMENTO_RELEVANTE_DIAS) / JANELA_ORCAMENTO_RELEVANTE_DIAS)

  return Number((valorNormalizado * 0.6 + recenciaNormalizada * 0.4).toFixed(4))
}

function montarCard(row) {
  const item = normalizeRow(row)
  const diasDesdeUltimoSinal = item.data_ultima_movimentacao
    ? Math.floor((Date.now() - new Date(item.data_ultima_movimentacao).getTime()) / 86400000)
    : null

  return {
    id: item.id,
    sk_cliente: item.sk_cliente,
    nome_cliente: texto(item.nome_cliente),
    cpf: maskDocumento(item.cpf),
    cnpj: maskDocumento(item.cnpj),
    nome_grupo: texto(item.nome_grupo),
    classificacao_rfv: texto(item.classificacao_rfv),
    coluna_atual: item.coluna_atual,
    origem_status: item.origem_status,
    ordem: numero(item.ordem),
    data_criacao: item.data_criacao,
    data_ultima_movimentacao: item.data_ultima_movimentacao,
    dias_desde_ultimo_sinal: diasDesdeUltimoSinal,
    valor_orcamento: item.valor_orcamento === null || item.valor_orcamento === undefined ? null : numero(item.valor_orcamento),
    orcamento_status: item.orcamento_status ?? null,
    orcamento_status_descricao: item.orcamento_status ? ORCAMENTO_STATUS_DESCRICAO[item.orcamento_status] ?? null : null,
    _valorMaxColuna: numero(item.valor_max_coluna),
  }
}

function finalizarCard(card) {
  const { _valorMaxColuna, ...resto } = card
  return {
    ...resto,
    prioridade:
      card.coluna_atual === "A_CONTATAR"
        ? calcularPrioridade({ valorOrcamento: card.valor_orcamento, diasDesdeUltimoSinal: card.dias_desde_ultimo_sinal }, _valorMaxColuna)
        : null,
  }
}

const CARDS_BASE_CTE = (diasAtividadeFiltro, arquivado = "N", rfvDisponivel = true) => `
  cards_base AS (
    SELECT
      c.ID, c.SK_CLIENTE, c.COLUNA_ATUAL, c.ORIGEM_STATUS, c.ORDEM,
      c.DATA_CRIACAO, c.DATA_ULTIMA_ATUALIZACAO, c.DATA_ULTIMA_MOVIMENTACAO,
      cli.NOME_CLIENTE, cli.CPF, cli.CNPJ, cli.NOME_GRUPO,
      ${rfvDisponivel ? "rfv.CLASSIFICACAO" : "CAST(NULL AS VARCHAR2(60))"} AS CLASSIFICACAO_RFV,
      orc.VALOR_PEDIDO AS VALOR_ORCAMENTO,
      orc.STATUS AS ORCAMENTO_STATUS
    FROM CRM_KANBAN_CARD c
    JOIN DM_VENDAS.DIM_CLIENTE cli ON cli.SK_CLIENTE = c.SK_CLIENTE
    LEFT JOIN orcamentos_cliente orc ON orc.SK_CLIENTE = c.SK_CLIENTE
    ${rfvDisponivel ? "LEFT JOIN DM_VENDAS.FATO_RFV_VENDEDOR rfv ON rfv.SK_CLIENTE = c.SK_CLIENTE AND rfv.SK_VENDEDOR = c.SK_VENDEDOR" : ""}
    WHERE c.SK_VENDEDOR = :sk_vendedor
      AND c.ARQUIVADO = '${arquivado}'
      ${diasAtividadeFiltro ? "AND c.DATA_ULTIMA_MOVIMENTACAO >= TRUNC(SYSDATE) - :dias_atividade_max" : ""}
  )
`

export async function listCards({ dbQuery, empresaId, skVendedor, diasAtividadeMax = 30, limitPorColuna = 30 }) {
  const binds = { sk_vendedor: skVendedor }
  if (diasAtividadeMax) binds.dias_atividade_max = diasAtividadeMax
  const rfvDisponivel = await isRfvVendedorDisponivel(dbQuery, empresaId)

  const rows = await dbQuery(
    `
    WITH ${buildOrcamentosClienteCTE({ aplicarJanela: false })},
    ${CARDS_BASE_CTE(!!diasAtividadeMax, "N", rfvDisponivel)},
    cards_ranked AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (PARTITION BY b.COLUNA_ATUAL ORDER BY b.ORDEM DESC) AS RN_COLUNA,
        COUNT(*) OVER (PARTITION BY b.COLUNA_ATUAL) AS TOTAL_COLUNA,
        SUM(NVL(b.VALOR_ORCAMENTO, 0)) OVER (PARTITION BY b.COLUNA_ATUAL) AS VALOR_ABERTO_COLUNA,
        MAX(NVL(b.VALOR_ORCAMENTO, 0)) OVER (PARTITION BY b.COLUNA_ATUAL) AS VALOR_MAX_COLUNA
      FROM cards_base b
    )
    SELECT * FROM cards_ranked
    WHERE RN_COLUNA <= :limit_por_coluna
    ORDER BY COLUNA_ATUAL, ORDEM DESC
    `,
    { ...binds, limit_por_coluna: limitPorColuna }
  )

  const totalSemFiltroRows = await dbQuery(
    `
    SELECT COLUNA_ATUAL, COUNT(*) AS TOTAL
    FROM CRM_KANBAN_CARD
    WHERE SK_VENDEDOR = :sk_vendedor AND ARQUIVADO = 'N'
    GROUP BY COLUNA_ATUAL
    `,
    { sk_vendedor: skVendedor }
  )
  const totalSemFiltroPorColuna = Object.fromEntries(
    totalSemFiltroRows.map((row) => {
      const item = normalizeRow(row)
      return [item.coluna_atual, numero(item.total)]
    })
  )

  const porColuna = new Map(COLUNAS_KANBAN.map((coluna) => [coluna, { cards: [], total: 0, valorAberto: 0 }]))

  rows.forEach((row) => {
    const card = montarCard(row)
    const item = normalizeRow(row)
    const bucket = porColuna.get(card.coluna_atual)
    if (!bucket) return
    bucket.cards.push(finalizarCard(card))
    bucket.total = numero(item.total_coluna)
    bucket.valorAberto = numero(item.valor_aberto_coluna)
  })

  return {
    colunas: COLUNAS_KANBAN.map((coluna) => {
      const bucket = porColuna.get(coluna)
      return {
        coluna,
        total: bucket.total,
        totalSemFiltro: totalSemFiltroPorColuna[coluna] ?? bucket.total,
        valorAberto: bucket.valorAberto,
        cards: bucket.cards,
        temMais: bucket.total > bucket.cards.length,
      }
    }),
  }
}

export async function listCardsColuna({ dbQuery, empresaId, skVendedor, coluna, offset = 0, limit = 30, diasAtividadeMax = 30 }) {
  if (!COLUNAS_KANBAN.includes(coluna)) {
    throw new KanbanError("Coluna invalida.", 400)
  }

  const binds = { sk_vendedor: skVendedor, offset, limit }
  if (diasAtividadeMax) binds.dias_atividade_max = diasAtividadeMax
  const rfvDisponivel = await isRfvVendedorDisponivel(dbQuery, empresaId)

  const rows = await dbQuery(
    `
    WITH ${buildOrcamentosClienteCTE({ aplicarJanela: false })},
    ${CARDS_BASE_CTE(!!diasAtividadeMax, "N", rfvDisponivel)},
    cards_ranked AS (
      SELECT b.*, MAX(NVL(b.VALOR_ORCAMENTO, 0)) OVER () AS VALOR_MAX_COLUNA
      FROM cards_base b
      WHERE b.COLUNA_ATUAL = :coluna
    )
    SELECT * FROM cards_ranked
    ORDER BY ORDEM DESC
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `,
    { ...binds, coluna }
  )

  return rows.map((row) => finalizarCard(montarCard(row)))
}

export async function listCardsArquivados({ dbQuery, empresaId, skVendedor, offset = 0, limit = 50 }) {
  const rfvDisponivel = await isRfvVendedorDisponivel(dbQuery, empresaId)
  const rows = await dbQuery(
    `
    WITH ${buildOrcamentosClienteCTE({ aplicarJanela: false })},
    ${CARDS_BASE_CTE(false, "S", rfvDisponivel)}
    SELECT b.*, 0 AS VALOR_MAX_COLUNA FROM cards_base b
    ORDER BY DATA_ULTIMA_MOVIMENTACAO DESC
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `,
    { sk_vendedor: skVendedor, offset, limit }
  )

  return rows.map((row) => finalizarCard(montarCard(row)))
}

export async function getCardDetail({ dbQuery, empresaId, cardId, skVendedor, lojaScope = null }) {
  const card = await buscarCard(dbQuery, { cardId, skVendedor })
  const rfvDisponivel = await isRfvVendedorDisponivel(dbQuery, empresaId)
  const vendasLojaColumn = await resolveLojaColumnName(empresaId, "FATO_VENDAS_LUCRATIVIDADE")
  const vendasLojaCondition = buildLojaInCondition(vendasLojaColumn, lojaScope, "kanban_detalhe_venda_loja")

  const [clienteRows, rfvRows, vendasRows, orcamentoRows, interacoesRows] = await Promise.all([
    dbQuery(
      `SELECT sk_cliente, nome_cliente, cpf, cnpj, tipo_cliente, cliente_desde, nome_grupo
       FROM DM_VENDAS.DIM_CLIENTE WHERE sk_cliente = :sk_cliente`,
      { sk_cliente: card.sk_cliente }
    ),
    // FATO_RFV_VENDEDOR nao tem coluna de loja - sem filtro de loja aqui.
    rfvDisponivel
      ? dbQuery(
          `SELECT classificacao, recencia, frequencia, valor, telefone, ultima_compra
           FROM DM_VENDAS.FATO_RFV_VENDEDOR
           WHERE sk_cliente = :sk_cliente AND sk_vendedor = :sk_vendedor
           FETCH FIRST 1 ROWS ONLY`,
          { sk_cliente: card.sk_cliente, sk_vendedor: skVendedor }
        )
      : Promise.resolve([]),
    dbQuery(
      `
      SELECT orcamento_id, sk_dt_fechamento,
        SUM(CASE WHEN tipo = 'DEV' THEN NVL(valor_liquido_item, 0) * -1 ELSE NVL(valor_liquido_item, 0) END) AS valor
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE
      WHERE sk_cliente = :sk_cliente AND sk_vendedor = :sk_vendedor
        AND ${vendasLojaCondition.clause}
      GROUP BY orcamento_id, sk_dt_fechamento
      ORDER BY sk_dt_fechamento DESC
      FETCH FIRST 10 ROWS ONLY
      `,
      { sk_cliente: card.sk_cliente, sk_vendedor: skVendedor, ...vendasLojaCondition.binds }
    ),
    dbQuery(
      `
      WITH ${buildOrcamentosClienteCTE({ aplicarJanela: false })}
      SELECT * FROM orcamentos_cliente WHERE sk_cliente = :sk_cliente_filtro
      `,
      { sk_vendedor: skVendedor, sk_cliente_filtro: card.sk_cliente }
    ),
    dbQuery(
      `SELECT id, tipo, conteudo, coluna_origem, coluna_destino, autor, data
       FROM CRM_KANBAN_INTERACAO WHERE card_id = :card_id ORDER BY data DESC`,
      { card_id: card.id }
    ),
  ])

  const cliente = normalizeRow(clienteRows[0] ?? {})
  const rfv = normalizeRow(rfvRows[0] ?? {})
  const orcamento = orcamentoRows.length ? normalizeRow(orcamentoRows[0]) : null

  return {
    card: {
      id: card.id,
      coluna_atual: card.coluna_atual,
      origem_status: card.origem_status,
      arquivado: card.arquivado === "S",
      data_criacao: card.data_criacao,
      data_ultima_movimentacao: card.data_ultima_movimentacao,
    },
    cliente: {
      sk_cliente: cliente.sk_cliente ?? card.sk_cliente,
      nome_cliente: texto(cliente.nome_cliente),
      cpf: maskDocumento(cliente.cpf),
      cnpj: maskDocumento(cliente.cnpj),
      tipo_cliente: texto(cliente.tipo_cliente),
      cliente_desde: cliente.cliente_desde ?? null,
      nome_grupo: texto(cliente.nome_grupo),
      telefone: texto(rfv.telefone),
      classificacao_rfv: texto(rfv.classificacao),
      recencia: rfv.recencia ?? null,
      frequencia: rfv.frequencia ?? null,
      valor_potencial: rfv.valor === undefined ? null : numero(rfv.valor),
    },
    orcamentoAberto: orcamento
      ? {
          status: orcamento.status,
          descricao_status: ORCAMENTO_STATUS_DESCRICAO[orcamento.status] ?? "Status desconhecido",
          valor_pedido: numero(orcamento.valor_pedido),
          data_cadastro: orcamento.data_cadastro,
        }
      : null,
    ultimasVendas: vendasRows.map((row) => {
      const item = normalizeRow(row)
      return {
        orcamento_id: item.orcamento_id,
        sk_dt_fechamento: item.sk_dt_fechamento,
        valor: numero(item.valor),
      }
    }),
    interacoes: interacoesRows.map((row) => {
      const item = normalizeRow(row)
      return {
        id: item.id,
        tipo: item.tipo,
        conteudo: texto(item.conteudo),
        coluna_origem: item.coluna_origem,
        coluna_destino: item.coluna_destino,
        autor: texto(item.autor),
        data: item.data,
      }
    }),
  }
}
