"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  Swords,
  Search,
  X,
} from "lucide-react"
import { formatCurrency } from "@/lib/types"
import RankingAlerts from "@/components/RankingAlerts"
import { ChallengeNotificationBanner } from "@/components/challenges/ChallengeNotificationBanner"
import { CardDashboard, dashboardCardThemes, dashboardCardThemesLight, type CardDashboardConfig } from "@/components/dashboard/CardDashboard"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MotivationSpotlight } from "@/components/layout/MotivationSpotlight"
import { useNotifications } from "@/components/notifications/NotificationContext"
import { useSellerChallengeAlert, useSellerChallenges } from "@/hooks/useChallenges"
import {
  getChallengeCampaignKind,
  getSellerCampaignNotificationId,
  getSellerCampaignNotificationPrefixes,
  shouldShowSellerCampaignBanner,
  type Challenge,
  type SellerChallengeAlertItem,
} from "@/lib/challenges"
import { fetchSellerLifeGoal, type LifeGoalResponse } from "@/lib/life-goal"
import { buildMotivationMessage } from "@/lib/motivation"
import { AuthUser, setStoredUser } from "@/lib/user-session"
import { useTheme } from "next-themes"

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
  data_referencia?: string | Date | null
  dataReferencia?: string | Date | null
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

type ActiveView = "jornada" | null
const STARTUP_NOTIFICATION_DURATION_MS = 10000
const CHALLENGE_NOTIFICATION_DURATION_MS = 10000
const EMPTY_CHALLENGES: Challenge[] = []
const EMPTY_ALERT_CAMPAIGNS: SellerChallengeAlertItem[] = []

type DashboardCampaignBannerItem = SellerChallengeAlertItem & Pick<Partial<Challenge>, "metas" | "participant">

function createFallbackVendedor(user?: AuthUser | null): VendedorData {
  return {
    nome: String(user?.nome ?? "Vendedor").trim() || "Vendedor",
    receita: 0,
    meta: 0,
    percentual: 0,
    posicao: 0,
    totalVendedores: 0,
    variacaoPosicao: 0,
    diasRestantes: 0,
    vendasHoje: 0,
    ticketMedio: 0,
    clientesAtendidos: 0,
    metaDia: 0,
    percentualDia: 0,
    statusDia: "OK",
    dataReferencia: null,
    clientesDia: 0,
    ticketMedioDia: 0,
    clientesMes: 0,
    ticketMedioMes: 0,
    metaHerdada: 0,
  }
}

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

function isDashboardCampaignAvailable(challenge: DashboardCampaignBannerItem) {
  const participantStatus = String(challenge.participant?.statusParticipacao ?? challenge.participantStatus ?? "").toUpperCase()
  return challenge.exigeAceite !== false && (!participantStatus || ["DISPONIVEL", "CONVIDADO"].includes(participantStatus))
}

function buildEmpresaQuery(empresaId?: string | number | null) {
  const params = new URLSearchParams()
  if (empresaId !== null && empresaId !== undefined && String(empresaId).trim()) {
    params.set("empresa_id", String(empresaId))
  }

  const query = params.toString()
  return query ? `?${query}` : ""
}

export default function VendedorDashboard() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { addNotification, notifications, removeNotifications } = useNotifications()
  const [vendedor, setVendedor] = useState<VendedorData | null>(null)
  const [vendedorLoadError, setVendedorLoadError] = useState<string | null>(null)
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
  const [lifeGoal, setLifeGoal] = useState<LifeGoalResponse | null>(null)
  const [isLoadingLifeGoal, setIsLoadingLifeGoal] = useState(false)
  const [isLifeGoalNoticeDismissed, setIsLifeGoalNoticeDismissed] = useState(false)
  const [isMotivationClosed, setIsMotivationClosed] = useState(false)
  const [dismissedCampaignBannerIds, setDismissedCampaignBannerIds] = useState<Set<string>>(() => new Set())
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const [journeyAnimationCycle, setJourneyAnimationCycle] = useState(0)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [feedbackTexto, setFeedbackTexto] = useState("")
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [confettiActive, setConfettiActive] = useState(false)
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const jornadaSectionRef = useRef<HTMLDivElement | null>(null)
  const hasPlayedConfettiRef = useRef(false)
  const startupNotificationIdsRef = useRef<Set<string>>(new Set())
  const { alert: desafioAlert, loading: isLoadingChallengeAlert } = useSellerChallengeAlert(skVendedor)
  const {
    data: sellerChallengesData,
    loading: isLoadingSellerChallenges,
    acting: isActingSellerCampaign,
    acceptChallenge: acceptSellerCampaign,
    dismissChallenge: dismissSellerCampaign,
  } = useSellerChallenges(skVendedor)
  const sellerCampaignItems = sellerChallengesData?.items ?? EMPTY_CHALLENGES
  const alertCampaignItems = useMemo<DashboardCampaignBannerItem[]>(() => {
    const sourceItems = desafioAlert?.items?.length
      ? desafioAlert.items
      : desafioAlert?.challenge
        ? [desafioAlert.challenge]
        : EMPTY_ALERT_CAMPAIGNS

    if (!sourceItems.length) return sourceItems

    const sellerChallengesById = new Map(sellerCampaignItems.map((item) => [String(item.id), item]))

    return sourceItems.map((item) => {
      const matchingChallenge = sellerChallengesById.get(String(item.id))
      if (!matchingChallenge) return item

      return {
        ...matchingChallenge,
        ...item,
        metas: item.metas?.length ? item.metas : matchingChallenge.metas,
        participant: matchingChallenge.participant,
      }
    })
  }, [desafioAlert, sellerCampaignItems])
  const dashboardCampaignSourceItems: DashboardCampaignBannerItem[] = sellerCampaignItems.length
    ? sellerCampaignItems
    : alertCampaignItems
  const dashboardCampaignIds = dashboardCampaignSourceItems
    .filter(shouldShowSellerCampaignBanner)
    .map((challenge) => String(challenge.id))
  const dashboardCampaignIdsKey = dashboardCampaignIds.join("|")
  const dashboardCampaignNotificationIds = useMemo(() => {
    if (!skVendedor) return []

    const seen = new Set<string>()

    return [...sellerCampaignItems, ...alertCampaignItems]
      .filter(shouldShowSellerCampaignBanner)
      .map((challenge) => getSellerCampaignNotificationId(challenge, skVendedor))
      .filter((id) => {
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
  }, [alertCampaignItems, sellerCampaignItems, skVendedor])
  const dashboardCampaignNotificationIdsKey = dashboardCampaignNotificationIds.join("|")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!authUser?.sk_vendedor) return

    startupNotificationIdsRef.current = new Set()
    setIsLifeGoalNoticeDismissed(false)
    setIsMotivationClosed(false)
    setDismissedCampaignBannerIds(new Set())
  }, [authUser?.sk_vendedor])

  useEffect(() => {
    const userStr = sessionStorage.getItem("user")

    if (!userStr) {
      router.push("/login")
      return
    }

    const user = JSON.parse(userStr) as AuthUser

    if (user.role !== "VENDEDOR" && user.role !== "GERENTE_SISTEMAS") {
      router.push("/login")
      return
    }

    if (user.role === "GERENTE_SISTEMAS" && (!user.empresa_id || !user.sk_vendedor)) {
      router.push("/gerente-sistemas")
      return
    }

    const normalizedUser = {
      ...user,
      nome: String(user.nome ?? "").trim(),
    }
    const currentEmpresaId = user.empresa_id ?? user.sk_empresa ?? null

    setAuthUser(normalizedUser)
    setStoredUser(normalizedUser)
    setEmpresaId(currentEmpresaId)
    setSkVendedor(user.sk_vendedor ?? null)
    setVendedor(createFallbackVendedor(normalizedUser))

    async function fetchVendedor() {
      if (!user.sk_vendedor) {
        setVendedor(createFallbackVendedor(normalizedUser))
        setVendedorLoadError("Seu cadastro de vendedor ainda nao esta vinculado para carregar o dashboard completo.")
        return
      }

      try {
        const response = await fetch(
          `/api/vendedor/${user.sk_vendedor}${buildEmpresaQuery(currentEmpresaId)}`,
          { cache: "no-store", credentials: "include" }
        )

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          setVendedor(createFallbackVendedor(normalizedUser))
          setVendedorLoadError(payload?.error ?? "Nao foi possivel carregar todos os dados do vendedor agora.")
          return
        }

        const data = await response.json()
        setVendedor({
          ...createFallbackVendedor(normalizedUser),
          ...data,
          nome: String(data?.nome ?? normalizedUser.nome ?? "Vendedor").trim() || "Vendedor",
        })
        setVendedorLoadError(null)
      } catch (err) {
        setVendedor(createFallbackVendedor(normalizedUser))
        setVendedorLoadError(err instanceof Error ? err.message : "Nao foi possivel carregar os dados do vendedor.")
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
          `/api/vendedor/${skVendedorParam}/oportunidades${buildEmpresaQuery(currentEmpresaId)}`,
          { cache: "no-store", credentials: "include" }
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

    async function fetchLifeGoal(skVendedorParam: string | number | null) {
      if (!skVendedorParam) {
        setLifeGoal(null)
        setIsLoadingLifeGoal(false)
        return
      }

      try {
        setIsLoadingLifeGoal(true)
        const data = await fetchSellerLifeGoal(skVendedorParam)
        setLifeGoal(data)
      } catch (err) {
        console.warn("Meta de Vida indisponivel no dashboard:", err)
        setLifeGoal(null)
      } finally {
        setIsLoadingLifeGoal(false)
      }
    }

    fetchVendedor()
    fetchOportunidades(user.sk_vendedor ?? null)
    fetchLifeGoal(user.sk_vendedor ?? null)
  }, [router])

  useEffect(() => {
    if (!vendedor || hasPlayedConfettiRef.current || vendedor.posicao < 1 || vendedor.posicao > 3) {
      return
    }

    hasPlayedConfettiRef.current = true
    setConfettiActive(true)
  }, [vendedor])

  useEffect(() => {
    if (!confettiActive || !vendedor || vendedor.posicao < 1 || vendedor.posicao > 3) {
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

  useEffect(() => {
    if (!authUser?.sk_vendedor) return

    const sellerKey = String(authUser.sk_vendedor)
    const currentLifeGoalNotificationId = `seller-life-goal-${sellerKey}`
    const currentMotivationNotificationId = `seller-motivation-dashboard-${sellerKey}`
    const currentCampaignPrefixes = getSellerCampaignNotificationPrefixes(sellerKey)
    const staleIds = notifications
      .filter((notification) => {
        if (notification.id.startsWith("seller-life-goal-")) {
          return notification.id !== currentLifeGoalNotificationId
        }

        if (notification.id.startsWith("seller-motivation-dashboard-")) {
          return notification.id !== currentMotivationNotificationId
        }

        if (notification.id.startsWith("seller-challenge-") || notification.id.startsWith("seller-bonus-")) {
          return !currentCampaignPrefixes.some((prefix) => notification.id.startsWith(prefix))
        }

        return false
      })
      .map((notification) => notification.id)

    if (!staleIds.length) return

    removeNotifications(staleIds)
  }, [authUser?.sk_vendedor, notifications, removeNotifications])

  useEffect(() => {
    const challenges = dashboardCampaignSourceItems.filter(shouldShowSellerCampaignBanner)

    if (!challenges.length) return

    challenges.forEach((challenge) => {
      const isBonus = getChallengeCampaignKind(challenge) === "BONUS"
      const notificationId = getSellerCampaignNotificationId(challenge, skVendedor)
      if (startupNotificationIdsRef.current.has(notificationId)) return

      startupNotificationIdsRef.current.add(notificationId)
      addNotification({
        id: notificationId,
        title: challenge.titulo ?? (isBonus ? "Bonus mensal disponivel" : "Nova campanha disponivel"),
        message: challenge.descricao ?? (isBonus ? "Um bonus mensal foi criado para acompanhar seu resultado." : "Uma nova campanha entrou no ar para acelerar seu resultado."),
        type: isBonus ? "success" : "warning",
        actionHref: `/vendedor/desafios?highlight=${challenge.id}`,
        groupKey: notificationId,
        showToast: false,
      })
    })
  }, [addNotification, dashboardCampaignIdsKey, dashboardCampaignSourceItems, skVendedor])

  useEffect(() => {
    if (!skVendedor || isLoadingSellerChallenges || isLoadingChallengeAlert) return

    const validIds = new Set(dashboardCampaignNotificationIds)
    const prefixes = getSellerCampaignNotificationPrefixes(skVendedor)
    const staleIds = notifications
      .filter(
        (notification) =>
          prefixes.some((prefix) => notification.id.startsWith(prefix)) && !validIds.has(notification.id)
      )
      .map((notification) => notification.id)

    if (!staleIds.length) return

    removeNotifications(staleIds)
  }, [
    dashboardCampaignNotificationIdsKey,
    isLoadingChallengeAlert,
    isLoadingSellerChallenges,
    notifications,
    removeNotifications,
    skVendedor,
  ])

  useEffect(() => {
    if (!dashboardCampaignIds.length) return

    const timeout = window.setTimeout(() => {
      setDismissedCampaignBannerIds((current) => {
        const next = new Set(current)
        dashboardCampaignIds.forEach((id) => next.add(id))
        return next
      })
    }, CHALLENGE_NOTIFICATION_DURATION_MS)

    return () => window.clearTimeout(timeout)
    // The key tracks the concrete campaigns currently visible to the seller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardCampaignIdsKey])

  useEffect(() => {
    if (isLoadingLifeGoal || !lifeGoal || !authUser?.sk_vendedor) return

    const objectiveCount = lifeGoal.summary.quantidadeObjetivos ?? 0
    if (objectiveCount <= 0) return

    const notificationId = `seller-life-goal-${authUser.sk_vendedor}`
    const conquistado = lifeGoal.summary.ganhoTotal ?? 0
    const restante = Math.max(lifeGoal.summary.faltaTotal ?? 0, 0)
    const prazo =
      lifeGoal.tracking.closestDeadlineAt && !Number.isNaN(new Date(lifeGoal.tracking.closestDeadlineAt).getTime())
        ? formatDateBR(lifeGoal.tracking.closestDeadlineAt)
        : null
    const headline =
      lifeGoal.status === "CONQUISTADA"
        ? "Seu painel pessoal ja esta coberto."
        : `Faltam ${formatCurrency(restante)} para seus objetivos.`
    const subline =
      lifeGoal.status === "CONQUISTADA"
        ? `Voce transformou ${formatCurrency(conquistado)} em conquista pessoal.`
        : `Voce ja acumulou ${formatCurrency(conquistado)} para ${objectiveCount} objetivo${objectiveCount > 1 ? "s" : ""}${prazo ? ` e tem ate ${prazo}` : ""}.`

    if (!startupNotificationIdsRef.current.has(notificationId)) {
      startupNotificationIdsRef.current.add(notificationId)
      addNotification({
        id: notificationId,
        title: "Meta de Vida",
        message: `${headline} ${subline}`,
        type: "success",
        actionHref: "/vendedor/minha-meta-de-vida",
        groupKey: notificationId,
      })
    }

    if (isLifeGoalNoticeDismissed) return

    const timeout = window.setTimeout(() => {
      setIsLifeGoalNoticeDismissed(true)
    }, STARTUP_NOTIFICATION_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [addNotification, authUser?.sk_vendedor, isLifeGoalNoticeDismissed, isLoadingLifeGoal, lifeGoal])

  useEffect(() => {
    if (!vendedor || !authUser?.sk_vendedor) return

    const metaDiaAtual = vendedor.metaDia || 0
    const vendasHojeAtual = vendedor.vendasHoje || 0
    const faltaHojeAtual = Math.max(metaDiaAtual - vendasHojeAtual, 0)
    const message = buildMotivationMessage(authUser, lifeGoal, {
      context: "dashboard",
      dailyGap: faltaHojeAtual,
      averageTicket: Number(vendedor.ticketMedioDia ?? vendedor.ticketMedio ?? 0),
    })
    const notificationId = `seller-motivation-dashboard-${authUser.sk_vendedor}`

    if (!startupNotificationIdsRef.current.has(notificationId)) {
      startupNotificationIdsRef.current.add(notificationId)
      addNotification({
        id: notificationId,
        title: message.eyebrow,
        message: `${message.headline} ${message.body}`,
        type: message.tone === "amber" ? "warning" : "info",
        actionHref: message.ctaHref ?? undefined,
        groupKey: notificationId,
        showToast: false,
      })
    }

    if (isMotivationClosed) return

    const timeout = window.setTimeout(() => {
      setIsMotivationClosed(true)
    }, STARTUP_NOTIFICATION_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [addNotification, authUser, isMotivationClosed, lifeGoal, vendedor])

  function handleDismissLifeGoalNotice() {
    setIsLifeGoalNoticeDismissed(true)
  }

  function handleCloseMotivation() {
    setIsMotivationClosed(true)
  }

  function dismissCampaignBanner(id: number | string) {
    setDismissedCampaignBannerIds((current) => {
      const next = new Set(current)
      next.add(String(id))
      return next
    })
  }

  async function handleAcceptCampaignBanner(challenge: DashboardCampaignBannerItem) {
    const accepted = await acceptSellerCampaign(challenge.id)
    if (accepted) {
      dismissCampaignBanner(challenge.id)
    }
  }

  async function handleDismissCampaignBanner(challenge: DashboardCampaignBannerItem) {
    const dismissed = await dismissSellerCampaign(challenge.id)
    if (dismissed) {
      dismissCampaignBanner(challenge.id)
    }
  }


  const isDark = mounted ? resolvedTheme === "dark" : true

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
  const lifeGoalHasObjectives = (lifeGoal?.summary.quantidadeObjetivos ?? 0) > 0
  const lifeGoalPercentual = Math.min(lifeGoal?.summary.percentualTotal ?? 0, 100)
  const lifeGoalConquistado = lifeGoal?.summary.ganhoTotal ?? 0
  const lifeGoalRestante = Math.max(lifeGoal?.summary.faltaTotal ?? 0, 0)
  const lifeGoalPrazo =
    lifeGoal?.tracking.closestDeadlineAt && !Number.isNaN(new Date(lifeGoal.tracking.closestDeadlineAt).getTime())
      ? formatDateBR(lifeGoal.tracking.closestDeadlineAt)
      : null
  const lifeGoalHeadline =
    lifeGoal?.status === "CONQUISTADA"
      ? "Seu painel pessoal ja esta coberto."
      : `Faltam ${formatCurrency(lifeGoalRestante)} para seus objetivos.`
  const lifeGoalSubline =
    lifeGoal?.status === "CONQUISTADA"
      ? `Voce transformou ${formatCurrency(lifeGoalConquistado)} em conquista pessoal.`
      : `Voce ja acumulou ${formatCurrency(lifeGoalConquistado)} para ${lifeGoal?.summary.quantidadeObjetivos ?? 0} objetivo${(lifeGoal?.summary.quantidadeObjetivos ?? 0) > 1 ? "s" : ""}${lifeGoalPrazo ? ` e tem ate ${lifeGoalPrazo}` : ""}.`
  const dashboardCampaignBanners = dashboardCampaignSourceItems
    .filter(shouldShowSellerCampaignBanner)
    .filter((campaign) => !dismissedCampaignBannerIds.has(String(campaign.id)))

  const getPositionIcon = () => {
    if (variacaoPosicao > 0) return <ChevronUp className="w-5 h-5 text-emerald-300" />
    if (variacaoPosicao < 0) return <ChevronDown className="w-5 h-5 text-red-400" />
    return <Minus className="w-4 h-4 text-muted-foreground" />
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
  const dashboardMotivation = buildMotivationMessage(authUser, lifeGoal, {
    context: "dashboard",
    dailyGap: faltaHoje,
    averageTicket: Number(vendedor.ticketMedioDia ?? vendedor.ticketMedio ?? 0),
  })
  const rankingMotivation = buildMotivationMessage(authUser, lifeGoal, {
    context: "ranking",
    rankPosition: vendedor.posicao,
    totalRanked: vendedor.totalVendedores ?? 0,
    dailyGap: faltaHoje,
    averageTicket: Number(vendedor.ticketMedioDia ?? vendedor.ticketMedio ?? 0),
  })
  const clientesMesTotal = Number(vendedor.clientesMes ?? vendedor.clientesAtendidos ?? 0)
  const ticketMedioDia = Number(vendedor.ticketMedioDia ?? 0)
  const oportunidadesMicrocopy =
    orcamentosAbertos > 0
      ? `${orcamentosAbertos} oportunidade${orcamentosAbertos > 1 ? "s" : ""} te esperando`
      : "Nenhuma oportunidade crítica agora"
  const novosDesafiosCount = dashboardCampaignSourceItems.filter(shouldShowSellerCampaignBanner).length
    || desafioAlert?.items?.length
    || (desafioAlert?.hasNewChallenge ? 1 : 0)
  const sellerDashboardCards: CardDashboardConfig[] = [
    {
      title: "Minha Jornada",
      description: "Veja seu desempenho hoje e o que precisa fazer para bater sua meta.",
      icon: TrendingUp,
      gradient: dashboardCardThemes.sky,
      gradientLight: dashboardCardThemesLight.sky,
      actionLabel: activeView === "jornada" ? "Fechar painel" : "Abrir painel",
      badge: percentualDia >= 100 ? "DESTAQUE" : "PRIORIDADE",
      tag: "ACAO PRINCIPAL",
      microcopy: `Meta do dia: ${percentualDia.toFixed(0)}% concluida`,
      active: activeView === "jornada",
      ariaExpanded: activeView === "jornada",
      onClick: () => {
        setActiveView((prev) => {
          if (prev === "jornada") {
            return null
          }
          setJourneyAnimationCycle((cycle) => cycle + 1)
          return "jornada"
        })
      },
    },
    {
      title: "Area de Ataque",
      description: "Clientes e oportunidades que voce precisa agir agora.",
      icon: Swords,
      gradient: dashboardCardThemes.emerald,
      gradientLight: dashboardCardThemesLight.emerald,
      actionLabel: "Ver oportunidades",
      badge: orcamentosAbertos > 0 ? "PRIORIDADE" : undefined,
      tag: "ACAO IMEDIATA",
      microcopy: oportunidadesMicrocopy,
      onClick: () => router.push("/area-ataque"),
    },
    {
      title: "Desafios",
      description: "Acompanhe campanhas e ganhe bonus por performance.",
      icon: Zap,
      gradient: dashboardCardThemes.amber,
      gradientLight: dashboardCardThemesLight.amber,
      actionLabel: "Ver desafios",
      badge: novosDesafiosCount > 0 ? "NOVO" : undefined,
      tag: "PERFORMANCE",
      microcopy:
        novosDesafiosCount > 1
          ? `${novosDesafiosCount} campanhas novas`
          : novosDesafiosCount === 1
            ? "Nova campanha liberada hoje"
            : "Campanhas e bonus em andamento",
      onClick: () => router.push("/vendedor/desafios"),
    },
    {
      title: "Investigar Cliente",
      description: "Descubra o historico e a proxima melhor oferta.",
      icon: Search,
      gradient: dashboardCardThemes.cyan,
      gradientLight: dashboardCardThemesLight.cyan,
      actionLabel: "Buscar cliente",
      tag: "ANALISE",
      microcopy:
        ticketMedioDia > 0
          ? `Ticket do dia: ${formatCurrency(ticketMedioDia)}`
          : `${Math.max(clientesMesTotal, 0)} clientes atendidos no mes`,
      onClick: () => router.push("/investigar-cliente"),
    },
    {
      title: "Ativacao de Clientes",
      description: "Recupere clientes e aumente suas vendas hoje.",
      icon: MessageCircle,
      gradient: dashboardCardThemes.rose,
      gradientLight: dashboardCardThemesLight.rose,
      actionLabel: "Reativar clientes",
      badge: "DESTAQUE",
      highlight: true,
      tag: "RETOMADA",
      microcopy:
        clientesMesTotal > 0
          ? `${clientesMesTotal} clientes movimentados no mes`
          : "Carteira pronta para reativar hoje",
      onClick: () => router.push("/ativacao-clientes"),
    },
  ]

  function closeFeedback() {
    setIsFeedbackOpen(false)
    setFeedbackStatus("idle")
    setFeedbackTexto("")
  }

  async function handleEnviarFeedback() {
    if (!feedbackTexto.trim()) return
    setFeedbackStatus("sending")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sk_vendedor: skVendedor,
          nome: authUser?.nome ?? vendedor?.nome ?? null,
          feedback: feedbackTexto.trim(),
          tipo_usuario: "VENDEDOR",
        }),
      })
      if (!res.ok) throw new Error()
      setFeedbackStatus("success")
      setFeedbackTexto("")
      window.setTimeout(() => closeFeedback(), 2500)
    } catch {
      setFeedbackStatus("error")
    }
  }

  return (
    <div className={`relative min-h-screen overflow-x-hidden ${isDark ? "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(245,158,11,0.08),transparent_22%),linear-gradient(135deg,rgba(8,16,29,1),rgba(9,14,24,1)_45%,rgba(13,22,36,1))]" : "bg-[linear-gradient(160deg,#f8fafc_0%,#f0fdf4_40%,#f8fafc_100%)]"}`}>
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

      <main className="relative z-10 mx-auto w-full max-w-[1380px] space-y-10 px-4 py-10 sm:px-6 xl:px-8">
        <div className="space-y-4">
          {vendedorLoadError ? (
            <div className="rounded-[22px] border border-amber-300/18 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {vendedorLoadError}
            </div>
          ) : null}

          {!isLoadingLifeGoal && lifeGoalHasObjectives && !isLifeGoalNoticeDismissed ? (
            <section className={`relative rounded-[22px] px-4 py-3 sm:px-5 ${isDark ? "border border-emerald-300/14 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_26%),linear-gradient(135deg,rgba(5,46,34,0.82),rgba(8,20,32,0.94),rgba(7,24,18,0.88))] shadow-[0_14px_34px_rgba(0,0,0,0.18)]" : "border border-emerald-200/60 bg-[linear-gradient(135deg,rgba(240,253,244,0.97),rgba(255,255,255,0.98))] shadow-[0_6px_20px_rgba(0,0,0,0.06)]"}`}>
              <button
                type="button"
                onClick={handleDismissLifeGoalNotice}
                className={`absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${isDark ? "border border-white/10 bg-white/8 text-white/68 hover:bg-white/14 hover:text-white" : "border border-slate-200/60 bg-white/80 text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                aria-label="Fechar notificacao da Meta de Vida"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${isDark ? "border-emerald-300/16 bg-emerald-400/8 text-emerald-100/84" : "border-emerald-200/60 bg-emerald-50 text-emerald-700"}`}>
                    <Target className="h-3 w-3" />
                    Meta de Vida
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <p className={`text-[15px] font-bold sm:text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                      {lifeGoalHeadline}
                    </p>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${isDark ? "border-white/10 bg-white/8 text-emerald-100/72" : "border-emerald-200/60 bg-emerald-50 text-emerald-600"}`}>
                      {lifeGoalPercentual.toFixed(1)}% conquistado
                    </span>
                  </div>

                  <p className={`mt-1.5 text-[13px] leading-5 ${isDark ? "text-white/64" : "text-slate-500"}`}>
                    {lifeGoalSubline}
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:min-w-[220px]">
                  <div className="min-w-0 flex-1">
                    <div className={`mb-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${isDark ? "text-white/46" : "text-slate-400"}`}>
                      <span>Progresso</span>
                      <span>{formatCurrency(lifeGoalConquistado)}</span>
                    </div>
                    <div className={`h-2 overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-slate-200/60"}`}>
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#f59e0b)] transition-[width] duration-700 ease-out"
                        style={{ width: `${lifeGoalPercentual}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push("/vendedor/minha-meta-de-vida")}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${isDark ? "border-emerald-300/16 bg-emerald-400/10 text-emerald-50 hover:bg-emerald-400/16" : "border-emerald-200/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                  >
                    Ver painel
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {dashboardCampaignBanners.length ? (
            <section className={`overflow-hidden rounded-[24px] ${isDark ? "border border-white/8 bg-[#07111f] shadow-[0_16px_48px_rgba(2,8,23,0.16)]" : "border border-cyan-200/40 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.06)]"}`}>
              <div className={`border-b px-5 py-4 ${isDark ? "border-white/8" : "border-cyan-100/60"}`}>
                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-cyan-300" : "text-cyan-600"}`}>
                  DESAFIOS ATIVOS
                </h2>
                <p className={`mt-2 text-sm ${isDark ? "text-white/60" : "text-slate-500"}`}>
                  Campanhas disponiveis para aumentar sua premiacao hoje.
                </p>
              </div>

              <div className={`divide-y px-2 py-1 sm:px-3 ${isDark ? "divide-white/8" : "divide-cyan-100/60"}`}>
                {dashboardCampaignBanners.map((campaign) => {
                  const isAvailable = isDashboardCampaignAvailable(campaign)

                  return (
                    <ChallengeNotificationBanner
                      key={campaign.id}
                      campaign={campaign}
                      href={`/vendedor/desafios?highlight=${campaign.id}`}
                      onAccept={isAvailable ? () => handleAcceptCampaignBanner(campaign) : undefined}
                      loading={isActingSellerCampaign}
                      compact
                    />
                  )
                })}
              </div>
            </section>
          ) : null}

          {!isMotivationClosed ? (
            <MotivationSpotlight
              message={dashboardMotivation}
              compact
              onClose={handleCloseMotivation}
              closeLabel="Fechar banner de motivacao do vendedor"
            />
          ) : null}
        </div>

        {metaHerdada === 1 && (
          <div className={`flex items-start gap-3 p-4 mb-6 rounded-xl border ${isDark ? "border-amber-600/50 bg-amber-900/40 text-amber-200" : "border-amber-300/50 bg-amber-50 text-amber-800"}`}>
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span className="text-sm">
              Meta utilizada do mês anterior. A meta do mês atual ainda não foi cadastrada no ADM.
            </span>
          </div>
        )}

        {dataReferenciaValida ? (
          <div className="flex justify-end">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground ${isDark ? "border-white/10 bg-white/5" : "border-slate-200/60 bg-white/80"}`}>
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
        <section className={`relative overflow-hidden rounded-[30px] p-6 backdrop-blur-sm ${isDark ? "border border-emerald-400/16 bg-[linear-gradient(140deg,rgba(6,19,14,0.94),rgba(9,16,26,0.94),rgba(7,26,18,0.9))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]" : "border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"}`}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className={`absolute left-0 top-0 h-36 w-36 rounded-full blur-3xl ${isDark ? "bg-emerald-400/12" : "bg-emerald-300/20"}`} />
            <div className={`absolute bottom-0 right-0 h-40 w-40 rounded-full blur-3xl ${isDark ? "bg-lime-400/8" : "bg-lime-300/15"}`} />
          </div>
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${isDark ? "border-emerald-400/18 bg-emerald-500/8 text-emerald-100/80" : "border-emerald-200/60 bg-emerald-50 text-emerald-700"}`}>
                  Painel do vendedor
                </div>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-5">
                  <h1 className={`text-3xl font-extrabold tracking-tight ${isDark ? "" : "text-slate-900"}`}>
                    Olá, <span className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-lime-500 bg-clip-text text-transparent">{vendedor.nome.split(" ")[0]}</span>
                  </h1>
                  <div className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-2 ${isDark ? "border-emerald-400/18 bg-emerald-500/8" : "border-emerald-200/50 bg-white/80"}`}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-lime-400 shadow-[0_8px_18px_rgba(34,197,94,0.22)]">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-white/45" : "text-slate-400"}`}>
                        Ranking atual
                      </p>
                      <p className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                        {vendedor.posicao > 0 ? vendedor.posicao : "--"}{" "}
                        <span className={`text-sm font-semibold ${isDark ? "text-white/55" : "text-slate-400"}`}>
                          / {vendedor.totalVendedores && vendedor.totalVendedores > 0 ? vendedor.totalVendedores : "--"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`mt-3 flex items-start gap-3 text-sm ${isDark ? "text-emerald-100/85" : "text-emerald-700"}`}>
                  <div className="mt-0.5">{getPositionIcon()}</div>
                  <div>
                    <p className={`font-semibold ${isDark ? "text-white/92" : "text-slate-800"}`}>{rankingMotivation.headline}</p>
                    <p className={`mt-1 text-sm ${isDark ? "text-emerald-100/72" : "text-slate-500"}`}>{rankingMotivation.body}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {sellerDashboardCards.map((card) => (
                <CardDashboard
                  key={card.title}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  gradient={card.gradient}
                  gradientLight={card.gradientLight}
                  actionLabel={card.actionLabel}
                  badge={card.badge}
                  highlight={card.highlight}
                  tag={card.tag}
                  microcopy={card.microcopy}
                  active={card.active}
                  ariaExpanded={card.ariaExpanded}
                  onClick={card.onClick}
                />
              ))}
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
            <section className={`rounded-3xl border p-8 shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition-transform duration-300 hover:-translate-y-1 ${isDark ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(12,18,29,0.92))]" : "border-slate-200 bg-white"}`}>
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

          <div className={`relative h-5 overflow-hidden rounded-full ${isDark ? "bg-white/6" : "bg-slate-200/80"}`}>
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
            <section className={`mt-6 rounded-2xl border px-6 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.08)] ${isDark ? "border-white/10 bg-[linear-gradient(135deg,rgba(30,41,59,0.62),rgba(15,23,42,0.82),rgba(14,116,144,0.12))]" : "border-slate-100 bg-slate-50"}`}>
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
            <section className={`rounded-2xl border p-6 transition-transform duration-300 hover:-translate-y-1 ${isDark ? "border-amber-400/20 bg-[linear-gradient(135deg,rgba(120,53,15,0.38),rgba(88,28,12,0.24),rgba(15,23,42,0.92))] shadow-[0_10px_28px_rgba(120,53,15,0.18)]" : "border-amber-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"}`}>
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

              <div className={`h-3 overflow-hidden rounded-full ${isDark ? "bg-white/8" : "bg-slate-200/80"}`}>
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
              <section className={`mt-6 rounded-2xl border px-6 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.06)] ${isDark ? "border-white/10 bg-[linear-gradient(135deg,rgba(51,65,85,0.54),rgba(30,41,59,0.72),rgba(120,53,15,0.12))]" : "border-amber-100 bg-amber-50/70"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? "bg-white/8" : "bg-emerald-100"}`}>
                      <Users className={`h-5 w-5 ${isDark ? "text-emerald-200" : "text-emerald-600"}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clientes atendidos hoje</p>
                      <p className="text-lg font-bold text-foreground">
                        {vendedor.clientesDia ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className={`hidden h-8 w-px sm:block ${isDark ? "bg-white/10" : "bg-amber-200/60"}`} />

                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? "bg-white/8" : "bg-amber-100"}`}>
                      <DollarSign className={`h-5 w-5 ${isDark ? "text-amber-300" : "text-amber-600"}`} />
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
            <section className={`rounded-2xl border px-6 py-4 transition-transform duration-300 hover:-translate-y-1 ${isDark ? "border-emerald-400/18 bg-[linear-gradient(135deg,rgba(8,31,20,0.62),rgba(15,23,42,0.9),rgba(34,197,94,0.08))] shadow-[0_8px_24px_rgba(16,185,129,0.14)]" : "border-emerald-200 bg-emerald-50/70 shadow-[0_2px_8px_rgba(34,197,94,0.07)]"}`}>
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
            <section className={`rounded-3xl border p-8 transition-transform duration-300 hover:-translate-y-1 ${isDark ? "border-amber-400/20 bg-[linear-gradient(140deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92),rgba(120,53,15,0.18))] shadow-[0_10px_30px_rgba(245,158,11,0.12)]" : "border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"}`}>
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
            <section className={`rounded-3xl border p-6 shadow-[0_10px_30px_rgba(0,0,0,0.1)] ${isDark ? "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(11,18,32,0.94))]" : "border-slate-200 bg-white"}`}>
          <button
            type="button"
            onClick={() => setIsTabelaOportunidadesOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${isDark ? "border-white/10 bg-white/5 hover:bg-white/8" : "border-slate-200/60 bg-slate-50/80 hover:bg-slate-100/60"}`}
          >
            <div className="flex items-center gap-3">
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Tabela de Oportunidades</h3>
              {!isLoadingOportunidades && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {listaOrcamentos.length} registros
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-200" : "text-slate-500"}`}>
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
                      <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${isDark ? "bg-[#0b1220]" : "bg-slate-100"}`}>
                        <Calendar className={`h-4 w-4 ${isDark ? "text-emerald-200" : "text-emerald-500"}`} />
                        <input
                          type="date"
                          value={dataInicialFiltro}
                          onChange={(e) => setDataInicialFiltro(e.target.value)}
                          min={dataMinimaInput || undefined}
                          max={dataMaximaInput || undefined}
                          className={`w-full bg-transparent text-sm outline-none ${isDark ? "text-white [color-scheme:dark]" : "text-slate-700 [color-scheme:light]"}`}
                          style={{ colorScheme: isDark ? "dark" : "light" }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Data final
                      </label>
                      <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${isDark ? "bg-[#0b1220]" : "bg-slate-100"}`}>
                        <Calendar className={`h-4 w-4 ${isDark ? "text-emerald-200" : "text-emerald-500"}`} />
                        <input
                          type="date"
                          value={dataFinalFiltro}
                          onChange={(e) => setDataFinalFiltro(e.target.value)}
                          min={dataMinimaInput || undefined}
                          max={dataMaximaInput || undefined}
                          className={`w-full bg-transparent text-sm outline-none ${isDark ? "text-white [color-scheme:dark]" : "text-slate-700 [color-scheme:light]"}`}
                          style={{ colorScheme: isDark ? "dark" : "light" }}
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
                            <ArrowUpDown className={`h-4 w-4 ${isDark ? "text-white/45" : "text-slate-400"}`} />
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
                            <ArrowUpDown className={`h-4 w-4 ${isDark ? "text-white/45" : "text-slate-400"}`} />
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
        <footer className={`flex justify-between border-t pt-6 text-sm text-muted-foreground ${isDark ? "border-white/10" : "border-slate-200/60"}`}>
          <span>Atualizado agora</span>
          <button onClick={() => window.location.reload()} className="text-primary">
            Atualizar
          </button>
        </footer>
      </main>

      {/* FEEDBACK FLUTUANTE */}
      {isFeedbackOpen && (
        <div
          className={`fixed inset-0 z-40 backdrop-blur-sm ${isDark ? "bg-black/40" : "bg-black/20"}`}
          onClick={closeFeedback}
        />
      )}
      {isFeedbackOpen && (
        <div className={`fixed bottom-24 right-6 z-50 w-80 rounded-2xl border p-5 shadow-2xl backdrop-blur-md ${isDark ? "border-white/10 bg-zinc-900/95" : "border-slate-200/60 bg-white/98"}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Sugestão de melhoria</h3>
              <p className={`text-xs ${isDark ? "text-white/45" : "text-slate-400"}`}>Sua opinião é muito importante!</p>
            </div>
            <button
              type="button"
              onClick={closeFeedback}
              className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-white/45 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {feedbackStatus === "success" ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Zap className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-emerald-300">Feedback enviado!</p>
              <p className={`text-xs ${isDark ? "text-white/45" : "text-slate-400"}`}>Obrigado pela sugestão 🙏</p>
            </div>
          ) : (
            <>
              <textarea
                value={feedbackTexto}
                onChange={(e) => setFeedbackTexto(e.target.value)}
                placeholder="Conte o que poderia ser melhor no sistema..."
                rows={4}
                className={`w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${isDark ? "border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:ring-emerald-500/30" : "border-slate-200/60 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-emerald-400/60 focus:ring-emerald-400/20"}`}
              />
              {feedbackStatus === "error" && (
                <p className="mt-1.5 text-xs text-red-400">Erro ao enviar. Tente novamente.</p>
              )}
              <button
                type="button"
                onClick={() => void handleEnviarFeedback()}
                disabled={feedbackStatus === "sending" || !feedbackTexto.trim()}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
              >
                {feedbackStatus === "sending" ? "Enviando..." : "Enviar sugestão"}
              </button>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsFeedbackOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all hover:scale-105 hover:bg-emerald-500 active:scale-95"
      >
        <MessageCircle className="h-4 w-4" />
        Feedback
      </button>
    </div>
  )
}
