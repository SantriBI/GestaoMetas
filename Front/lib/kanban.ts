import { CheckCircle2, FileText, MessageCircle, Phone, XCircle, type LucideIcon } from "lucide-react"

export type KanbanColunaId = "A_CONTATAR" | "EM_CONTATO" | "ORCAMENTO_ENVIADO" | "CONVERTIDO" | "NAO_CONVERTIDO"

export type KanbanOrigemStatus = "AUTOMATICO" | "MANUAL"

export type KanbanTipoInteracao = "ANOTACAO" | "LIGACAO" | "WHATSAPP" | "EMAIL" | "REUNIAO" | "MUDANCA_COLUNA"

export interface KanbanCard {
  id: number
  sk_cliente: number
  nome_cliente: string | null
  cpf: string | null
  cnpj: string | null
  nome_grupo: string | null
  classificacao_rfv: string | null
  coluna_atual: KanbanColunaId
  origem_status: KanbanOrigemStatus
  ordem: number
  data_criacao: string | null
  data_ultima_movimentacao: string | null
  dias_desde_ultimo_sinal: number | null
  valor_orcamento: number | null
  orcamento_status: string | null
  orcamento_status_descricao: string | null
  prioridade: number | null
}

export interface KanbanColunaData {
  coluna: KanbanColunaId
  total: number
  totalSemFiltro: number
  valorAberto: number
  cards: KanbanCard[]
  temMais: boolean
}

export interface KanbanBoard {
  colunas: KanbanColunaData[]
}

export interface KanbanInteracao {
  id: number
  tipo: KanbanTipoInteracao
  conteudo: string | null
  coluna_origem: KanbanColunaId | null
  coluna_destino: KanbanColunaId | null
  autor: string | null
  data: string | null
}

export interface KanbanCardDetail {
  card: {
    id: number
    coluna_atual: KanbanColunaId
    origem_status: KanbanOrigemStatus
    arquivado: boolean
    data_criacao: string | null
    data_ultima_movimentacao: string | null
  }
  cliente: {
    sk_cliente: number
    nome_cliente: string | null
    cpf: string | null
    cnpj: string | null
    tipo_cliente: string | null
    cliente_desde: string | null
    nome_grupo: string | null
    telefone: string | null
    classificacao_rfv: string | null
    recencia: number | null
    frequencia: number | null
    valor_potencial: number | null
  }
  orcamentoAberto: {
    status: string
    descricao_status: string
    valor_pedido: number
    data_cadastro: string | number | null
  } | null
  ultimasVendas: Array<{ orcamento_id: number | string; sk_dt_fechamento: number | string | null; valor: number }>
  interacoes: KanbanInteracao[]
}

export interface KanbanClienteBusca {
  sk_cliente: number
  nome_cliente: string | null
  cpf: string | null
  cnpj: string | null
  tipo_cliente: string | null
  jaNoKanban: boolean
}

export const KANBAN_COLUNAS: KanbanColunaId[] = [
  "A_CONTATAR",
  "EM_CONTATO",
  "ORCAMENTO_ENVIADO",
  "CONVERTIDO",
  "NAO_CONVERTIDO",
]

export const KANBAN_COLUNA_LABELS: Record<KanbanColunaId, string> = {
  A_CONTATAR: "A Contatar",
  EM_CONTATO: "Em Contato",
  ORCAMENTO_ENVIADO: "Em Negociação",
  CONVERTIDO: "Convertido",
  NAO_CONVERTIDO: "Não Convertido",
}

export const KANBAN_COLUNA_MENSAGEM_VAZIA: Record<KanbanColunaId, string> = {
  A_CONTATAR: "Comece adicionando um cliente à esteira.",
  EM_CONTATO: "Tudo tranquilo por aqui — nenhuma conversa em andamento.",
  ORCAMENTO_ENVIADO: "Nenhuma negociação em aberto no momento.",
  CONVERTIDO: "Ainda sem vendas convertidas por aqui.",
  NAO_CONVERTIDO: "Nada por aqui — nenhuma oportunidade perdida recentemente.",
}

export const KANBAN_COLUNA_ICONES: Record<KanbanColunaId, LucideIcon> = {
  A_CONTATAR: Phone,
  EM_CONTATO: MessageCircle,
  ORCAMENTO_ENVIADO: FileText,
  CONVERTIDO: CheckCircle2,
  NAO_CONVERTIDO: XCircle,
}

export interface KanbanColunaVisual {
  accent: string
  accentSoft: string
  iconBg: string
  iconColor: string
}

// Cores literais (nao classes Tailwind) para nao depender de purge/JIT - mesma abordagem de
// SegmentStep.tsx para "cor por categoria". amber / azul / violeta / esmeralda / vermelho.
export const KANBAN_COLUNA_CORES: Record<KanbanColunaId, KanbanColunaVisual> = {
  A_CONTATAR: {
    accent: "#f59e0b",
    accentSoft: "rgba(245,158,11,0.14)",
    iconBg: "rgba(245,158,11,0.16)",
    iconColor: "#fbbf24",
  },
  EM_CONTATO: {
    accent: "#3b82f6",
    accentSoft: "rgba(59,130,246,0.14)",
    iconBg: "rgba(59,130,246,0.16)",
    iconColor: "#60a5fa",
  },
  ORCAMENTO_ENVIADO: {
    accent: "#8b5cf6",
    accentSoft: "rgba(139,92,246,0.14)",
    iconBg: "rgba(139,92,246,0.16)",
    iconColor: "#a78bfa",
  },
  CONVERTIDO: {
    accent: "#10b981",
    accentSoft: "rgba(16,185,129,0.14)",
    iconBg: "rgba(16,185,129,0.16)",
    iconColor: "#34d399",
  },
  NAO_CONVERTIDO: {
    accent: "#ef4444",
    accentSoft: "rgba(239,68,68,0.14)",
    iconBg: "rgba(239,68,68,0.16)",
    iconColor: "#f87171",
  },
}

export interface KanbanRfvVisual {
  label: string
  accent: string
  bg: string
}

const RFV_VISUAL_MAP: Record<string, KanbanRfvVisual> = {
  CAMPEOES: { label: "Campeões", accent: "#f4c95d", bg: "rgba(212,166,60,0.18)" },
  "CLIENTES FIEIS": { label: "Clientes Fiéis", accent: "#60a5fa", bg: "rgba(59,130,246,0.18)" },
  PROMISSORES: { label: "Promissores", accent: "#38bdf8", bg: "rgba(14,165,233,0.18)" },
  "EM RISCO": { label: "Em Risco", accent: "#f87171", bg: "rgba(239,68,68,0.18)" },
  HIBERNANDO: { label: "Hibernando", accent: "#94a3b8", bg: "rgba(100,116,139,0.18)" },
}

const SUBSTITUICOES_ACENTO: Array<[string, string]> = [
  ["Õ", "O"],
  ["É", "E"],
  ["Ê", "E"],
  ["Á", "A"],
  ["Ã", "A"],
  ["Í", "I"],
  ["Ó", "O"],
  ["Ú", "U"],
  ["Ç", "C"],
]

export function normalizarClassificacao(value: string) {
  const maiuscula = value.trim().toUpperCase()
  return SUBSTITUICOES_ACENTO.reduce((atual, [acento, sem]) => atual.split(acento).join(sem), maiuscula)
}

export function getRfvVisual(classificacao: string | null | undefined): KanbanRfvVisual | null {
  if (!classificacao) return null
  const chave = normalizarClassificacao(classificacao)
  return RFV_VISUAL_MAP[chave] ?? { label: classificacao, accent: "#94a3b8", bg: "rgba(148,163,184,0.16)" }
}

export const KANBAN_RFV_OPCOES = ["CAMPEOES", "CLIENTES FIEIS", "PROMISSORES", "EM RISCO", "HIBERNANDO"] as const

export class KanbanApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "KanbanApiError"
    this.status = status
  }
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  })

  return search.toString()
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new KanbanApiError(String(payload?.error ?? `Falha na requisição ${response.status}`), response.status)
  }

  return payload as T
}

export async function fetchKanbanBoard(
  skVendedor: number | string,
  params: { diasAtividadeMax?: number | null; limit?: number } = {}
) {
  const query = buildQuery({ diasAtividadeMax: params.diasAtividadeMax ?? undefined, limit: params.limit })
  const payload = await fetchJson<{ data: KanbanBoard }>(
    `/api/vendedor/${skVendedor}/kanban${query ? `?${query}` : ""}`
  )
  return payload.data
}

export async function fetchKanbanArquivados(
  skVendedor: number | string,
  params: { offset?: number; limit?: number } = {}
) {
  const query = buildQuery({ offset: params.offset, limit: params.limit })
  const payload = await fetchJson<{ data: { cards: KanbanCard[] } }>(
    `/api/vendedor/${skVendedor}/kanban/arquivados${query ? `?${query}` : ""}`
  )
  return payload.data.cards
}

export async function fetchKanbanColunaPagina(
  skVendedor: number | string,
  coluna: KanbanColunaId,
  params: { offset?: number; limit?: number; diasAtividadeMax?: number | null } = {}
) {
  const query = buildQuery({
    offset: params.offset,
    limit: params.limit,
    diasAtividadeMax: params.diasAtividadeMax ?? undefined,
  })
  const payload = await fetchJson<{ data: { cards: KanbanCard[] } }>(
    `/api/vendedor/${skVendedor}/kanban/coluna/${coluna}${query ? `?${query}` : ""}`
  )
  return payload.data.cards
}

export async function searchKanbanClientes(skVendedor: number | string, termo: string) {
  const query = buildQuery({ q: termo })
  const payload = await fetchJson<{ data: KanbanClienteBusca[] }>(
    `/api/vendedor/${skVendedor}/clientes/busca?${query}`
  )
  return payload.data
}

export async function createKanbanCard(
  skVendedor: number | string,
  body: { sk_cliente: number | string; coluna_inicial?: KanbanColunaId }
) {
  const payload = await fetchJson<{ data: { id: number; coluna_atual: KanbanColunaId } }>(
    `/api/vendedor/${skVendedor}/kanban/cards`,
    { method: "POST", body: JSON.stringify(body) }
  )
  return payload.data
}

export async function fetchKanbanCardDetail(skVendedor: number | string, cardId: number | string) {
  const payload = await fetchJson<{ data: KanbanCardDetail }>(
    `/api/vendedor/${skVendedor}/kanban/cards/${cardId}`
  )
  return payload.data
}

export async function moveKanbanCard(skVendedor: number | string, cardId: number | string, coluna: KanbanColunaId) {
  const payload = await fetchJson<{ data: { id: number; coluna_atual: KanbanColunaId; alterado: boolean } }>(
    `/api/vendedor/${skVendedor}/kanban/cards/${cardId}`,
    { method: "PATCH", body: JSON.stringify({ coluna }) }
  )
  return payload.data
}

export async function addKanbanInteracao(
  skVendedor: number | string,
  cardId: number | string,
  body: { tipo: Exclude<KanbanTipoInteracao, "MUDANCA_COLUNA">; conteudo: string }
) {
  const payload = await fetchJson<{ data: { id: number } }>(
    `/api/vendedor/${skVendedor}/kanban/cards/${cardId}/interacoes`,
    { method: "POST", body: JSON.stringify(body) }
  )
  return payload.data
}

export async function toggleKanbanArquivar(skVendedor: number | string, cardId: number | string, arquivar: boolean) {
  const payload = await fetchJson<{ data: { id: number; arquivado: boolean } }>(
    `/api/vendedor/${skVendedor}/kanban/cards/${cardId}/arquivar`,
    { method: "PATCH", body: JSON.stringify({ arquivar }) }
  )
  return payload.data
}

export function diasDesde(data: string | Date | null | undefined): number | null {
  if (!data) return null
  const date = typeof data === "string" ? new Date(data) : data
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

export function formatCurrencyBRL(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatDataChaveNumerica(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const raw = String(value)
  if (!/^\d{8}$/.test(raw)) return null
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`
}

export function formatDataISO(value: string | Date | null | undefined) {
  if (!value) return null
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("pt-BR")
}
