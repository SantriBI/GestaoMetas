export type NivelGrupoPremiacao = 1 | 2 | 3

export interface GrupoPercentualPremiacao {
  nomeGrupo: string
  percentual: number | null
  vigenteDesde: string | null
}

export class ParametrosPremiacaoApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = "ParametrosPremiacaoApiError"
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
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
    throw new ParametrosPremiacaoApiError(payload?.error ?? "Erro ao comunicar com o servidor.", response.status)
  }

  return payload as T
}

export async function fetchGruposPercentualPremiacao(nivel: NivelGrupoPremiacao) {
  const { data } = await request<{ data: GrupoPercentualPremiacao[] }>(
    `/api/parametros-premiacao/grupos?nivel=${nivel}`
  )
  return data
}

export async function salvarPercentualPremiacao(nivel: NivelGrupoPremiacao, nomeGrupo: string, percentual: number) {
  const { data } = await request<{ data: GrupoPercentualPremiacao }>(
    `/api/parametros-premiacao/grupos/${nivel}/${encodeURIComponent(nomeGrupo)}`,
    {
      method: "POST",
      body: JSON.stringify({ percentual }),
    }
  )
  return data
}
