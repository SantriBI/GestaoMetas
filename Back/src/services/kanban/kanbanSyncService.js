import pLimit from "p-limit"
import { buildOrcamentosClienteCTE, ORCAMENTO_STATUS_IGNORAR, JANELA_ORCAMENTO_RELEVANTE_DIAS } from "./kanbanQueries.js"
import { criarCardAutomatico, moverCard, addInteracao, toggleArquivar } from "./kanbanCardService.js"

export const ORCAMENTO_STATUS_COLUMN_MAP = {
  REC: "A_CONTATAR",
  ORC: "A_CONTATAR",
  CNC: "EM_CONTATO",
  CNE: "EM_CONTATO",
  ENE: "ORCAMENTO_ENVIADO",
  VEN: "CONVERTIDO",
  DVT: "NAO_CONVERTIDO",
  DVD: "NAO_CONVERTIDO",
  CCO: "NAO_CONVERTIDO",
  FPR: "NAO_CONVERTIDO",
  EIM: "NAO_CONVERTIDO",
  ORE: "NAO_CONVERTIDO",
  SRC: "NAO_CONVERTIDO",
}

const COLUNAS_ABERTAS = ["A_CONTATAR", "EM_CONTATO", "ORCAMENTO_ENVIADO"]
export const JANELA_CAMPANHA_RELEVANTE_DIAS = 30
const JANELA_ORCAMENTO_PARADO_DIAS = 15
const JANELA_ARQUIVAMENTO_DIAS = 15
const CONCORRENCIA_MAXIMA = 15
const STATUS_ENVIO_CAMPANHA_RELEVANTE = ["ENVIADO_WEBHOOK", "ENVIADO", "ENTREGUE", "LIDO", "RESPONDIDO"]

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function diasDesde(data) {
  if (!data) return null
  return Math.floor((Date.now() - new Date(data).getTime()) / 86400000)
}

async function buscarCardsAtivos(dbQuery, skVendedor) {
  const rows = await dbQuery(
    `SELECT ID, SK_CLIENTE, COLUNA_ATUAL, ORIGEM_STATUS, DATA_ULTIMA_MOVIMENTACAO
     FROM CRM_KANBAN_CARD
     WHERE SK_VENDEDOR = :sk_vendedor AND ARQUIVADO = 'N'`,
    { sk_vendedor: skVendedor }
  )
  return new Map(rows.map((row) => {
    const item = normalizeRow(row)
    return [item.sk_cliente, item]
  }))
}

async function buscarSinaisOrcamento(dbQuery, skVendedor) {
  const rows = await dbQuery(
    `
    WITH ${buildOrcamentosClienteCTE()}
    SELECT
      orc.sk_cliente, orc.status, orc.valor_pedido, orc.data_cadastro, orc.orcamento_id,
      CASE WHEN orc.status = 'VEN' AND EXISTS (
        SELECT 1 FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE fv
        WHERE fv.orcamento_id = orc.orcamento_id AND fv.sk_vendedor = orc.sk_vendedor
      ) THEN 1 ELSE 0 END AS venda_comprovada
    FROM orcamentos_cliente orc
    `,
    { sk_vendedor: skVendedor }
  )
  return new Map(rows.map((row) => {
    const item = normalizeRow(row)
    return [item.sk_cliente, { ...item, venda_comprovada: Number(item.venda_comprovada) === 1 }]
  }))
}

async function buscarSinaisCampanha(dbQuery, skVendedor) {
  const rows = await dbQuery(
    `
    SELECT DISTINCT cac.SK_CLIENTE
    FROM DM_VENDAS.CAMPANHAS_ATIVACAO_CLIENTES cac
    JOIN DM_VENDAS.CAMPANHAS_ATIVACAO ca ON ca.ID = cac.CAMPANHA_ID
    WHERE ca.VENDEDOR_ID = :sk_vendedor
      AND cac.STATUS_ENVIO IN (${STATUS_ENVIO_CAMPANHA_RELEVANTE.map((status) => `'${status}'`).join(", ")})
      AND NVL(cac.DATA_ENVIO_ZAPI, NVL(cac.ULTIMO_EVENTO_EM, ca.DATA_CRIACAO)) >= TRUNC(SYSDATE) - ${JANELA_CAMPANHA_RELEVANTE_DIAS}
    `,
    { sk_vendedor: skVendedor }
  )
  return new Set(rows.map((row) => normalizeRow(row).sk_cliente))
}

async function registrarInteracaoCampanha(dbQuery, { cardId, skVendedor }) {
  await addInteracao({
    dbQuery,
    cardId,
    skVendedor,
    tipo: "WHATSAPP",
    conteudo: "Campanha de ativação enviada nos últimos 30 dias.",
    autor: "Sistema",
  })
}

async function processarCandidato({ dbQuery, empresaId, skVendedor, skCliente, cardExistente, orcamento, temCampanha }) {
  // Venda comprovada sempre vence, mesmo sobre card MANUAL - mas so depois de o card ja existir.
  if (orcamento?.venda_comprovada && cardExistente) {
    if (cardExistente.coluna_atual !== "CONVERTIDO") {
      await moverCard(dbQuery, {
        cardId: cardExistente.id,
        skVendedor,
        novaColuna: "CONVERTIDO",
        origem: "AUTOMATICO",
        autor: "Sistema",
        motivo: "Venda comprovada em FATO_VENDAS_LUCRATIVIDADE.",
      })
    }
    return
  }

  if (cardExistente && cardExistente.origem_status === "MANUAL") {
    return // sync nao toca cards manuais (exceto venda comprovada, ja tratado acima)
  }

  if (!cardExistente) {
    if (orcamento && orcamento.status !== "VEN") {
      const colunaAlvo = ORCAMENTO_STATUS_COLUMN_MAP[orcamento.status]
      if (colunaAlvo && COLUNAS_ABERTAS.includes(colunaAlvo)) {
        const criado = await criarCardAutomatico({ dbQuery, empresaId, skVendedor, skCliente, colunaInicial: colunaAlvo })
        if (!criado) {
          await reprocessarAposCorrida({ dbQuery, empresaId, skVendedor, skCliente, orcamento, temCampanha })
        }
      }
      return
    }

    if (temCampanha) {
      const criado = await criarCardAutomatico({ dbQuery, empresaId, skVendedor, skCliente, colunaInicial: "EM_CONTATO" })
      if (criado) {
        await registrarInteracaoCampanha(dbQuery, { cardId: criado.id, skVendedor })
      } else {
        await reprocessarAposCorrida({ dbQuery, empresaId, skVendedor, skCliente, orcamento, temCampanha })
      }
    }
    return
  }

  // Card automatico ja existente - reconciliar com o sinal mais recente.
  if (orcamento && orcamento.status !== "VEN") {
    const colunaAlvo = ORCAMENTO_STATUS_COLUMN_MAP[orcamento.status]
    if (colunaAlvo && colunaAlvo !== cardExistente.coluna_atual) {
      await moverCard(dbQuery, {
        cardId: cardExistente.id,
        skVendedor,
        novaColuna: colunaAlvo,
        origem: "AUTOMATICO",
        autor: "Sistema",
        motivo: `Orcamento atualizado (status ${orcamento.status}).`,
      })
      return
    }
  }

  if (temCampanha && cardExistente.coluna_atual === "A_CONTATAR") {
    await moverCard(dbQuery, {
      cardId: cardExistente.id,
      skVendedor,
      novaColuna: "EM_CONTATO",
      origem: "AUTOMATICO",
      autor: "Sistema",
      motivo: "Campanha de ativacao enviada.",
    })
    await registrarInteracaoCampanha(dbQuery, { cardId: cardExistente.id, skVendedor })
    return
  }

  // Sem sinal novo: aplica regras de estagnacao.
  const dias = diasDesde(cardExistente.data_ultima_movimentacao)

  if (cardExistente.coluna_atual === "ORCAMENTO_ENVIADO" && dias !== null && dias >= JANELA_ORCAMENTO_PARADO_DIAS) {
    await moverCard(dbQuery, {
      cardId: cardExistente.id,
      skVendedor,
      novaColuna: "NAO_CONVERTIDO",
      origem: "AUTOMATICO",
      autor: "Sistema",
      motivo: `Orcamento enviado sem retorno ha ${dias} dias.`,
    })
    return
  }

  if (cardExistente.coluna_atual === "NAO_CONVERTIDO" && dias !== null && dias >= JANELA_ARQUIVAMENTO_DIAS) {
    await toggleArquivar({ dbQuery, cardId: cardExistente.id, skVendedor, arquivar: true, autor: "Sistema" })
  }
}

// Se criarCardAutomatico retornou null, outra execucao concorrente ja criou o card - reaproveita.
async function reprocessarAposCorrida({ dbQuery, empresaId, skVendedor, skCliente, orcamento, temCampanha }) {
  const cardsAtivos = await buscarCardsAtivos(dbQuery, skVendedor)
  const cardExistente = cardsAtivos.get(skCliente)
  if (!cardExistente) return
  await processarCandidato({ dbQuery, empresaId, skVendedor, skCliente, cardExistente, orcamento, temCampanha })
}

export async function sincronizarKanban({ dbQuery, empresaId, skVendedor }) {
  const [cardsAtivos, sinaisOrcamento, sinaisCampanha] = await Promise.all([
    buscarCardsAtivos(dbQuery, skVendedor),
    buscarSinaisOrcamento(dbQuery, skVendedor),
    buscarSinaisCampanha(dbQuery, skVendedor),
  ])

  const candidatos = new Set([...cardsAtivos.keys(), ...sinaisOrcamento.keys(), ...sinaisCampanha])
  const limit = pLimit(CONCORRENCIA_MAXIMA)

  await Promise.all(
    [...candidatos].map((skCliente) =>
      limit(() =>
        processarCandidato({
          dbQuery,
          empresaId,
          skVendedor,
          skCliente,
          cardExistente: cardsAtivos.get(skCliente) ?? null,
          orcamento: sinaisOrcamento.get(skCliente) ?? null,
          temCampanha: sinaisCampanha.has(skCliente),
        }).catch((error) => {
          console.error(`Erro ao sincronizar kanban do cliente ${skCliente} (vendedor ${skVendedor}):`, error)
        })
      )
    )
  )
}

/**
 * Lista os SK_VENDEDOR com algum sinal que a sincronizacao levaria em conta (orcamento recente,
 * campanha de ativacao recente ou card ja existente no kanban). O board so e sincronizado quando
 * o vendedor abre a tela (getBoard chama sincronizarKanban so para o skVendedor da requisicao) -
 * esta funcao existe para permitir um backfill que rode a sincronizacao proativamente para todos
 * os vendedores com sinal pendente, em vez de depender de alguem acessar a tela.
 */
export async function listarVendedoresComSinalPendente(dbQuery) {
  const statusIgnorar = ORCAMENTO_STATUS_IGNORAR.map((status) => `'${status}'`).join(", ")
  const statusEnvio = STATUS_ENVIO_CAMPANHA_RELEVANTE.map((status) => `'${status}'`).join(", ")

  const rows = await dbQuery(`
    SELECT DISTINCT sk_vendedor FROM (
      SELECT ven.sk_vendedor
      FROM fato_orcamento orc
      JOIN dim_vendedor ven ON ven.vendedor_id = orc.vendedor_id
      WHERE orc.status NOT IN (${statusIgnorar})
        AND orc.data_cadastro >= TRUNC(SYSDATE) - ${JANELA_ORCAMENTO_RELEVANTE_DIAS}

      UNION

      SELECT ca.VENDEDOR_ID AS sk_vendedor
      FROM DM_VENDAS.CAMPANHAS_ATIVACAO_CLIENTES cac
      JOIN DM_VENDAS.CAMPANHAS_ATIVACAO ca ON ca.ID = cac.CAMPANHA_ID
      WHERE cac.STATUS_ENVIO IN (${statusEnvio})
        AND NVL(cac.DATA_ENVIO_ZAPI, NVL(cac.ULTIMO_EVENTO_EM, ca.DATA_CRIACAO)) >= TRUNC(SYSDATE) - ${JANELA_CAMPANHA_RELEVANTE_DIAS}

      UNION

      SELECT SK_VENDEDOR AS sk_vendedor FROM CRM_KANBAN_CARD
    )
  `)

  return rows.map((row) => normalizeRow(row).sk_vendedor)
}
