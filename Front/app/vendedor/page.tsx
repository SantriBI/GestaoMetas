"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Target,
  TrendingUp,
  DollarSign,
  Award,
  Users,
  ArrowUp,
  Calendar,
  Zap,
  ChevronUp,
  ChevronDown,
  Minus,
  Flame,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Snowflake,
  MessageCircle,
  Crosshair,
  Swords,
  Search,
} from "lucide-react"
import { formatCurrency } from "@/lib/types"
import RankingAlerts from "@/components/RankingAlerts"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { AuthUser, setStoredUser } from "@/lib/user-session"

interface VendedorData {
  nome: string
  receita: number
  meta: number
  percentual: number
  posicao: number
  totalVendedores?: number
  variacaoPosicao?: number
  diasRestantes: number
  vendasHoje: number
  ticketMedio?: number
  clientesAtendidos?: number

  // 🔹 NOVOS CAMPOS DIÁRIOS
  metaDia: number
  percentualDia: number
  statusDia: string
  data_referencia?: string | Date
  dataReferencia?: string | Date
  clientesDia?: number
  ticketMedioDia?: number
  clientesMes?: number
  ticketMedioMes?: number
  metaHerdada?: number
  meta_herdada?: number
  META_HERDADA?: number
}

interface OportunidadesData {
  resumo: {
    valor_total: number
    em_negociacao: number
    novo_contato: number
    sem_acompanhamento: number
  }
  orcamentos: Array<{
    id?: number | string
    cliente?: string
    valor?: number
    data?: string | Date
    telefone?: string
  }>
}

type ActiveView = "jornada" | "ataque" | "cliente" | null

function formatDateBR(dateString: string | Date) {
  const d = new Date(dateString)
  return d.toLocaleDateString("pt-BR")
}

function parseApiDate(dateValue?: string | Date): Date | null {
  if (!dateValue) return null

  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  const value = String(dateValue).trim()
  const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/)

  if (brMatch) {
    const day = Number(brMatch[1])
    const month = Number(brMatch[2]) - 1
    const yearRaw = Number(brMatch[3])
    const year = brMatch[3].length === 2 ? 2000 + yearRaw : yearRaw
    const parsed = new Date(year, month, day)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function formatOpportunityDate(dateValue?: string | Date): string {
  const parsed = parseApiDate(dateValue)
  return parsed ? parsed.toLocaleDateString("pt-BR") : "-"
}

function formatDateInputValue(dateValue?: string | Date): string {
  const parsed = parseApiDate(dateValue)
  if (!parsed) return ""

  const ano = parsed.getFullYear()
  const mes = String(parsed.getMonth() + 1).padStart(2, "0")
  const dia = String(parsed.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function formatDateFilterLabel(dateValue?: string | null): string {
  if (!dateValue) return "-"
  return formatDateBR(new Date(`${dateValue}T00:00:00`))
}

function isToday(dateString: string | Date) {
  const ref = new Date(dateString)
  const now = new Date()

  return (
    ref.getFullYear() === now.getFullYear() &&
    ref.getMonth() === now.getMonth() &&
    ref.getDate() === now.getDate()
  )
}

export default function VendedorDashboard() {
  const router = useRouter()
  const [vendedor, setVendedor] = useState<VendedorData | null>(null)
  const [oportunidades, setOportunidades] = useState<OportunidadesData | null>(null)
  const [isLoadingOportunidades, setIsLoadingOportunidades] = useState(true)
  const [isTabelaOportunidadesOpen, setIsTabelaOportunidadesOpen] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState("")
  const [dataInicialFiltro, setDataInicialFiltro] = useState("")
  const [dataFinalFiltro, setDataFinalFiltro] = useState("")
  const [ordenacaoCampo, setOrdenacaoCampo] = useState<"data" | "valor">("data")
  const [ordenacaoDirecao, setOrdenacaoDirecao] = useState<"desc" | "asc">("desc")
  const [empresaId, setEmpresaId] = useState<string | number | null>(null)
  const [skVendedor, setSkVendedor] = useState<string | number | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const [journeyAnimationCycle, setJourneyAnimationCycle] = useState(0)
  const [isJourneyButtonPressed, setIsJourneyButtonPressed] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const jornadaSectionRef = useRef<HTMLDivElement | null>(null)
  const hasPlayedConfettiRef = useRef(false)

  useEffect(() => {
    const userStr = sessionStorage.getItem("user")

    if (!userStr) {
      router.push("/login")
      return
    }

    const user = JSON.parse(userStr) as AuthUser

    if (user.role !== "VENDEDOR") {
      router.push("/login")
      return
    }

    const normalizedUser = {
      ...user,
      nome: String(user.nome ?? "").trim(),
    }

    setAuthUser(normalizedUser)
    setStoredUser(normalizedUser)
    setEmpresaId(user.empresa_id ?? user.sk_empresa ?? null)
    setSkVendedor(user.sk_vendedor ?? null)

    async function fetchVendedor() {
      try {
        const response = await fetch(
          `/api/vendedor/${user.sk_vendedor}`
        )

        if (!response.ok) {
          throw new Error("Erro ao carregar dados do vendedor")
        }

        const data = await response.json()
        setVendedor(data)
      } catch (err) {
        console.error("Erro ao buscar vendedor:", err)
      }
    }

    async function fetchOportunidades(skVendedorParam: string | number | null) {
      if (!skVendedorParam) {
        setIsLoadingOportunidades(false)
        return
      }

      try {
        setIsLoadingOportunidades(true)
        const res = await fetch(
          `/api/vendedor/${skVendedorParam}/oportunidades`,
          { cache: "no-store" }
        )
        if (!res.ok) {
          throw new Error("Erro ao carregar oportunidades")
        }
        const data = await res.json()
        setOportunidades(data)
      } catch (err) {
        console.error("Erro ao buscar oportunidades:", err)
        setOportunidades(null)
      } finally {
        setIsLoadingOportunidades(false)
      }
    }

    fetchVendedor()
    fetchOportunidades(user.sk_vendedor ?? null)
  }, [router])

  useEffect(() => {
    if (!vendedor || hasPlayedConfettiRef.current || vendedor.posicao > 3) {
      return
    }

    hasPlayedConfettiRef.current = true
    setConfettiActive(true)
  }, [vendedor])

  useEffect(() => {
    if (!confettiActive || !vendedor || vendedor.posicao > 3) {
      return
    }

    const canvas = confettiCanvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return
    }

    const paletteByPosition: Record<number, string[]> = {
      1: ["#FDE68A", "#F59E0B", "#FBBF24", "#FFF7D6", "#FFE08A"],
      2: ["#E5E7EB", "#CBD5E1", "#94A3B8", "#F8FAFC", "#D1D5DB"],
      3: ["#D97706", "#B45309", "#92400E", "#F59E0B", "#FBBF24"],
    }

    const colors = paletteByPosition[vendedor.posicao] ?? paletteByPosition[3]
    const dpr = window.devicePixelRatio || 1
    const durationMs = 4000
    const pieceCount = 110
    const gravity = 0.07
    const drag = 0.997
    let rafId = 0
    let endTimeout: ReturnType<typeof setTimeout> | null = null

    type Particle = {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      tilt: number
      tiltSpeed: number
      opacity: number
    }

    const particles: Particle[] = []

    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawn = () => {
      const width = window.innerWidth
      for (let i = 0; i < pieceCount; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: -20 - Math.random() * window.innerHeight * 0.35,
          vx: (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 2.8,
          size: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          tilt: Math.random() * Math.PI,
          tiltSpeed: 0.03 + Math.random() * 0.08,
          opacity: 0.7 + Math.random() * 0.3,
        })
      }
    }

    const animate = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.vx *= drag
        p.vy += gravity
        p.x += p.vx
        p.y += p.vy
        p.tilt += p.tiltSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(Math.sin(p.tilt))
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()

        if (p.y > height + 24) {
          p.y = -12
          p.x = Math.random() * width
          p.vy = 1 + Math.random() * 2.2
        }
      }

      rafId = window.requestAnimationFrame(animate)
    }

    resize()
    spawn()
    animate()

    const onResize = () => resize()
    window.addEventListener("resize", onResize)

    endTimeout = setTimeout(() => {
      window.cancelAnimationFrame(rafId)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      setConfettiActive(false)
    }, durationMs)

    return () => {
      if (endTimeout) {
        clearTimeout(endTimeout)
      }
      window.removeEventListener("resize", onResize)
      window.cancelAnimationFrame(rafId)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }, [confettiActive, vendedor])

  useEffect(() => {
    if (activeView !== "jornada") {
      return
    }

    const scrollTimeout = window.setTimeout(() => {
      jornadaSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 120)

    return () => window.clearTimeout(scrollTimeout)
  }, [activeView])


  if (!vendedor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  const faltaParaMeta = vendedor.meta - vendedor.receita
  const metaDia = vendedor.metaDia || 0
  const vendasHoje = vendedor.vendasHoje || 0
  const faltaHoje = Math.max(metaDia - vendasHoje, 0)

  const percentualDia =
    metaDia > 0
      ? Math.min((vendasHoje / metaDia) * 100, 100)
      : 0

  const variacaoPosicao = vendedor.variacaoPosicao ?? 0

  const dinheiroEmJogo = oportunidades?.resumo.valor_total ?? 0
  const emNegociacao = oportunidades?.resumo.em_negociacao ?? 0
  const novoContato = oportunidades?.resumo.novo_contato ?? 0
  const semAcompanhamento = oportunidades?.resumo.sem_acompanhamento ?? 0
  const listaOrcamentos = oportunidades?.orcamentos ?? []
  const orcamentosAbertos = listaOrcamentos.length
  const valorOrcamentos = dinheiroEmJogo
  const termoBusca = buscaCliente.trim().toLowerCase()
  const datasDisponiveis = listaOrcamentos
    .map((orcamento) => parseApiDate(orcamento.data))
    .filter((data): data is Date => !!data)
    .sort((a, b) => a.getTime() - b.getTime())
  const dataMinimaDisponivel = datasDisponiveis[0]
  const dataMaximaDisponivel = datasDisponiveis[datasDisponiveis.length - 1]
  const dataMinimaInput = dataMinimaDisponivel ? formatDateInputValue(dataMinimaDisponivel) : ""
  const dataMaximaInput = dataMaximaDisponivel ? formatDateInputValue(dataMaximaDisponivel) : ""
  const filtroDataInicial = dataInicialFiltro ? new Date(`${dataInicialFiltro}T00:00:00`) : null
  const filtroDataFinal = dataFinalFiltro ? new Date(`${dataFinalFiltro}T23:59:59`) : null
  const orcamentosFiltrados = listaOrcamentos.filter((orcamento) => {
    const clienteValido = (orcamento.cliente ?? "").toLowerCase().includes(termoBusca)
    if (!clienteValido) return false

    const dataOrcamento = parseApiDate(orcamento.data)
    if (filtroDataInicial && (!dataOrcamento || dataOrcamento < filtroDataInicial)) {
      return false
    }
    if (filtroDataFinal && (!dataOrcamento || dataOrcamento > filtroDataFinal)) {
      return false
    }

    return true
  })
  const orcamentosOrdenados = [...orcamentosFiltrados].sort((a, b) => {
    if (ordenacaoCampo === "valor") {
      const valorA = Number(a.valor ?? 0)
      const valorB = Number(b.valor ?? 0)
      return ordenacaoDirecao === "asc" ? valorA - valorB : valorB - valorA
    }

    const dataA = parseApiDate(a.data)?.getTime() ?? 0
    const dataB = parseApiDate(b.data)?.getTime() ?? 0
    return ordenacaoDirecao === "asc" ? dataA - dataB : dataB - dataA
  })
  const periodoResumoInicial =
    dataInicialFiltro || (dataFinalFiltro && dataMinimaInput) ? (dataInicialFiltro || dataMinimaInput) : ""
  const periodoResumoFinal =
    dataFinalFiltro || (dataInicialFiltro && dataMaximaInput) ? (dataFinalFiltro || dataMaximaInput) : ""
  const dataReferencia = vendedor.dataReferencia
  const dataReferenciaValida =
    !!dataReferencia && !Number.isNaN(new Date(dataReferencia).getTime())
  const dadosSaoDeHoje =
    dataReferencia && dataReferenciaValida ? isToday(dataReferencia) : false
  const dataReferenciaFormatada =
    dataReferencia && dataReferenciaValida ? formatDateBR(dataReferencia) : null
  const metaHerdada = Number(
    vendedor.metaHerdada ?? vendedor.meta_herdada ?? vendedor.META_HERDADA ?? 0
  )

  const getPositionIcon = () => {
    if (variacaoPosicao > 0) return <ChevronUp className="w-5 h-5 text-emerald-300" />
    if (variacaoPosicao < 0) return <ChevronDown className="w-5 h-5 text-red-400" />
    return <Minus className="w-4 h-4 text-muted-foreground" />
  }

  const getRankingMessage = (posicao: number) => {
    if (posicao === 1) {
      return "Incrível! Você está liderando o ranking 🚀 Continue assim!"
    }

    if (posicao === 2) {
      return "Excelente! Você está no Top 2 👏 Muito perto da liderança!"
    }

    if (posicao === 3) {
      return "Parabéns! Você está no Top 3 🔥 Continue pressionando!"
    }

    if (posicao >= 4 && posicao <= 10) {
      return "Você está muito perto do Top 3 💪 Foque nos próximos dias!"
    }

    return "Ainda dá tempo de subir no ranking 🚀 Vamos acelerar as vendas!"
  }

  const getJourneyAnimationStyle = (delayMs: number) =>
    activeView === "jornada"
      ? {
          animationName: "journey-drop-in",
          animationDuration: "860ms",
          animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.22, 1.04)",
          animationFillMode: "both" as const,
          animationDelay: `${delayMs}ms`,
        }
      : undefined

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(245,158,11,0.08),transparent_22%),linear-gradient(135deg,rgba(8,16,29,1),rgba(9,14,24,1)_45%,rgba(13,22,36,1))]">
      {confettiActive ? (
        <canvas
          ref={confettiCanvasRef}
          className="pointer-events-none fixed inset-0 z-[60]"
          aria-hidden="true"
        />
      ) : null}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-[22rem] -right-24 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      </div>
      {/* HEADER */}
      <AppShellNav user={authUser} />

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-10 space-y-10">
        {metaHerdada === 1 && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl border border-amber-600/50 bg-amber-900/40 text-amber-200">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span className="text-sm">
              Meta utilizada do mês anterior. A meta do mês atual ainda não foi cadastrada no ADM.
            </span>
          </div>
        )}

        {dataReferenciaValida ? (
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
              <span
                className={`h-2 w-2 rounded-full ${
                  dadosSaoDeHoje ? "bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" : "bg-amber-400"
                }`}
              />
              <span>Dados atualizados até: {dataReferenciaFormatada}</span>
            </div>
          </div>
        ) : null}

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[30px] border border-emerald-400/16 bg-[linear-gradient(140deg,rgba(6,19,14,0.94),rgba(9,16,26,0.94),rgba(7,26,18,0.9))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-36 w-36 rounded-full bg-emerald-400/12 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-lime-400/8 blur-3xl" />
          </div>
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                  Painel do vendedor
                </div>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-5">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Olá, <span className="bg-gradient-to-r from-emerald-200 via-emerald-300 to-lime-200 bg-clip-text text-transparent">{vendedor.nome.split(" ")[0]}</span>
                  </h1>
                  <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-400/18 bg-emerald-500/8 px-4 py-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-lime-400 shadow-[0_8px_18px_rgba(34,197,94,0.22)]">
                      <Award className="h-5 w-5 text-[#04110a]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                        Ranking atual
                      </p>
                      <p className="text-2xl font-black text-white">
                        {vendedor.posicao}{" "}
                        <span className="text-sm font-semibold text-white/55">
                          / {vendedor.totalVendedores}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-100/85">
                  {getPositionIcon()}
                  <span>{getRankingMessage(vendedor.posicao)}</span>
                </div>
              </div>
            </div>

            <div className="grid w-full max-w-4xl gap-3 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setIsJourneyButtonPressed(true)
                  setActiveView((prev) => {
                    if (prev === "jornada") {
                      return null
                    }
                    setJourneyAnimationCycle((cycle) => cycle + 1)
                    return "jornada"
                  })
                  window.setTimeout(() => setIsJourneyButtonPressed(false), 180)
                }}
                className={`group block w-full overflow-hidden rounded-[26px] border text-left transition-all duration-300 hover:-translate-y-0.5 ${
                  activeView === "jornada"
                    ? "border-sky-300/35 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(59,130,246,0.1),rgba(15,23,42,0.2))] shadow-[0_16px_38px_rgba(37,99,235,0.2)]"
                    : "border-white/10 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(56,189,248,0.06),rgba(15,23,42,0.18))] shadow-[0_14px_34px_rgba(37,99,235,0.12)] hover:border-sky-300/24 hover:shadow-[0_18px_42px_rgba(37,99,235,0.18)]"
                } ${isJourneyButtonPressed ? "scale-[0.985] shadow-[0_0_0_1px_rgba(125,211,252,0.28),0_0_36px_rgba(56,189,248,0.22)]" : "scale-100"}`}
              >
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/28 via-blue-400/18 to-cyan-300/16 text-sky-50 transition-transform duration-300 group-hover:scale-105">
                    <TrendingUp className="h-5.5 w-5.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-sky-300" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/70">
                        Ação principal
                      </span>
                    </div>
                    <p className="mt-1.5 text-lg font-black tracking-tight text-white">
                      Minha Jornada
                    </p>
                    <p className="mt-1 text-sm leading-snug text-white/78">
                      Abra sua visão completa de performance e prioridades do dia.
                    </p>
                    <p className="mt-2 text-[11px] leading-snug text-sky-200/85">
                      Meta, missão, oportunidades e carteira em um só fluxo.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveView("ataque")
                  router.push("/area-ataque")
                }}
                className="group block w-full overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(74,222,128,0.07),rgba(15,23,42,0.18))] text-left shadow-[0_14px_34px_rgba(34,197,94,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/22 hover:shadow-[0_18px_42px_rgba(34,197,94,0.16)]"
              >
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/22 via-emerald-400/14 to-lime-500/16 text-emerald-100 transition-transform duration-300 group-hover:scale-105">
                    <Swords className="h-5.5 w-5.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-3.5 w-3.5 text-emerald-300" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Funcionalidade principal
                      </span>
                    </div>
                    <p className="mt-1.5 text-lg font-black tracking-tight text-white">
                      Área de Ataque
                    </p>
                    <p className="mt-1 text-sm leading-snug text-white/72">
                      Descubra onde agir agora para vender mais.
                    </p>
                    <p className="mt-2 text-[11px] leading-snug text-emerald-200/80">
                      Veja onde estão suas melhores oportunidades de venda.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveView("cliente")
                  router.push("/investigar-cliente")
                }}
                className="group block w-full overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(34,197,94,0.08),rgba(15,23,42,0.18))] text-left shadow-[0_14px_34px_rgba(16,185,129,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/20 hover:shadow-[0_18px_42px_rgba(16,185,129,0.18)]"
              >
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/22 via-teal-400/16 to-lime-500/16 text-emerald-100 transition-transform duration-300 group-hover:scale-105">
                    <Search className="h-5.5 w-5.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-emerald-300" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                        Análise de cliente
                      </span>
                    </div>
                    <p className="mt-1.5 text-lg font-black tracking-tight text-white">
                      Investigar Cliente
                    </p>
                    <p className="mt-1 text-sm leading-snug text-white/72">
                      Pesquise qualquer cliente e descubra o que faz sentido ofertar.
                    </p>
                    <p className="mt-2 text-[11px] leading-snug text-emerald-200/78">
                      Entenda RFV, histórico, produtos preferidos e comportamento de compra.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        <div className={activeView === "jornada" ? "space-y-10" : "hidden"} aria-hidden={activeView !== "jornada"}>
          <RankingAlerts
            role="VENDEDOR"
            empresaId={empresaId}
            skVendedor={skVendedor}
          />

          {/* META */}
          <div
            ref={jornadaSectionRef}
            key={`journey-meta-${journeyAnimationCycle}`}
            className="transform-gpu will-change-transform"
            style={getJourneyAnimationStyle(0)}
          >
            <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(12,18,29,0.92))] p-8 shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition-transform duration-300 hover:-translate-y-1">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted-foreground">Meta do mês</p>
              <p className="text-2xl font-bold">{formatCurrency(vendedor.meta)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Realizado</p>
                <p className="text-2xl font-bold text-emerald-200">
                  {formatCurrency(vendedor.receita)}
                </p>
            </div>
          </div>

          <div className="relative h-5 overflow-hidden rounded-full bg-white/6">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-lime-400 transition-all"
              style={{ width: `${vendedor.percentual * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {(vendedor.percentual * 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Faltam {formatCurrency(faltaParaMeta)}</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {vendedor.diasRestantes} dias restantes
            </span>
          </div>
          {/* FAIXA DE CONTEXTO - CLIENTES & TICKET */}
            <section className="mt-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(30,41,59,0.62),rgba(15,23,42,0.82),rgba(14,116,144,0.12))] px-6 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                    <Users className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clientes atendidos no Mês</p>
                    <p className="text-lg font-bold text-foreground">
                      {vendedor.clientesMes ?? 0}
                    </p>
                  </div>
                </div>

                <div className="hidden h-8 w-px bg-white/10 sm:block" />

                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                    <DollarSign className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ticket médio do Mês</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(vendedor.ticketMedioMes ?? 0)}
                    </p>
                  </div>
                </div>

              </div>
            </section>

            </section>
          </div>

          {/* MISSÃO DO DIA */}
          <div
            key={`journey-missao-${journeyAnimationCycle}`}
            className="transform-gpu will-change-transform"
            style={getJourneyAnimationStyle(100)}
          >
            <section className="rounded-2xl border border-amber-400/20 bg-[linear-gradient(135deg,rgba(120,53,15,0.38),rgba(88,28,12,0.24),rgba(15,23,42,0.92))] p-6 shadow-[0_10px_28px_rgba(120,53,15,0.18)] transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-300" />
              <h3 className="font-semibold text-amber-100">Missão do Dia</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Hoje o foco é manter o ritmo para fechar o mês forte 🚀
            </p>

            {/* VALORES */}
              <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Meta do dia</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(metaDia)}
                </p>
              </div>

              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Já vendido</p>
                <p className="text-lg font-bold text-amber-200">
                  {formatCurrency(vendedor.vendasHoje)}
                </p>
              </div>

              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Falta</p>
                <p className={`text-lg font-bold ${faltaHoje > 0 ? "text-amber-200" : "text-emerald-300"}`}>
                  {formatCurrency(Math.max(faltaHoje, 0))}
                </p>
              </div>
            </div>

            {/* BARRA DE PROGRESSO */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso do dia</span>
                  <span>
                    {percentualDia.toFixed(1)}%
                  </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full transition-all ${percentualDia >= 100 ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-lime-400" : "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500"}`}
                    style={{
                      width: `${percentualDia}%`,
                    }}
                />
              </div>
            </div>

            {/* TEXTO FINAL */}
            <p className="text-sm">
              {faltaHoje <= 0 ? (
                <>Parabéns, você já atingiu sua meta do dia! 🎉</>
              ) : (
                <>
                  Precisamos faturar{" "}
                  <strong className="text-amber-100">
                    {formatCurrency(Math.max(faltaHoje, 0))}
                  </strong>{" "}
                  para bater a meta de hoje 💪
                </>
              )}
            </p>

            {/* FAIXA DE CONTEXTO - CLIENTES & TICKET */}
              <section className="mt-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(51,65,85,0.54),rgba(30,41,59,0.72),rgba(120,53,15,0.12))] px-6 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8">
                      <Users className="h-5 w-5 text-emerald-200" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clientes atendidos hoje</p>
                      <p className="text-lg font-bold text-foreground">
                        {vendedor.clientesDia ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="hidden h-8 w-px bg-white/10 sm:block" />

                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8">
                      <DollarSign className="h-5 w-5 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ticket médio do dia</p>
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(vendedor.ticketMedioDia ?? 0)}
                      </p>
                    </div>
                  </div>

                </div>
              </section>

            </section>
          </div>
          
          {/* DICAS - FAIXA AZUL */}
          <div
            key={`journey-janela-${journeyAnimationCycle}`}
            className="transform-gpu will-change-transform"
            style={getJourneyAnimationStyle(200)}
          >
            <section className="rounded-2xl border border-emerald-400/18 bg-[linear-gradient(135deg,rgba(8,31,20,0.62),rgba(15,23,42,0.9),rgba(34,197,94,0.08))] px-6 py-4 shadow-[0_8px_24px_rgba(16,185,129,0.14)] transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-start gap-3">
               
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/16">
                👇
              </div>

              <div>
                <h3 className="mb-1 text-sm font-semibold text-emerald-200">
                  Janela de oportunidade
                </h3>

                <p className="text-sm text-foreground">
                  {isLoadingOportunidades ? (
                    <span className="inline-block h-4 w-72 max-w-full animate-pulse rounded bg-emerald-200/30" />
                  ) : (
                    <>
                      Existem <strong>{orcamentosAbertos} orçamentos</strong> em aberto nos últimos 30 dias
                    </>
                  )}
                </p>

                <p className="text-sm font-bold mt-1">
                  {isLoadingOportunidades ? (
                    <span className="inline-block h-5 w-40 animate-pulse rounded bg-emerald-200/30" />
                  ) : (
                    <>Valor Total: {formatCurrency(valorOrcamentos)}</>
                  )}
                </p>
              </div>

            </div>
            </section>
          </div>


          {/* DINHEIRO EM JOGO */}
          <div
            key={`journey-dinheiro-${journeyAnimationCycle}`}
            className="transform-gpu will-change-transform"
            style={getJourneyAnimationStyle(300)}
          >
            <section className="rounded-3xl border border-amber-400/20 bg-[linear-gradient(140deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92),rgba(120,53,15,0.18))] p-8 shadow-[0_10px_30px_rgba(245,158,11,0.12)] transition-transform duration-300 hover:-translate-y-1">
          <h3 className="font-bold text-xl mb-1">💰 Dinheiro em Jogo</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Oportunidades abertas que podem virar venda
          </p>

          <p className="text-4xl font-black text-warning text-center mb-8">
            {isLoadingOportunidades ? (
              <span className="inline-block h-10 w-48 animate-pulse rounded bg-warning/20" />
            ) : (
              formatCurrency(dinheiroEmJogo)
            )}
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-destructive/10 p-4 transition-colors hover:bg-destructive/15">
              <Flame className="w-4 h-4 mb-2 text-destructive" />
              <p className="text-sm">Em negociação</p>
              <p className="font-bold">
                {isLoadingOportunidades ? (
                  <span className="inline-block h-5 w-28 animate-pulse rounded bg-destructive/20" />
                ) : (
                  formatCurrency(emNegociacao)
                )}
              </p>
            </div>

            <div className="rounded-xl bg-warning/10 p-4 transition-colors hover:bg-warning/15">
              <AlertCircle className="w-4 h-4 mb-2 text-warning" />
              <p className="text-sm">Novo contato</p>
              <p className="font-bold">
                {isLoadingOportunidades ? (
                  <span className="inline-block h-5 w-28 animate-pulse rounded bg-warning/20" />
                ) : (
                  formatCurrency(novoContato)
                )}
              </p>
            </div>

            <div className="rounded-xl bg-info/10 p-4 transition-colors hover:bg-info/15">
              <Snowflake className="w-4 h-4 mb-2 text-info" />
              <p className="text-sm">Sem acompanhamento</p>
              <p className="font-bold">
                {isLoadingOportunidades ? (
                  <span className="inline-block h-5 w-28 animate-pulse rounded bg-info/20" />
                ) : (
                  formatCurrency(semAcompanhamento)
                )}
              </p>
            </div>
          </div>

            </section>
          </div>

          <div
            key={`journey-tabela-${journeyAnimationCycle}`}
            className="transform-gpu will-change-transform"
            style={getJourneyAnimationStyle(400)}
          >
            <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(11,18,32,0.94))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
          <button
            type="button"
            onClick={() => setIsTabelaOportunidadesOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/8"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">Tabela de Oportunidades</h3>
              {!isLoadingOportunidades && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {listaOrcamentos.length} registros
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span>{isTabelaOportunidadesOpen ? "Fechar" : "Abrir"}</span>
              {isTabelaOportunidadesOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </button>

          {isTabelaOportunidadesOpen && (
            <div className="mt-4 space-y-4">
              {!isLoadingOportunidades && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <input
                      type="text"
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      placeholder="Pesquisar cliente..."
                      className="rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-400 xl:col-span-2"
                    />

                    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Data inicial
                      </label>
                      <div className="flex items-center gap-2 rounded-md bg-[#0b1220] px-3 py-2">
                        <Calendar className="h-4 w-4 text-emerald-200" />
                        <input
                          type="date"
                          value={dataInicialFiltro}
                          onChange={(e) => setDataInicialFiltro(e.target.value)}
                          min={dataMinimaInput || undefined}
                          max={dataMaximaInput || undefined}
                          className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Data final
                      </label>
                      <div className="flex items-center gap-2 rounded-md bg-[#0b1220] px-3 py-2">
                        <Calendar className="h-4 w-4 text-emerald-200" />
                        <input
                          type="date"
                          value={dataFinalFiltro}
                          onChange={(e) => setDataFinalFiltro(e.target.value)}
                          min={dataMinimaInput || undefined}
                          max={dataMaximaInput || undefined}
                          className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBuscaCliente("")
                        setDataInicialFiltro("")
                        setDataFinalFiltro("")
                        setOrdenacaoCampo("data")
                        setOrdenacaoDirecao("desc")
                      }}
                       className="rounded-lg border border-amber-400/20 bg-amber-500/8 px-3 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/14"
                    >
                      Limpar filtros
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {orcamentosOrdenados.length} oportunidades encontradas
                      </span>
                      {dataMinimaInput && dataMaximaInput ? (
                        <span>
                          no período{" "}
                          {formatDateFilterLabel(periodoResumoInicial || dataMinimaInput)} até{" "}
                          {formatDateFilterLabel(periodoResumoFinal || dataMaximaInput)}
                        </span>
                      ) : null}
                    </div>
                     <span className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                       Lista completa
                     </span>
                  </div>

                  {dataMinimaInput && dataMaximaInput ? (
                    <p className="text-xs text-muted-foreground">
                      Datas disponíveis na carteira: {formatDateFilterLabel(dataMinimaInput)} até{" "}
                      {formatDateFilterLabel(dataMaximaInput)}.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <table className="min-w-full text-sm">
                  <thead className="bg-card/80 text-left">
                    <tr className="border-b border-border/80">
                      <th className="px-4 py-3 font-semibold text-foreground">Cliente</th>
                      <th className="px-4 py-3 font-semibold text-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            if (ordenacaoCampo === "valor") {
                              setOrdenacaoDirecao((prev) => (prev === "desc" ? "asc" : "desc"))
                              return
                            }
                            setOrdenacaoCampo("valor")
                            setOrdenacaoDirecao("desc")
                          }}
                           className="inline-flex items-center gap-2 transition-colors hover:text-emerald-200"
                        >
                          Valor
                          {ordenacaoCampo === "valor" ? (
                            ordenacaoDirecao === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4 text-white/45" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold text-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            if (ordenacaoCampo === "data") {
                              setOrdenacaoDirecao((prev) => (prev === "desc" ? "asc" : "desc"))
                              return
                            }
                            setOrdenacaoCampo("data")
                            setOrdenacaoDirecao("desc")
                          }}
                           className="inline-flex items-center gap-2 transition-colors hover:text-emerald-200"
                        >
                          Data
                          {ordenacaoCampo === "data" ? (
                            ordenacaoDirecao === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4 text-white/45" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold text-foreground">Contato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingOportunidades ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={`orcamento-skeleton-${index}`} className="border-b border-border/60">
                          <td className="px-4 py-3">
                            <span className="inline-block h-4 w-36 animate-pulse rounded bg-muted" />
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block h-4 w-8 animate-pulse rounded bg-muted" />
                          </td>
                        </tr>
                      ))
                    ) : orcamentosOrdenados.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhuma oportunidade encontrada com esse filtro.
                        </td>
                      </tr>
                    ) : (
                      orcamentosOrdenados.map((orcamento, index) => {
                        const telefoneLimpo = (orcamento.telefone ?? "").replace(/\D/g, "")
                        const whatsappHref = `https://wa.me/55${telefoneLimpo}`

                        return (
                          <tr
                            key={`${orcamento.id ?? orcamento.cliente ?? "cliente"}-${index}`}
                            className="border-b border-border/60 transition-colors hover:bg-emerald-500/8"
                          >
                            <td className="px-4 py-3 font-medium text-foreground">
                              {orcamento.cliente || "-"}
                            </td>
                            <td className="px-4 py-3 text-amber-200">
                              {formatCurrency(orcamento.valor ?? 0)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatOpportunityDate(orcamento.data)}
                            </td>
                            <td className="px-4 py-3">
                              {telefoneLimpo ? (
                                <a
                                  href={whatsappHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex rounded-lg p-2 text-emerald-300 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
                                  aria-label={`Falar com ${orcamento.cliente ?? "cliente"} no WhatsApp`}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </section>
          </div>
        </div>
        <style jsx>{`
          @keyframes journey-drop-in {
            0% {
              opacity: 0;
              transform: translate3d(0, -42px, 0) scale(0.982);
            }
            58% {
              opacity: 1;
              transform: translate3d(0, 10px, 0) scale(1);
            }
            76% {
              opacity: 1;
              transform: translate3d(0, -3px, 0) scale(1);
            }
            90% {
              opacity: 1;
              transform: translate3d(0, 2px, 0) scale(1);
            }
            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
            }
          }
        `}</style>

        {/* FOOTER */}
        <footer className="flex justify-between border-t border-white/10 pt-6 text-sm text-muted-foreground">
          <span>Atualizado agora</span>
          <button onClick={() => window.location.reload()} className="text-primary">
            Atualizar
          </button>
        </footer>
      </main>
    </div>
  )
}
