"use client"

import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react"
import Image from "next/image"
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Building2,
  Crown,
  Flame,
  Lock,
  LogOut,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react"
import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
  type AuthUser,
} from "@/lib/user-session"

type IndustryUser = AuthUser & {
  role: "INDUSTRIA"
  marca?: string | null
}

type IndustryCampaign = {
  source: "CHALLENGE" | "ESTIMATE"
  title: string
  unit: string
  currentValue: number
  targetValue: number
  percent: number
  sellersImpacted: number
}

type IndustryRankingRow = {
  skVendedor: number | string | null
  nome: string
  receita: number
  volume: number
  clientes: number
  posicaoAtual: number
  posicaoAnterior: number
  deltaPosicao: number
}

type IndustryRegion = {
  nome: string
  faturamento: number
  clientes: number
  crescimento: number
  participacao: number
}

type IndustrySalesItem = {
  nome: string
  faturamento: number
  volume: number
}

type IndustryInsight = {
  kind: string
  title: string
  description: string
}

type IndustryDashboardResponse = {
  marca: string
  generatedAt: string
  reference: {
    currentLabel: string
    previousLabel: string
  }
  hero: {
    headline: string
    subheadline: string
  }
  campaign: IndustryCampaign
  kpis: {
    faturamentoAtual: number
    faturamentoAnterior: number
    volumeAtual: number
    volumeAnterior: number
    percentualMeta: number
    clientesImpactados: number
    vendedoresImpactados: number
    crescimentoVsAnterior: number
  }
  impact: {
    vendasGeradas: number
    volumeVendido: number
    vendedoresImpactados: number
  }
  ranking: IndustryRankingRow[]
  regions: IndustryRegion[]
  inactiveClients: Array<{
    nome: string
    receitaTotal: number
    ultimaCompra: string | number | null
    diasSemCompra: number
  }>
  topProducts: IndustrySalesItem[]
  topGroups: IndustrySalesItem[]
  summary: {
    top3Share: number
    inactiveClients: number
    bestRegion: string | null
  }
  insights: IndustryInsight[]
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })
}

function formatDecimal(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)
}

function formatSignedPercent(value: number) {
  const rounded = Number(value ?? 0)
  const prefix = rounded > 0 ? "+" : ""
  return `${prefix}${formatDecimal(rounded, 1)}%`
}

function formatCompactInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatOracleDate(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "Sem data"
  }

  const normalized = String(value).trim()
  const digits = normalized.replace(/\D/g, "")

  if (digits.length === 8) {
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    const date = new Date(year, month - 1, day)

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("pt-BR")
    }
  }

  const parsedDate = new Date(normalized)
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleDateString("pt-BR")
  }

  return normalized
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Agora"
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return "Agora"
  }

  return parsedDate.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseApiError(rawText: string | null | undefined, fallbackMessage: string) {
  const text = String(rawText ?? "").trim()
  if (!text) return fallbackMessage

  try {
    const payload = JSON.parse(text) as { error?: string; message?: string }
    return payload.error || payload.message || fallbackMessage
  } catch {
    return text
  }
}

function calculateGrowth(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0
  }

  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function getCampaignValueLabel(campaign: IndustryCampaign, value: number) {
  if (campaign.unit === "R$") {
    return formatCurrency(value)
  }

  return `${formatDecimal(value)} ${campaign.unit}`.trim()
}

function getMedalStyles(position: number) {
  if (position === 1) {
    return {
      shell: "border-amber-300/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(120,53,15,0.2))] shadow-[0_18px_40px_rgba(245,158,11,0.18)]",
      badge: "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-[#1a1203]",
      icon: Crown,
    }
  }

  if (position === 2) {
    return {
      shell: "border-slate-300/22 bg-[linear-gradient(135deg,rgba(148,163,184,0.14),rgba(51,65,85,0.18))]",
      badge: "bg-[linear-gradient(135deg,#cbd5e1,#94a3b8)] text-[#0f172a]",
      icon: Medal,
    }
  }

  if (position === 3) {
    return {
      shell: "border-orange-300/24 bg-[linear-gradient(135deg,rgba(251,146,60,0.16),rgba(124,45,18,0.2))]",
      badge: "bg-[linear-gradient(135deg,#fb923c,#ea580c)] text-white",
      icon: Award,
    }
  }

  return {
    shell: "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
    badge: "bg-white/10 text-white",
    icon: UserRound,
  }
}

function KpiCard({
  icon: Icon,
  title,
  value,
  helper,
  accent,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  value: string
  helper: string
  accent: string
}) {
  return (
    <article className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.96),rgba(8,12,20,0.92))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.22)]">
      <div className={`absolute inset-x-0 top-0 h-px ${accent}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">{title}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm leading-6 text-white/60">{helper}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/6 p-3 text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  )
}

function SalesChartCard({
  icon: Icon,
  eyebrow,
  title,
  items,
  barClassName,
}: {
  icon: ComponentType<{ className?: string }>
  eyebrow: string
  title: string
  items: IndustrySalesItem[]
  barClassName: string
}) {
  const maxRevenue = Math.max(...items.map((item) => item.faturamento), 0)

  return (
    <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.96),rgba(7,11,20,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{title}</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {items.length ? (
        <div className="mt-6 grid gap-4">
          {items.map((item, index) => {
            const width = maxRevenue > 0 ? Math.max((item.faturamento / maxRevenue) * 100, 12) : 12

            return (
              <div key={`${item.nome}-${index}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/38">#{index + 1}</p>
                    <p className="mt-2 truncate text-lg font-bold text-white">{item.nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-cyan-100">{formatCurrency(item.faturamento)}</p>
                    <p className="mt-1 text-xs text-white/48">{formatDecimal(item.volume)} em volume</p>
                  </div>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/8">
                  <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${Math.min(width, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-white/4 px-5 py-6 text-sm text-white/58">
          Ainda nao houve venda suficiente no periodo para montar este grafico.
        </div>
      )}
    </article>
  )
}

export default function IndustriaPage() {
  const [user, setUser] = useState<IndustryUser | null>(null)
  const [codigo, setCodigo] = useState("")
  const [senha, setSenha] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isBooting, setIsBooting] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dashboard, setDashboard] = useState<IndustryDashboardResponse | null>(null)
  const [dashboardError, setDashboardError] = useState("")
  const activeBrand = user?.marca ? String(user.marca) : ""

  useEffect(() => {
    const stored = getStoredUser()

    if (stored?.role === "INDUSTRIA") {
      setUser(stored as IndustryUser)
    }

    setIsBooting(false)
  }, [])

  useEffect(() => {
    if (!activeBrand) return

    let active = true

    async function loadDashboard() {
      setDashboardError("")
      setIsRefreshing(true)

      try {
        const response = await fetch(`/api/industria/dashboard?marca=${encodeURIComponent(activeBrand)}`, {
          cache: "no-store",
          credentials: "include",
        })
        const rawText = await response.text()

        if (!response.ok) {
          throw new Error(parseApiError(rawText, "Falha ao carregar o painel."))
        }

        const payload = JSON.parse(rawText) as IndustryDashboardResponse

        if (active) {
          setDashboard(payload)
        }
      } catch (error) {
        if (active) {
          setDashboard(null)
          setDashboardError(error instanceof Error ? error.message : "Nao foi possivel carregar o painel.")
        }
      } finally {
        if (active) {
          setIsRefreshing(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [activeBrand])

  const topSeller = dashboard?.ranking[0] ?? null
  const topThreeRevenue = useMemo(
    () => (dashboard?.ranking ?? []).slice(0, 3).reduce((sum, row) => sum + row.receita, 0),
    [dashboard]
  )
  const campaignProgress = Math.min(Math.max(dashboard?.campaign.percent ?? 0, 0), 100)
  const campaignRemainingValue = dashboard
    ? Math.max(dashboard.campaign.targetValue - dashboard.campaign.currentValue, 0)
    : 0
  const currentCycleLabel = isRefreshing
    ? "Atualizando leitura..."
    : dashboard?.reference.currentLabel ?? "Aguardando leitura"
  const leaderHeadline = topSeller ? `${topSeller.nome} lidera agora` : "Ranking em sincronizacao"
  const generatedAtLabel = dashboard ? formatDateTime(dashboard.generatedAt) : "Agora"

  async function handleIndustryLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/login-industria", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codigo,
          senha,
        }),
      })
      const rawText = await response.text()

      if (!response.ok) {
        throw new Error(parseApiError(rawText, "Nao foi possivel entrar."))
      }

      const nextUser = JSON.parse(rawText) as IndustryUser
      setStoredUser(nextUser)
      setUser(nextUser)
      setCodigo("")
      setSenha("")
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Nao foi possivel entrar.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isBooting) {
    return (
      <div className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/70 backdrop-blur-xl">
            Carregando portal da industria...
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#040814] text-white">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(14,116,144,0.16),transparent_28%),linear-gradient(180deg,#060816_0%,#02040c_100%)]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:86px_86px]" />
          <div className="absolute left-[8%] top-24 h-80 w-80 rounded-full bg-cyan-400/18 blur-3xl" />
          <div className="absolute right-[4%] top-10 h-[26rem] w-[26rem] rounded-full bg-blue-500/18 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-sky-500/14 blur-3xl" />
        </div>

        <main className="relative z-10 mx-auto grid min-h-screen max-w-[1500px] gap-8 px-6 py-10 lg:grid-cols-[1.16fr_0.84fr] lg:items-center">
          <section className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
                Portal da Industria
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
                <Sparkles className="h-3.5 w-3.5" />
                Entrada premium da campanha
              </div>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.04em] text-white md:text-6xl">
                Sua marca entra na operacao com <span className="text-cyan-300">presenca executiva</span>.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                Um portal desenhado para a industria abrir a pagina, reconhecer a campanha de imediato e acompanhar a performance com elegancia, contexto e leitura rapida.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,12,22,0.98),rgba(7,11,20,0.94))] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.36)]">
              <div className="relative h-[220px] overflow-hidden rounded-[30px] sm:h-[280px]">
                <Image
                  src="/BannerIndustria.png"
                  alt="Banner de entrada da industria"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 60vw, 100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,20,0.04),rgba(4,8,20,0.12),rgba(4,8,20,0.38))]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_34%)]" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
              <article className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.95),rgba(7,11,20,0.92))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/74">Primeiro impacto</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-white">
                  O desafio vira a assinatura visual da entrada, sem poluicao e sem competir com a informacao.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66">
                  A experiencia abre com atmosfera de campanha e, logo abaixo, conduz a marca para os indicadores que realmente importam.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Performance</p>
                    <p className="mt-2 text-xl font-black text-white">Ranking vivo</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Impacto</p>
                    <p className="mt-2 text-xl font-black text-cyan-100">Vendas reais</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Leitura</p>
                    <p className="mt-2 text-xl font-black text-white">Visao executiva</p>
                  </div>
                </div>
              </article>

              <div className="grid gap-4">
                <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.92),rgba(8,12,22,0.88))] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Leitura imediata</p>
                      <h3 className="mt-2 text-2xl font-black text-white">Campanha em primeiro plano</h3>
                    </div>
                    <div className="rounded-2xl border border-cyan-300/18 bg-cyan-300/10 p-3 text-cyan-100">
                      <Target className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/64">
                    O parceiro entra ja entendendo contexto, tom da campanha e prioridade comercial.
                  </p>
                </article>

                <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,26,0.92),rgba(8,12,22,0.86))] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Relacionamento</p>
                      <h3 className="mt-2 text-2xl font-black text-white">Portal com cara de parceiro</h3>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-3 text-white">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/64">
                    Menos visual de BI generico e mais sensacao de acompanhamento continuo da operacao.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section className="relative">
            <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_44%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,30,0.97),rgba(7,11,20,0.96))] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
              <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(103,232,249,0.62),transparent)]" />
              <div className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-cyan-400/14 blur-3xl" />

              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">Login do fornecedor</p>
                  <h2 className="mt-2 text-3xl font-black text-white">Entrar no portal</h2>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-white/58">
                    Acesso rapido para a industria entrar direto na campanha e no desempenho da marca.
                  </p>
                </div>
                <div className="rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleIndustryLogin}>
                {loginError ? (
                  <div className="rounded-2xl border border-red-400/24 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {loginError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="codigo" className="text-sm font-medium text-white/88">
                    Codigo do fornecedor
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                    <input
                      id="codigo"
                      type="text"
                      value={codigo}
                      onChange={(event) => setCodigo(event.target.value)}
                      placeholder="SUVINIL01"
                      className="w-full rounded-[22px] border border-white/10 bg-white/6 py-3.5 pl-11 pr-4 text-white outline-none transition-all placeholder:text-white/32 focus:border-cyan-300/34 focus:bg-white/8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="senha" className="text-sm font-medium text-white/88">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                    <input
                      id="senha"
                      type="password"
                      value={senha}
                      onChange={(event) => setSenha(event.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full rounded-[22px] border border-white/10 bg-white/6 py-3.5 pl-11 pr-4 text-white outline-none transition-all placeholder:text-white/32 focus:border-cyan-300/34 focus:bg-white/8"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#0369a1,#0ea5e9,#67e8f9)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_rgba(14,165,233,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Entrando..." : "Acessar portal"}
                  {!isSubmitting ? <ArrowRight className="h-5 w-5" /> : null}
                </button>
              </form>

              <div className="mt-8 grid gap-4 border-t border-white/8 pt-6 text-sm text-white/62">
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  A visualizacao e filtrada automaticamente pela marca do parceiro.
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <Sparkles className="h-4 w-4 text-cyan-200" />
                  A campanha entra primeiro, os dados entram depois, sem disputar atencao.
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040814] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_22%),linear-gradient(180deg,#040814_0%,#060b18_40%,#03060f_100%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:84px_84px]" />
        <div className="absolute left-[6%] top-24 h-72 w-72 rounded-full bg-cyan-400/16 blur-3xl" />
        <div className="absolute right-[4%] top-32 h-[22rem] w-[22rem] rounded-full bg-blue-500/16 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/14 blur-3xl" />
      </div>

      <header className="relative z-20 pt-5">
        <div className="mx-auto max-w-[1500px] px-6">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,25,0.94),rgba(8,12,22,0.9))] px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-300/10 p-3 text-cyan-100 shadow-[0_12px_28px_rgba(34,211,238,0.12)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">Painel do Parceiro</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight text-white">{dashboard?.marca ?? user.marca ?? "Industria"}</h1>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/62">
                      {currentCycleLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/54">
                    Campanha, ranking e impacto comercial com uma leitura mais limpa e executiva.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100">
                  {dashboard?.campaign.source === "CHALLENGE" ? "Meta da campanha" : "Meta sugerida"}
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72">
                  {leaderHeadline}
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/56">
                  Atualizado {generatedAtLabel}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearStoredUser()
                    setDashboard(null)
                    setDashboardError("")
                    setUser(null)
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white/78 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1500px] space-y-8 px-6 py-8">
        <section className="space-y-6">
          <section className="relative overflow-hidden rounded-[38px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(8,12,22,0.98),rgba(7,11,20,0.94))] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.3)]">
            <div className="relative h-[180px] overflow-hidden rounded-[32px] sm:h-[240px] lg:h-[300px]">
              <Image src="/BannerDesafio.png" alt="Banner da campanha" fill className="object-cover" sizes="100vw" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,20,0.02),rgba(4,8,20,0.08),rgba(4,8,20,0.26))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_30%)]" />
              <div className="absolute -right-14 top-10 h-48 w-48 rounded-full bg-blue-400/16 blur-3xl animate-drift" />
              <div className="absolute left-10 bottom-6 h-36 w-36 rounded-full bg-cyan-300/14 blur-3xl animate-drift" style={{ animationDelay: "1.1s" }} />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-[34px] border border-cyan-300/14 bg-[linear-gradient(135deg,rgba(8,14,26,0.98),rgba(8,16,30,0.96),rgba(5,10,20,0.96))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)] lg:p-8">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Campanha em destaque
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Nada disputa com o banner
                  </span>
                </div>

                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Cabecalho da experiencia</p>
                  <h2 className="max-w-4xl text-4xl font-black leading-[0.92] tracking-[-0.04em] text-white md:text-5xl">
                    {dashboard?.campaign.title ?? "Campanha da marca"}
                  </h2>
                  <p className="max-w-3xl text-lg leading-8 text-slate-200/78">
                    {dashboard?.hero.headline ?? "Sua campanha em acao dentro das lojas"}
                  </p>
                  <p className="max-w-3xl text-sm leading-7 text-white/58">
                    {dashboard?.hero.subheadline ??
                      "A leitura principal entra logo abaixo do banner para contextualizar a campanha sem cobrir a imagem."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/7 p-5 backdrop-blur-xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Vendas rastreadas</p>
                    <p className="mt-3 text-3xl font-black text-white">
                      {dashboard ? formatCurrency(dashboard.impact.vendasGeradas) : "--"}
                    </p>
                    <p className="mt-2 text-sm text-white/60">Resultado direto da marca no ciclo atual.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/7 p-5 backdrop-blur-xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Top 3 no faturamento</p>
                    <p className="mt-3 text-3xl font-black text-cyan-100">{dashboard ? formatCurrency(topThreeRevenue) : "--"}</p>
                    <p className="mt-2 text-sm text-white/60">Concentracao das melhores operacoes agora.</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/7 p-5 backdrop-blur-xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Vendedores impactados</p>
                    <p className="mt-3 text-3xl font-black text-white">
                      {dashboard ? formatCompactInteger(dashboard.impact.vendedoresImpactados) : "--"}
                    </p>
                    <p className="mt-2 text-sm text-white/60">Time envolvido na execucao da campanha.</p>
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-4">
              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.92),rgba(8,12,22,0.92))] p-6 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Ritmo da campanha</p>
                    <h3 className="mt-2 text-2xl font-black text-white">{dashboard?.campaign.title ?? "Campanha da marca"}</h3>
                  </div>
                  <div className="rounded-[18px] border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100">
                    {dashboard ? `${formatDecimal(dashboard.campaign.percent)}%` : "--"}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between text-sm text-white/65">
                    <span>Meta em andamento</span>
                    <span>{dashboard ? getCampaignValueLabel(dashboard.campaign, dashboard.campaign.targetValue) : "--"}</span>
                  </div>
                  <div className="relative h-7 overflow-hidden rounded-full border border-white/10 bg-white/6 p-1">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_36px,transparent_36px,transparent_52px)]" />
                    <div
                      className="relative h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9_0%,#38bdf8_50%,#93c5fd_100%)] shadow-[0_0_36px_rgba(56,189,248,0.34)]"
                      style={{ width: `${campaignProgress}%` }}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">Atual</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {dashboard ? getCampaignValueLabel(dashboard.campaign, dashboard.campaign.currentValue) : "--"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">Meta</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {dashboard ? getCampaignValueLabel(dashboard.campaign, dashboard.campaign.targetValue) : "--"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">Falta para concluir</p>
                      <p className="mt-1 text-lg font-bold text-cyan-100">
                        {dashboard ? getCampaignValueLabel(dashboard.campaign, campaignRemainingValue) : "--"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.9),rgba(8,12,22,0.88))] p-6 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Pulso da marca</p>
                    <h3 className="mt-2 text-2xl font-black text-white">Sinais que merecem atencao</h3>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-white/8 px-3 py-2 text-sm font-medium text-white/68">
                    {currentCycleLabel}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs text-white/42">Melhor praca</p>
                    <p className="mt-2 text-2xl font-black text-cyan-100">{dashboard?.summary.bestRegion ?? "Sem leitura"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs text-white/42">Clientes em reativacao</p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {dashboard ? formatCompactInteger(dashboard.summary.inactiveClients) : "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs text-white/42">Lider atual</p>
                    <p className="mt-2 text-xl font-black text-white">{topSeller?.nome ?? "Sem ranking"}</p>
                    <p className="mt-2 text-sm text-white/58">
                      {topSeller ? formatCurrency(topSeller.receita) : "Aguardando dados"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={BarChart3}
            title="Faturamento da marca"
            value={dashboard ? formatCurrency(dashboard.kpis.faturamentoAtual) : "--"}
            helper={dashboard ? `${formatSignedPercent(dashboard.kpis.crescimentoVsAnterior)} vs periodo anterior` : "Aguardando leitura"}
            accent="bg-[linear-gradient(90deg,#38bdf8,#0ea5e9)]"
          />
          <KpiCard
            icon={Flame}
            title="Volume vendido"
            value={dashboard ? formatDecimal(dashboard.kpis.volumeAtual) : "--"}
            helper={dashboard ? `${formatSignedPercent(calculateGrowth(dashboard.kpis.volumeAtual, dashboard.kpis.volumeAnterior))} vs periodo anterior` : "Aguardando leitura"}
            accent="bg-[linear-gradient(90deg,#fb923c,#f97316)]"
          />
          <KpiCard
            icon={Target}
            title="% da meta atingida"
            value={dashboard ? `${formatDecimal(dashboard.kpis.percentualMeta)}%` : "--"}
            helper={dashboard?.campaign.source === "CHALLENGE" ? "Meta puxada da campanha ativa." : "Meta projetada para leitura executiva."}
            accent="bg-[linear-gradient(90deg,#fbbf24,#f59e0b)]"
          />
          <KpiCard
            icon={Users}
            title="Clientes impactados"
            value={dashboard ? formatCompactInteger(dashboard.kpis.clientesImpactados) : "--"}
            helper={dashboard ? `${dashboard.kpis.vendedoresImpactados} vendedores acionando a marca.` : "Aguardando leitura"}
            accent="bg-[linear-gradient(90deg,#34d399,#10b981)]"
          />
          <KpiCard
            icon={TrendingUp}
            title="Crescimento vs anterior"
            value={dashboard ? formatSignedPercent(dashboard.kpis.crescimentoVsAnterior) : "--"}
            helper={dashboard ? dashboard.reference.previousLabel : "Comparativo indisponivel"}
            accent="bg-[linear-gradient(90deg,#c084fc,#a855f7)]"
          />
        </section>

        {dashboardError ? (
          <section className="rounded-[28px] border border-red-400/24 bg-red-400/10 px-5 py-4 text-sm text-red-100">
            {dashboardError}
          </section>
        ) : null}
 
        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,15,28,0.96),rgba(7,11,20,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Ranking protagonista</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-white">Top 10 vendedores</h3>
              </div>
              <div className="rounded-full border border-fuchsia-400/18 bg-fuchsia-400/10 px-4 py-2 text-sm font-medium text-fuchsia-100">
                {topSeller ? `${topSeller.nome} lidera agora` : "Sem ranking no momento"}
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {(dashboard?.ranking ?? []).map((seller, index) => {
                const medal = getMedalStyles(index + 1)
                const MedalIcon = medal.icon

                return (
                  <div
                    key={`${seller.skVendedor ?? seller.nome}-${seller.posicaoAtual}`}
                    className={`grid gap-4 rounded-[26px] border p-4 transition-transform hover:-translate-y-0.5 sm:grid-cols-[92px_1fr_160px] sm:items-center ${medal.shell}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${medal.badge}`}>
                        <MedalIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/42">Posicao</p>
                        <p className="text-2xl font-black text-white">{seller.posicaoAtual}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-bold text-white">{seller.nome}</p>
                          <p className="text-sm text-white/56">{seller.clientes} clientes impactados</p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm text-white/70">
                          {seller.deltaPosicao > 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-300" /> : null}
                          {seller.deltaPosicao < 0 ? <TrendingDown className="h-4 w-4 text-red-300" /> : null}
                          {seller.deltaPosicao === 0 ? <ArrowRight className="h-4 w-4 text-white/40" /> : null}
                          {seller.deltaPosicao > 0
                            ? `Subiu ${seller.deltaPosicao}`
                            : seller.deltaPosicao < 0
                              ? `Caiu ${Math.abs(seller.deltaPosicao)}`
                              : "Estavel"}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/38">Faturamento</p>
                          <p className="mt-1 text-lg font-bold text-white">{formatCurrency(seller.receita)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/38">Volume</p>
                          <p className="mt-1 text-lg font-bold text-cyan-100">{formatDecimal(seller.volume)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Evolucao</p>
                      <div className="mt-3 flex items-end gap-2">
                        <div className="h-10 w-3 rounded-full bg-white/10" />
                        <div className="h-16 w-3 rounded-full bg-white/12" />
                        <div
                          className="w-3 rounded-full bg-[linear-gradient(180deg,#38bdf8,#0ea5e9)]"
                          style={{ height: `${32 + Math.min(Math.max(seller.posicaoAnterior - seller.posicaoAtual, 0), 4) * 8}px` }}
                        />
                        <div className="ml-3 text-sm text-white/62">
                          {seller.posicaoAnterior > 0 ? `Antes: ${seller.posicaoAnterior}o` : "Sem base"}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.96),rgba(7,11,20,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Onde vende mais</p>
                <h3 className="mt-2 text-2xl font-black text-white">Pracas aquecidas</h3>
              </div>
              <div className="rounded-2xl border border-cyan-300/18 bg-cyan-300/10 p-3 text-cyan-100">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {(dashboard?.regions ?? []).map((region) => (
                <div key={region.nome} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-white">{region.nome}</p>
                      <p className="text-sm text-white/56">{region.clientes} clientes no ciclo</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-cyan-100">{formatCurrency(region.faturamento)}</p>
                      <p className="text-xs text-white/48">{formatSignedPercent(region.crescimento)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#38bdf8,#60a5fa)]"
                      style={{ width: `${Math.min(region.participacao, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/44">
                    <span>Participacao</span>
                    <span>{formatDecimal(region.participacao)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SalesChartCard
            icon={BarChart3}
            eyebrow="Mix em alta"
            title="Produtos que mais vendem"
            items={dashboard?.topProducts ?? []}
            barClassName="bg-[linear-gradient(90deg,#38bdf8,#0ea5e9,#22d3ee)]"
          />
          <SalesChartCard
            icon={Target}
            eyebrow="Categoria lider"
            title="Grupos de produtos que mais vendem"
            items={dashboard?.topGroups ?? []}
            barClassName="bg-[linear-gradient(90deg,#f59e0b,#f97316,#fb7185)]"
          />
        </section>

        <section>
          <article className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.96),rgba(7,11,20,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Reativacao de carteira</p>
                <h3 className="mt-2 text-2xl font-black text-white">Clientes Suvinil sem compra recente</h3>
              </div>
              <div className="rounded-full border border-amber-300/18 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100">
                {dashboard ? `${dashboard.summary.inactiveClients} clientes mapeados` : "Sem leitura"}
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {(dashboard?.inactiveClients ?? []).length ? (
                (dashboard?.inactiveClients ?? []).map((client, index) => (
                  <div
                    key={`${client.nome}-${index}`}
                    className="grid gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4 sm:grid-cols-[minmax(0,1fr)_150px_170px_180px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-white">{client.nome}</p>
                      <p className="mt-1 text-sm text-white/56">
                        Cliente que compra Suvinil e esta sem nova compra ha {formatDecimal(client.diasSemCompra, 0)} dias.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/38">Dias sem compra</p>
                      <p className="mt-1 text-base font-bold text-amber-100">{formatDecimal(client.diasSemCompra, 0)} dias</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/38">Ultima compra</p>
                      <p className="mt-1 text-base font-bold text-cyan-100">{formatOracleDate(client.ultimaCompra)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/38">Receita historica</p>
                      <p className="mt-1 text-base font-bold text-white">{formatCurrency(client.receitaTotal)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/4 px-5 py-6 text-sm text-white/58">
                  Nenhum cliente ficou tempo suficiente sem comprar Suvinil para entrar nesta leitura.
                </div>
              )}
            </div>
          </article>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/8 pt-5 text-sm text-white/46 sm:flex-row sm:items-center sm:justify-between">
          <span>Portal da Industria conectado a marca {dashboard?.marca ?? user.marca ?? "parceiro"}.</span>
          <span>{isRefreshing ? "Atualizando painel..." : `Base atual: ${dashboard?.reference.currentLabel ?? "aguardando leitura"}`}</span>
        </footer>
      </main>
    </div>
  )
}
