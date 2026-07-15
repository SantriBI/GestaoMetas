export type ViewMode = "mensal" | "diario"

export type RadarAlertaTipo =
  | "sucesso"
  | "alerta"
  | "queda"

export interface RadarAlerta {
  tipo_alerta: RadarAlertaTipo
  mensagem: string
}

export interface RadarVendasResponse {
  equipe: RadarAlerta[]
  clientes: RadarAlerta[]
  categorias: RadarAlerta[]
}

export interface VendedorPanorama {
  indicadores: {
    vendedorId: number | string | null
    nome: string | null
    receita_mes: number
    meta_mensal: number
    falta_meta: number
    percentual_meta: number
  }
  performance: {
    clientes_atendidos_mes: number
    ticket_medio: number
    quantidade_vendas: number
    ultima_venda: string | number | null
    orcamentos_abertos: number
    valor_orcamentos: number
  }
  top_produtos: Array<{
    grupo: string
    receita: number
    participacao: number
  }>
  top_clientes: Array<{
    nome_cliente: string | null
    classificacao: string | null
    receita: number
    ultima_compra: string | number | null
  }>
  rfv: {
    campeoes: number
    fieis: number
    emRisco: number
    novos: number
  }
  ultimas_vendas: Array<{
    cliente: string | null
    valor: number
    qtd_produtos: number
    data: string | number | null
  }>
}

export interface Vendedor {
  sk_empresa: number | string
  sk_vendedor: number | string
  nome_vendedor: string
  metaHerdada?: number | string
  meta_herdada?: number | string
  META_HERDADA?: number | string

  // mensal
  receita_mes?: number | string
  meta_mes?: number | string
  perc_atingimento?: number | string
  ranking_atingimento?: number | string

  // diario
  receita_dia?: number | string
  meta_diaria_necessaria?: number | string
  status_dia?: string
  ranking_dia?: number | string
}
export interface VendedorDia {
  sk_empresa: number
  sk_vendedor: number
  nome_vendedor: string

  receita_dia: number
  meta_mes: number
  dias_restantes: number
  meta_diaria_necessaria: number
  status_dia: 'OK' | 'DEVENDO'
  ranking_dia: number
}

export interface VendedorProcessado {
  id: number
  nome: string
  iniciais: string
  receita: number
  meta: number
  percentual: number
  ranking: number
  status: "achieved" | "progress" | "risk"

    // 👇 extras (só no diário)
  statusDia?: 'OK' | 'DEVENDO'
  saldoDia?: number
  metaDia?: number
  metaHerdada?: number
}

export function processVendedor(v: Vendedor, viewMode: ViewMode): VendedorProcessado {
  console.log("VIEW MODE RECEBIDO:", viewMode)

  const id = Number(v.sk_vendedor)

  const metaMes = Number(v.meta_mes ?? 0)

  const receitaDia = Number(v.receita_dia ?? 0)
  const metaDia = Number(v.meta_diaria_necessaria ?? 0)

  const receita =
    viewMode === "diario"
      ? receitaDia
      : Number(v.receita_mes ?? 0)


  // % do card/barra:
  // - mensal: usa perc_atingimento (0.87 -> 87%)
  // - diário: compara receita_dia vs meta_diaria_necessaria (faz mais sentido pro “dia”)
  const percBase =
    viewMode === "diario"
      ? (() => {
          const metaDiaNec = Number(v.meta_diaria_necessaria ?? 0)
          return metaDiaNec > 0 ? receita / metaDiaNec : 0
        })()
      : Number(v.perc_atingimento ?? 0)

  const percentual = Math.round(percBase * 100)

  let status: "achieved" | "progress" | "risk"
  if (percentual >= 90) status = "achieved"
  else if (percentual >= 50) status = "progress"
  else status = "risk"

  const partes = (v.nome_vendedor || "").trim().split(" ").filter(Boolean)
  const iniciais =
    partes.length === 0
      ? "?"
      : partes.length === 1
      ? partes[0][0].toUpperCase()
      : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()

  const ranking =
    viewMode === "diario"
      ? Number(v.ranking_dia ?? 0)
      : Number(v.ranking_atingimento ?? 0)

  return {
    id,
    nome: v.nome_vendedor,
    iniciais,

    receita,
    meta: viewMode === "diario" ? metaDia : metaMes,

    percentual,
    ranking,
    status,

    // 👇 extras só para o diário
    statusDia: viewMode === "diario" ? (v.status_dia as 'OK' | 'DEVENDO') : undefined,

    saldoDia:
      viewMode === "diario"
        ? Math.max(metaDia - receitaDia, 0)
        : undefined,

    metaDia: viewMode === "diario" ? metaDia : undefined,
    metaHerdada: Number(v.metaHerdada ?? v.meta_herdada ?? v.META_HERDADA ?? 0),
  }
}

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `R$ ${safe.toLocaleString("pt-BR")}`
}
