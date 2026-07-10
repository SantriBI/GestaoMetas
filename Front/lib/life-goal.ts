export interface LifeGoalMessage {
  id: string
  title: string
  message: string
  actionLabel?: string | null
  actionHref?: string | null
}

export interface SellerLifeProfile {
  id: number
  empresaId: number | string | null
  vendedorId: number | string | null
  rendaDesejada: number | null
  salarioFixo: number | null
  comissaoDesejada: number | null
  motivoTrabalho: string | null
  paraQuemTrabalha: string | null
  objetivosPessoais: string | null
  preferenciasProduto: string | null
  criadoEm: string | Date | null
}

export interface LifeGoalObjective {
  id: number
  empresaId: number | string | null
  vendedorId: number | string | null
  skVendedor: number | string | null
  nomeObjetivo: string | null
  valorObjetivo: number
  dataLimite: string | Date | null
  ativo: boolean
  criadoEm: string | Date | null
  atualizadoEm: string | Date | null
  status: "SEM_OBJETIVO" | "EM_ANDAMENTO" | "CONQUISTADA" | "PRAZO_ENCERRADO"
  totalConquistado: number
  valorRestante: number
  percentualConquistado: number
}

export interface LifeGoalSummary {
  quantidadeObjetivos: number
  valorTotalObjetivos: number
  ganhoTotal: number
  faltaTotal: number
  percentualTotal: number
  objetivosConquistados: number
}

export interface LifeGoalResponse {
  status: "SEM_OBJETIVO" | "EM_ANDAMENTO" | "CONQUISTADA" | "PRAZO_ENCERRADO"
  seller: {
    skVendedor: number | string | null
    vendedorId: number | string | null
    empresaId: number | string | null
    nomeVendedor: string | null
  }
  profile: SellerLifeProfile | null
  objective: LifeGoalObjective | null
  objectives: LifeGoalObjective[]
  summary: LifeGoalSummary
  tracking: {
    startedAt: string | Date | null
    deadlineAt: string | Date | null
    closestDeadlineAt: string | Date | null
    daysToDeadline: number
    daysToClosestDeadline: number
    daysToMonthEnd: number
    commissionRate: number
    commissionRatePercent: number
  }
  ganhos: {
    faturamentoConsiderado: number
    comissao: number
    comissaoOrigem?: "oracle" | "estimada" | string
    bonus: number
    desafios: number
    totalConquistado: number
    valorRestante: number
    percentualConquistado: number
    valorTotalObjetivos: number
    quantidadeObjetivos: number
  }
  simulator: {
    taxaComissao: number
    valorBaseSugerido: number
    comissaoEstimadaValorBase: number
    vendaDiariaNecessariaAteFimDoMes: number
    vendaDiariaNecessariaAtePrazo: number
  }
  insights: {
    preferredOpenQuotes: {
      category: string | null
      count: number
      value: number
    } | null
    championOpportunity: {
      championsCount: number
      championsWithOpenQuotes: number
      openQuotesCount: number
      topChampionName: string | null
      topChampionValue: number
    } | null
  }
  suggestions: LifeGoalMessage[]
  recommendations: LifeGoalMessage[]
  capabilities: {
    challengesEnabled: boolean
    profileEnabled: boolean
    profileScriptPath: string | null
    multipleObjectives: boolean
  }
}

export interface LifeGoalListResponse {
  seller: LifeGoalResponse["seller"]
  objectives: LifeGoalObjective[]
  summary: LifeGoalSummary
}

export interface LifeGoalPayload {
  sk_vendedor?: number | string | null
  vendedor_id?: number | string | null
  empresa_id?: number | string | null
  nome_objetivo: string
  valor_objetivo: number
  data_limite: string
}

export interface SellerProfilePayload {
  sk_vendedor?: number | string | null
  vendedor_id?: number | string | null
  empresa_id?: number | string | null
  renda_desejada?: number | null
  salario_fixo?: number | null
  comissao_desejada?: number | null
  motivo_trabalho?: string | null
  para_quem_trabalha?: string | null
  objetivos_pessoais?: string | null
  preferencias_produto?: string | null
}

export interface SellerProfileResponse {
  seller: LifeGoalResponse["seller"]
  profile: SellerLifeProfile | null
}

export class LifeGoalApiError extends Error {
  code: string | null
  details: unknown
  status: number
  payload: unknown

  constructor(message: string, options?: { code?: string | null; details?: unknown; status?: number; payload?: unknown }) {
    super(message)
    this.name = "LifeGoalApiError"
    this.code = options?.code ?? null
    this.details = options?.details ?? null
    this.status = options?.status ?? 500
    this.payload = options?.payload ?? null
  }
}

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new LifeGoalApiError(payload?.error ?? "Erro ao carregar Minha Meta de Vida.", {
      code: payload?.code ?? null,
      details: payload?.details ?? null,
      status: response.status,
      payload,
    })
  }

  return payload as T
}

export async function fetchSellerLifeGoal(vendedorId: number | string, empresaAcesso?: string | null) {
  const query = empresaAcesso ? `?empresa_acesso=${encodeURIComponent(empresaAcesso)}` : ""
  return request<LifeGoalResponse>(`/api/objetivo-vendedor/${vendedorId}${query}`)
}

export async function fetchSellerLifeGoals(vendedorId: number | string) {
  return request<LifeGoalListResponse>(`/api/objetivos-vendedor/${vendedorId}`)
}

export async function createSellerLifeGoal(payload: LifeGoalPayload) {
  return request<LifeGoalResponse>("/api/objetivo-vendedor", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateSellerLifeGoal(id: number | string, payload: LifeGoalPayload) {
  return request<LifeGoalResponse>(`/api/objetivo-vendedor/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function fetchSellerProfile(vendedorId: number | string) {
  return request<SellerProfileResponse>(`/api/perfil-vendedor/${vendedorId}`)
}

export async function createSellerProfile(payload: SellerProfilePayload) {
  return request<SellerProfileResponse>("/api/perfil-vendedor", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateSellerProfile(id: number | string, payload: SellerProfilePayload) {
  return request<SellerProfileResponse>(`/api/perfil-vendedor/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function formatLifeGoalStatus(status: LifeGoalResponse["status"] | LifeGoalObjective["status"]) {
  switch (status) {
    case "CONQUISTADA":
      return "Conquistada"
    case "PRAZO_ENCERRADO":
      return "Prazo encerrado"
    case "EM_ANDAMENTO":
      return "Em andamento"
    default:
      return "Sem objetivo"
  }
}
