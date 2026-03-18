"use client"

import { useEffect, useState } from "react"
import { Activity, Flag, Calendar, CalendarDays, AlertTriangle, Sparkles } from "lucide-react"
import { Vendedor, VendedorProcessado, processVendedor,  formatCurrency } from "@/lib/types"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { TeamStatus } from "@/components/dashboard/team-status"
import { RadarVendas } from "@/components/dashboard/RadarVendas"
import { RankingTable } from "@/components/dashboard/ranking-table"
import { Podium } from "@/components/dashboard/podium"
import { ProgressTrail } from "@/components/dashboard/progress-trail"
import { SidebarHUD } from "@/components/dashboard/sidebar-hud"
import { DashboardSkeleton } from "@/components/dashboard/loading-skeleton"
import RankingAlerts from "@/components/RankingAlerts"
import { gerarResumoDiario } from '@/lib/diario'
import { useRouter } from "next/navigation"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { AuthUser, setStoredUser } from "@/lib/user-session"




export default function DashboardPage() {
  const router = useRouter()
  const [vendedores, setVendedores] = useState<VendedorProcessado[]>([])
  const [nomeUsuario, setNomeUsuario] = useState("")
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [empresaId, setEmpresaId] = useState<string | number | null>(null)
  const [dataReferencia, setDataReferencia] = useState<string | Date | number | null>(null)
  const [fallbackDataReferencia, setFallbackDataReferencia] = useState<string | Date | number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"mensal" | "diario">("mensal")
  const resumoDiario = viewMode === "diario" ? gerarResumoDiario(vendedores) : null
  const hasMetaHerdada = vendedores.some((v) => v.metaHerdada === 1)
  const textoResumoDiario =
  resumoDiario &&
  `Resumo do dia, hoje:
  • ${resumoDiario.bateram} vendedores conseguiram bater a meta diária 💪
  • ${resumoDiario.devendo} vendedores ficaram devendo
  • No total, faltaram ${formatCurrency(resumoDiario.valorFaltante)} para fechar o dia no verde`
  function obterSaudacao() {
    const hora = new Date().getHours()
    if (hora >= 5 && hora < 12) return "Bom dia"
    if (hora >= 12 && hora < 18) return "Boa tarde"
    return "Boa noite"
  }
  function pareceCpf(valor: string) {
    return /^\d{11}$/.test(valor)
  }
  const saudacao = obterSaudacao()
  const dataReferenciaNormalizada = parseReferenceDate(dataReferencia ?? fallbackDataReferencia)
  const dataReferenciaValida = !!dataReferenciaNormalizada



  function parseReferenceDate(input: string | Date | number | null | undefined) {
    if (input === null || input === undefined) return null
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
    if (typeof input === "number") {
      const d = new Date(input)
      return Number.isNaN(d.getTime()) ? null : d
    }
    if (typeof input !== "string") return null

    const trimmed = input.trim()
    if (!trimmed) return null

    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (brMatch) {
      const [, dd, mm, yyyy] = brMatch
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
      return Number.isNaN(d.getTime()) ? null : d
    }

    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }

  function formatDateBR(dateString: string | Date | number | null) {
    const d = parseReferenceDate(dateString)
    if (!d) return ""
    return d.toLocaleDateString("pt-BR")
  }

  function isToday(dateString: string | Date | number | null) {
    const ref = parseReferenceDate(dateString)
    if (!ref) return false
    const now = new Date()

    return (
      ref.getFullYear() === now.getFullYear() &&
      ref.getMonth() === now.getMonth() &&
      ref.getDate() === now.getDate()
    )
  }

  function extractDataReferencia(payload: unknown): string | Date | number | null {
    const obj = payload as Record<string, unknown>
    const rawData = (obj?.data ?? payload) as unknown
    const firstItem =
      Array.isArray(rawData) && rawData.length > 0
        ? (rawData[0] as Record<string, unknown>)
        : null

    const candidates: unknown[] = [
      obj?.dataReferencia,
      obj?.data_referencia,
      obj?.datareferencia,
      obj?.DATA_REFERENCIA,
      firstItem?.dataReferencia,
      firstItem?.data_referencia,
      firstItem?.datareferencia,
      firstItem?.DATA_REFERENCIA,
    ]

    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value
      }
      if (value instanceof Date || typeof value === "number") {
        return value
      }
    }

    return null
  }


  useEffect(() => {
    const userStr = sessionStorage.getItem("user")

    if (!userStr) {
      router.push("/login")
      return
    }

    const user = JSON.parse(userStr) as AuthUser

    if (user.role !== "GERENTE") {
      router.push("/login")
      return
    }

    const nome = String(user.nome ?? user.NOME ?? "").trim()
    const normalizedUser = { ...user, nome }
    setAuthUser(normalizedUser)
    setNomeUsuario(nome)
    setStoredUser(normalizedUser)
    setEmpresaId(user.empresa_id ?? user.sk_empresa ?? null)
  }, [router])


  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/ranking-vendedores?modo=${viewMode}`)


        if (!response.ok) {
          throw new Error("Falha ao carregar dados")
        }

        const json = await response.json()
        const data: Vendedor[] = json.data ?? json
        const dataRef = extractDataReferencia(json)
        const processed = data.map(v => {
          const p = processVendedor(v, viewMode)
          console.log("DEBUG DIARIO:", p)
          return p
      })

        setDataReferencia(dataRef ?? null)
        if (dataRef) {
          setFallbackDataReferencia(dataRef)
        } else if (viewMode === "mensal") {
          try {
              const dailyResponse = await fetch("/api/ranking-vendedores?modo=diario")
            if (dailyResponse.ok) {
              const dailyJson = await dailyResponse.json()
              const dailyRef = extractDataReferencia(dailyJson)
              setFallbackDataReferencia(dailyRef ?? null)
            }
          } catch {
            // Mantem o fallback atual quando a consulta diaria falhar.
          }
        }
        setVendedores(processed)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [viewMode])


  const nomeFinal = pareceCpf(nomeUsuario) ? "" : nomeUsuario
  const fraseSaudacao = nomeFinal
    ? `${saudacao} ${nomeFinal}, acompanhe a performance da sua equipe em tempo real.`
    : `${saudacao}, acompanhe a performance da sua equipe em tempo real.`
  const showInitialSkeleton = isLoading && vendedores.length === 0
  const totalReceita = vendedores.reduce((sum, vendedor) => sum + vendedor.receita, 0)
  const totalMeta = vendedores.reduce((sum, vendedor) => sum + vendedor.meta, 0)
  const desempenhoEquipe = totalMeta > 0 ? Math.round((totalReceita / totalMeta) * 100) : 0
  const vendedoresAcimaMeta = vendedores.filter((vendedor) => vendedor.status === "achieved").length
  const vendedoresEmRisco = vendedores.filter((vendedor) => vendedor.status === "risk").length
  const vendedoresEmProgresso = vendedores.filter((vendedor) => vendedor.status === "progress").length
  const textoResumoMensal = `Resumo do mes:\n• ${vendedoresAcimaMeta} vendedores ja bateram a meta\n• ${vendedoresEmProgresso} seguem em progresso\n• ${vendedoresEmRisco} precisam de atencao\n• A equipe soma ${formatCurrency(totalReceita)} e esta em ${desempenhoEquipe}% da meta consolidada`

  return (
    <div className="min-h-screen bg-background">
      <AppShellNav user={authUser} />

      <div className="flex">
        {/* Main Content */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-6 sm:py-8 xl:pr-[340px]">
          <section className="relative mb-6 overflow-hidden rounded-[28px] border border-emerald-500/18 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_26%),linear-gradient(145deg,rgba(7,16,13,0.98),rgba(9,18,16,0.96),rgba(8,13,12,0.94))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:mb-8 sm:rounded-[32px] sm:p-8">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(134,239,172,0.09),transparent_58%)]" />
            <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:items-start">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200 sm:text-[11px] sm:tracking-[0.18em]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Visao gerencial
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/65 sm:text-[11px] sm:tracking-[0.18em]">
                    <Activity className="h-3.5 w-3.5" />
                    Painel ao vivo
                  </span>
                </div>

                <div>
                  <h1 className="text-[1.85rem] font-bold tracking-tight text-white sm:text-4xl">Dashboard do Gerente</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b6c6bc] sm:text-base">
                    {fraseSaudacao}
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 backdrop-blur-sm sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Central de comando</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">Ritmo de acompanhamento</h2>
                    </div>
                    <Activity className="h-5 w-5 text-emerald-300" />
                  </div>

                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Modo de acompanhamento</p>
                    <p className="mt-2 text-sm leading-6 text-[#aac0b4]">
                      Alterne entre leitura do dia e consolidado mensal sem perder o contexto da equipe.
                    </p>
                    <div className="mt-4 flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
                      <button
                        onClick={() => setViewMode("diario")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          viewMode === "diario"
                            ? "bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] text-white shadow-[0_12px_30px_rgba(34,197,94,0.24)]"
                            : "text-white/70 hover:text-white"
                        }`}
                      >
                        <Calendar className="h-4 w-4" />
                        Diario
                      </button>
                      <button
                        onClick={() => setViewMode("mensal")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          viewMode === "mensal"
                            ? "bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] text-white shadow-[0_12px_30px_rgba(34,197,94,0.24)]"
                            : "text-white/70 hover:text-white"
                        }`}
                      >
                        <CalendarDays className="h-4 w-4" />
                        Mensal
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>

          {error ? (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <p className="font-semibold">Erro ao carregar dados</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : showInitialSkeleton ? (
            <DashboardSkeleton />
          ) : (
            <div className="space-y-6">
              {hasMetaHerdada && (
                  <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-600/50 bg-amber-900/40 p-4 text-amber-200">
                  <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    Meta utilizada do mês anterior. A meta do mês atual ainda não foi cadastrada no ADM.
                  </span>
                </div>
              )}

              {/* KPI Cards */}
              <KPICards vendedores={vendedores} />

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)] xl:items-stretch">
                <div className="space-y-3 xl:flex xl:flex-col">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-4 w-4 text-emerald-300" />
                    Radar e leitura tatica dos ultimos movimentos da equipe
                  </div>
                  <RadarVendas />
                </div>
                <div className="space-y-3 xl:flex xl:flex-col">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    Distribuicao da equipe para priorizar acao com mais clareza
                  </div>
                  <TeamStatus vendedores={vendedores} />
                </div>
              </section>

              <RankingAlerts role="GERENTE" empresaId={empresaId} />

              {/* Ranking Table */}
              <section className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Performance individual</p>
                    <h2 className="text-xl font-semibold text-foreground">Ranking da equipe</h2>
                  </div>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Toque em um vendedor para abrir o panorama detalhado e entender ritmo, receita e potencial.
                  </p>
                </div>
                <RankingTable vendedores={vendedores} viewMode={viewMode} />
              </section>


              {/* Grand Prix de Vendas Section */}
              <section className="mt-2 rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 sm:rounded-[30px] sm:p-6">
                <div className="mb-6 flex flex-col items-start gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-3 text-xl font-bold text-foreground sm:text-2xl">
                    <Flag className="w-6 h-6 text-primary" />
                    Grand Prix de Vendas
                  </h2>
                  <span className="rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Visao da disputa
                  </span>
                </div>

                {/* Podium */}
                <Podium vendedores={vendedores} viewMode={viewMode} />

                {/* Progress Trail */}
                <ProgressTrail vendedores={vendedores} viewMode={viewMode} />
              </section>
            </div>
          )}
        </main>

        {/* Sidebar HUD */}
        {!showInitialSkeleton && !error && (
          <SidebarHUD
            vendedores={vendedores}
            resumoDiario={textoResumoDiario ?? null}
            resumoMensal={textoResumoMensal}
            viewMode={viewMode}
          />
        )}
      </div>
    </div>
  )
}



