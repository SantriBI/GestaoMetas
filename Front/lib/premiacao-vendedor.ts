export interface MinhaPremiacao {
  vendedorId: number | string | null
  nomeVendedor: string | null
  mesReferencia: string | null
  valorComissaoBase: number
  margemMaisFrete: number
  statusGatilho: string | null
  elegivel: boolean
  faixaAcelerador: string | null
  percAcelerador: number
  bonusFixoAdicional: number
  valorPremiacaoFinal: number
  gatilhoMinimoMargem: number
  faltanteGatilho: number
  faltanteProximaFaixa: number | null
}

export class PremiacaoVendedorApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = "PremiacaoVendedorApiError"
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new PremiacaoVendedorApiError(payload?.error ?? "Erro ao carregar sua premiacao.", response.status)
  }

  return payload as T
}

export async function fetchMinhaPremiacao() {
  const { data } = await request<{ data: MinhaPremiacao }>("/api/premiacao/minha-premiacao")
  return data
}

export interface PremiacaoEquipeVendedor {
  skVendedor: number | null
  vendedorId: number | string | null
  nomeVendedor: string | null
  mesReferencia: string | null
  valorComissaoBase: number
  // null quando a origem dos dados nao guarda margem+frete "crua" (fechamento historico em
  // FT_COMISSAO_HISTORICO - so o resultado ja derivado dela). No mes atual sempre vem numero.
  margemMaisFrete: number | null
  statusGatilho: string | null
  elegivel: boolean
  faixaAcelerador: string | null
  percAcelerador: number
  bonusFixoAdicional: number
  valorPremiacaoFinal: number
  gatilhoMinimoMargem: number
  faltanteGatilho: number
  faltanteProximaFaixa: number | null
}

export interface PremiacaoEquipeResumo {
  totalVendedores: number
  totalElegiveis: number
  totalNaoElegiveis: number
  somaValorPremiacaoFinal: number
  totalProximosDoGatilho: number
  limiarProximoDoGatilho: number
  mesReferencia: string | null
}

export interface PremiacaoEquipe {
  mesReferencia: string | null
  vendedores: PremiacaoEquipeVendedor[]
  resumo: PremiacaoEquipeResumo
}

// Mesmo padrao de escopo de loja do ranking (buildRankingUrl em app/dashboard/page.tsx):
// empresa_acesso e sempre revalidado no backend contra o escopo real do gerente
// (getScopedLojaScope), nunca aceito como confiavel so por vir do frontend.
//
// `mes` e opcional - "atual"/undefined mantem o comportamento de sempre (le a view do mes em
// andamento); um mes no formato "MM/YYYY" (vindo de fetchMesesDisponiveis) le o fechamento
// daquele mes em FT_COMISSAO_HISTORICO.
export async function fetchPremiacaoEquipe(empresaAcesso?: string | null, mes?: string | null) {
  const params = new URLSearchParams()
  if (empresaAcesso) params.set("empresa_acesso", empresaAcesso)
  if (mes && mes !== "atual") params.set("mes", mes)
  const query = params.toString()

  const { data } = await request<{ data: PremiacaoEquipe }>(
    `/api/premiacao/equipe${query ? `?${query}` : ""}`
  )
  return data
}

export interface MesesDisponiveisPremiacao {
  mesesDisponiveis: string[]
}

export async function fetchMesesDisponiveisPremiacao(empresaAcesso?: string | null) {
  const params = new URLSearchParams()
  if (empresaAcesso) params.set("empresa_acesso", empresaAcesso)
  const query = params.toString()

  const { data } = await request<{ data: MesesDisponiveisPremiacao }>(
    `/api/premiacao/meses-disponiveis${query ? `?${query}` : ""}`
  )
  return data
}
