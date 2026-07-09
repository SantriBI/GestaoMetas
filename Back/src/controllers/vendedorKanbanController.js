import { getScopedEmpresaId } from "../services/requestScope.js"
import { getAllowedSellerCodesByEmpresaId, isSellerAllowed } from "../services/tenantSellerScope.js"
import {
  KanbanError,
  getScopedQuery,
  criarCardManual,
  moverCardManual,
  toggleArquivar,
  addInteracao,
  listCards,
  listCardsColuna,
  listCardsArquivados,
  getCardDetail,
} from "../services/kanban/kanbanCardService.js"
import { sincronizarKanban } from "../services/kanban/kanbanSyncService.js"
import { buscarClientesCarteira } from "../services/kanban/kanbanClienteSearchService.js"

const DEFAULT_DIAS_ATIVIDADE_MAX = 30
const DEFAULT_LIMIT_POR_COLUNA = 30
const MAX_LIMIT_POR_COLUNA = 100

function handleKanbanError(res, error, fallbackMessage) {
  if (error instanceof KanbanError) {
    return res.status(error.statusCode).json({ error: error.message })
  }

  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

function obterAutor(req) {
  return String(req.auth?.nome ?? req.auth?.login ?? "Vendedor").trim() || "Vendedor"
}

function obterDiasAtividadeMax(req) {
  const raw = req.query.diasAtividadeMax
  if (raw === undefined || raw === null || raw === "" || raw === "0") return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DIAS_ATIVIDADE_MAX
}

function obterLimitPorColuna(req) {
  const parsed = Number(req.query.limit)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT_POR_COLUNA
  return Math.min(parsed, MAX_LIMIT_POR_COLUNA)
}

async function resolverEscopo(req, res) {
  const { sk_vendedor: skVendedor } = req.params
  const empresaId = getScopedEmpresaId(req)

  if (!empresaId) {
    res.status(400).json({ error: "empresa_id e obrigatorio para o kanban de carteira." })
    return null
  }

  const role = String(req.auth?.role ?? "").toUpperCase()
  if (role === "VENDEDOR" && String(req.auth?.sk_vendedor ?? "") !== String(skVendedor)) {
    res.status(403).json({ error: "Acesso permitido apenas aos dados do vendedor autenticado." })
    return null
  }

  const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(empresaId)
  if (!isSellerAllowed(allowedSellerCodes, skVendedor)) {
    res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
    return null
  }

  return {
    empresaId,
    skVendedor,
    dbQuery: getScopedQuery(empresaId),
  }
}

export async function getBoard(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    await sincronizarKanban({ dbQuery: escopo.dbQuery, empresaId: escopo.empresaId, skVendedor: escopo.skVendedor })

    const board = await listCards({
      dbQuery: escopo.dbQuery,
      empresaId: escopo.empresaId,
      skVendedor: escopo.skVendedor,
      diasAtividadeMax: obterDiasAtividadeMax(req),
      limitPorColuna: obterLimitPorColuna(req),
    })

    res.json({ data: board })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao carregar o kanban de carteira.")
  }
}

export async function getArquivados(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const offset = Number(req.query.offset) || 0
    const limit = Math.min(Number(req.query.limit) || 50, 100)

    const cards = await listCardsArquivados({
      dbQuery: escopo.dbQuery,
      empresaId: escopo.empresaId,
      skVendedor: escopo.skVendedor,
      offset,
      limit,
    })
    res.json({ data: { cards } })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao carregar cards arquivados.")
  }
}

export async function getColunaPagina(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const { coluna } = req.params
    const offset = Number(req.query.offset) || 0
    const limit = obterLimitPorColuna(req)

    const cards = await listCardsColuna({
      dbQuery: escopo.dbQuery,
      empresaId: escopo.empresaId,
      skVendedor: escopo.skVendedor,
      coluna,
      offset,
      limit,
      diasAtividadeMax: obterDiasAtividadeMax(req),
    })

    res.json({ data: { cards } })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao carregar a coluna do kanban.")
  }
}

export async function getClientesBusca(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const clientes = await buscarClientesCarteira({
      dbQuery: escopo.dbQuery,
      empresaId: escopo.empresaId,
      skVendedor: escopo.skVendedor,
      termo: req.query.q,
    })

    res.json({ data: clientes })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao buscar clientes da carteira.")
  }
}

export async function postCard(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const resultado = await criarCardManual({
      dbQuery: escopo.dbQuery,
      empresaId: escopo.empresaId,
      skVendedor: escopo.skVendedor,
      skCliente: req.body?.sk_cliente,
      colunaInicial: req.body?.coluna_inicial,
      autor: obterAutor(req),
    })

    res.status(201).json({ data: resultado })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao criar card do kanban.")
  }
}

export async function getCardDetalhe(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const detalhe = await getCardDetail({
      dbQuery: escopo.dbQuery,
      empresaId: escopo.empresaId,
      cardId: req.params.cardId,
      skVendedor: escopo.skVendedor,
    })

    res.json({ data: detalhe })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao carregar detalhe do card.")
  }
}

export async function patchCard(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const resultado = await moverCardManual({
      dbQuery: escopo.dbQuery,
      cardId: req.params.cardId,
      skVendedor: escopo.skVendedor,
      novaColuna: req.body?.coluna,
      autor: obterAutor(req),
    })

    res.json({ data: resultado })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao mover card do kanban.")
  }
}

export async function postInteracao(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const resultado = await addInteracao({
      dbQuery: escopo.dbQuery,
      cardId: req.params.cardId,
      skVendedor: escopo.skVendedor,
      tipo: req.body?.tipo,
      conteudo: req.body?.conteudo,
      autor: obterAutor(req),
    })

    res.status(201).json({ data: resultado })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao registrar interacao do card.")
  }
}

export async function patchArquivar(req, res) {
  try {
    const escopo = await resolverEscopo(req, res)
    if (!escopo) return

    const resultado = await toggleArquivar({
      dbQuery: escopo.dbQuery,
      cardId: req.params.cardId,
      skVendedor: escopo.skVendedor,
      arquivar: req.body?.arquivar !== false,
      autor: obterAutor(req),
    })

    res.json({ data: resultado })
  } catch (error) {
    handleKanbanError(res, error, "Erro ao arquivar/desarquivar card.")
  }
}
