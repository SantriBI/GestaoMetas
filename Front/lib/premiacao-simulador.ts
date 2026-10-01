export interface SimuladorPremiacaoResultado {
  grupo: { nivel: number; nomeGrupo: string }
  valorVendaAdicional: number
  ratioMargemPorReal: number
  percentualGrupoCadastrado: number | null
  atual: {
    margemMaisFrete: number
    valorComissaoBase: number
    elegivel: boolean
    faixaAcelerador: string | null
    percAcelerador: number
    bonusFixoAdicional: number
    valorPremiacaoFinal: number
  }
  simulado: {
    margemMaisFrete: number
    valorComissaoBase: number
    elegivel: boolean
    percAcelerador: number
    bonusFixoAdicional: number
    valorPremiacaoFinal: number
    faltanteProximaFaixa: number | null
  }
  diferenca: {
    margemMaisFrete: number
    valorPremiacaoFinal: number
  }
}

export interface ContadoresVendaPremiacao {
  grupoPreferido: { nivel: number; nomeGrupo: string } | null
  ratioMargemPorReal: number | null
  faltanteGatilhoEmVenda: number | null
  faltanteProximaFaixaEmVenda: number | null
}

export interface FaixaAcelerador {
  id: number | null
  limiteInferior: number
  limiteSuperior: number | null
  percAcelerador: number
  bonusFixoAdicional: number
  vigenteDesde: string | null
}

export class PremiacaoSimuladorApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = "PremiacaoSimuladorApiError"
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
    throw new PremiacaoSimuladorApiError(payload?.error ?? "Erro ao comunicar com o simulador de premiacao.", response.status)
  }

  return payload as T
}

export interface GrupoHistoricoVendedor {
  nomeGrupo: string
  receitaHistorica: number
}

export async function fetchGruposSimulador(nivel = 3) {
  const { data } = await request<{ data: GrupoHistoricoVendedor[] }>(
    `/api/premiacao/minha-premiacao/simulador/grupos?nivel=${nivel}`
  )
  return data
}

export async function fetchSimuladorPremiacao(nivel: number, grupoNome: string, valorVendaAdicional: number) {
  const params = new URLSearchParams({
    nivel: String(nivel),
    grupo: grupoNome,
    valor: String(valorVendaAdicional),
  })

  const { data } = await request<{ data: SimuladorPremiacaoResultado }>(
    `/api/premiacao/minha-premiacao/simulador?${params.toString()}`
  )
  return data
}

export async function fetchContadoresVendaPremiacao(nivel = 3) {
  const { data } = await request<{ data: ContadoresVendaPremiacao }>(
    `/api/premiacao/minha-premiacao/contadores?nivel=${nivel}`
  )
  return data
}

export async function fetchFaixasAcelerador() {
  const { data } = await request<{ data: FaixaAcelerador[] }>("/api/premiacao/faixas-acelerador")
  return data
}

export async function salvarFaixasAcelerador(faixas: Array<Pick<FaixaAcelerador, "limiteInferior" | "limiteSuperior" | "percAcelerador" | "bonusFixoAdicional">>) {
  const { data } = await request<{ data: FaixaAcelerador[] }>("/api/premiacao/faixas-acelerador", {
    method: "POST",
    body: JSON.stringify({ faixas }),
  })
  return data
}
