export interface LojaAcesso {
  empresaAcesso: string
  nomeResumido: string
}

export interface MinhasLojasResponse {
  lojas: LojaAcesso[]
  exibirSeletor: boolean
  permiteTodasLojas: boolean
  empresaAcessoPadrao: string | null
}

export const TODAS_LOJAS_VALUE = "TODAS"

export async function fetchMinhasLojas(): Promise<MinhasLojasResponse> {
  const response = await fetch("/api/minhas-lojas", {
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    return { lojas: [], exibirSeletor: false, permiteTodasLojas: false, empresaAcessoPadrao: null }
  }

  const data = await response.json().catch(() => null)
  return {
    lojas: Array.isArray(data?.lojas) ? data.lojas : [],
    exibirSeletor: Boolean(data?.exibirSeletor),
    permiteTodasLojas: Boolean(data?.permiteTodasLojas),
    empresaAcessoPadrao: data?.empresaAcessoPadrao ? String(data.empresaAcessoPadrao) : null,
  }
}
