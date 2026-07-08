"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Trophy, Swords, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { ChallengeDetailsPanel } from "@/components/challenges/ChallengeDetailsPanel"
import { ChallengeExpandableCard } from "@/components/challenges/ChallengeExpandableCard"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { useNotifications } from "@/components/notifications/NotificationContext"
import { ChallengeEmptyState } from "@/components/challenges/ChallengeEmptyState"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSellerChallengeAlert, useSellerChallenges } from "@/hooks/useChallenges"
import {
  formatCurrencyBRL,
  getChallengeCampaignKind,
  getChallengeLifecycleStatus,
  getSellerCampaignNotificationId,
  getSellerCampaignNotificationPrefixes,
  isChallengeAvailableForSeller,
  isChallengeClosedForSeller,
  isChallengeInProgressForSeller,
  isClosedChallengeStatus,
  shouldShowSellerCampaignBanner,
  type Challenge,
  type SellerChallengeAlertItem,
} from "@/lib/challenges"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

type SellerTab = "andamento" | "disponiveis" | "encerrados"
type SellerAlertNotificationItem = SellerChallengeAlertItem & Pick<Partial<Challenge>, "metas" | "participant">

function VendedorDesafiosContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { notifications, removeNotifications } = useNotifications()
  const processedHighlightRef = useRef<string | null>(null)
  const isRemoving = useRef(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [activeTab, setActiveTab] = useState<SellerTab>("andamento")
  const [openingChallengeId, setOpeningChallengeId] = useState<string | null>(null)
  const {
    data,
    selectedChallenge,
    setSelectedChallenge,
    loading,
    acting,
    error,
    refresh,
    openDetails,
    acceptChallenge,
    dismissChallenge,
  } = useSellerChallenges(authUser?.sk_vendedor ?? null)
  const {
    alert,
    loading: alertLoading,
    refresh: refreshAlert,
  } = useSellerChallengeAlert(authUser?.sk_vendedor ?? null)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      router.push("/login")
      return
    }

    const isSeller = user.role === "VENDEDOR"
    const isSystemManagerViewingSeller =
      user.role === "GERENTE_SISTEMAS" &&
      user.gerente_sistemas_view === "VENDEDOR" &&
      !!user.empresa_id &&
      !!user.sk_vendedor

    if (!isSeller && !isSystemManagerViewingSeller) {
      router.push(user.role === "GERENTE_SISTEMAS" ? "/gerente-sistemas" : "/login")
      return
    }

    setStoredUser(user)
    setAuthUser(user)
  }, [router])

  function focusChallengeCard(challengeId: number | string) {
    window.requestAnimationFrame(() => {
      document.getElementById(getChallengeAnchorId(challengeId))?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const highlight = searchParams.get("highlight")
  const searchParamsString = searchParams.toString()
  const allItems = data?.items ?? []

  const alertItems = useMemo<SellerAlertNotificationItem[]>(() => {
    const sourceItems = alert?.items?.length ? alert.items : alert?.challenge ? [alert.challenge] : []
    if (!sourceItems.length) return []

    const sellerChallengesById = new Map(allItems.map((item) => [String(item.id), item]))

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
  }, [alert, allItems])

  const sellerCampaignNotificationIds = useMemo(() => {
    if (!authUser?.sk_vendedor) return []

    const seen = new Set<string>()

    return [...allItems, ...alertItems]
      .filter(shouldShowSellerCampaignBanner)
      .map((challenge) => getSellerCampaignNotificationId(challenge, authUser.sk_vendedor))
      .filter((id) => {
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
  }, [alertItems, allItems, authUser?.sk_vendedor])
  const sellerCampaignNotificationIdsKey = sellerCampaignNotificationIds.join("|")

  const inProgressChallenges = useMemo(
    () =>
      [...allItems]
        .filter((item) => isChallengeInProgressForSeller(item))
        .sort((left, right) => getSellerStatusWeight(right.participant?.statusParticipacao) - getSellerStatusWeight(left.participant?.statusParticipacao)),
    [allItems]
  )

  const availableChallengesRaw = useMemo(() => [...allItems].filter((item) => isChallengeAvailableForSeller(item)), [allItems])

  const encerradosChallenges = useMemo(
    () =>
      [...allItems]
        .filter((item) => isChallengeClosedForSeller(item))
        .sort((left, right) => getSellerStatusWeight(right.participant?.statusParticipacao) - getSellerStatusWeight(left.participant?.statusParticipacao)),
    [allItems]
  )

  const acceptedUnlockedReward = useMemo(
    () => inProgressChallenges.reduce((sum, challenge) => sum + Number(challenge.participant?.premioTotalLiberado ?? 0), 0),
    [inProgressChallenges]
  )

  const totalAcumulatedReward = useMemo(
    () => allItems.reduce((sum, challenge) => sum + Number(challenge.participant?.premioTotalLiberado ?? 0), 0),
    [allItems]
  )

  const completedChallengesCount = useMemo(
    () => allItems.filter((item) => String(item.participant?.statusParticipacao ?? "").toUpperCase() === "CONCLUIDO").length,
    [allItems]
  )

  const availablePotentialReward = useMemo(
    () => availableChallengesRaw.reduce((sum, challenge) => sum + challenge.metas.reduce((metaSum, meta) => metaSum + Number(meta.recompensaValor ?? 0), 0), 0),
    [availableChallengesRaw]
  )

  useEffect(() => {
    if (!highlight) {
      processedHighlightRef.current = null
      return
    }
    if (!authUser?.sk_vendedor || processedHighlightRef.current === highlight) return

    processedHighlightRef.current = highlight

    const params = new URLSearchParams(searchParamsString)
    params.delete("highlight")
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname

    void openDetails(highlight).then((detail) => {
      if (detail) {
        setSelectedChallenge(detail)
        setActiveTab(resolveTabForChallenge(detail))
        focusChallengeCard(detail.id)
      }

      void refreshAlert()
      router.replace(nextUrl, { scroll: false })
    })
  }, [authUser?.sk_vendedor, highlight, openDetails, pathname, refreshAlert, router, searchParamsString, setSelectedChallenge])

  useEffect(() => {
    if (!authUser?.sk_vendedor || loading || alertLoading) return

    const validIds = new Set(sellerCampaignNotificationIds)
    const prefixes = getSellerCampaignNotificationPrefixes(authUser.sk_vendedor)
    const staleIds = notifications
      .filter(
        (notification) =>
          prefixes.some((prefix) => notification.id.startsWith(prefix)) && !validIds.has(notification.id)
      )
      .map((notification) => notification.id)

    if (isRemoving.current || !staleIds.length) return

    isRemoving.current = true
    try {
      removeNotifications(staleIds)
    } finally {
      isRemoving.current = false
    }
  }, [
    alertLoading,
    authUser?.sk_vendedor,
    loading,
    notifications,
    removeNotifications,
    sellerCampaignNotificationIdsKey,
  ])

  useEffect(() => {
    if (loading || selectedChallenge || activeTab !== "andamento") return
    if (!inProgressChallenges.length && availableChallengesRaw.length) {
      setActiveTab("disponiveis")
    }
  }, [inProgressChallenges.length, activeTab, availableChallengesRaw.length, loading, selectedChallenge])

  function showFeedbackToast(kind: "success" | "error", message: string) {
    const isSuccess = kind === "success"
    const Icon = isSuccess ? CheckCircle2 : AlertCircle

    toast.custom(
      () => (
        <div
          className={`animate-in slide-in-from-top-2 duration-300 flex items-start gap-3 rounded-[22px] border px-4 py-3 shadow-[0_18px_50px_rgba(2,6,23,0.32)] ${
            isSuccess ? "border-emerald-300/20 bg-[#071812] text-emerald-50" : "border-rose-300/20 bg-[#170b10] text-rose-50"
          }`}
        >
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${isSuccess ? "text-emerald-300" : "text-rose-300"}`} />
          <p className="text-sm font-semibold leading-6">{message}</p>
        </div>
      ),
      {
        id: "seller-challenges-feedback",
        duration: 2500,
      }
    )
  }

  async function handleOpen(challenge: Challenge) {
    if (String(selectedChallenge?.id ?? "") === String(challenge.id)) {
      setSelectedChallenge(null)
      return
    }

    setOpeningChallengeId(String(challenge.id))
    let detail: Challenge | null = null

    try {
      detail = await openDetails(challenge.id)
    } finally {
      setOpeningChallengeId((current) => (current === String(challenge.id) ? null : current))
    }

    if (!detail) {
      await refreshAlert()
      return
    }

    setSelectedChallenge(detail)
    setActiveTab(resolveTabForChallenge(detail))
    focusChallengeCard(detail.id)
    void refreshAlert()
  }

  async function handleAccept(challenge: Challenge) {
    const accepted = await acceptChallenge(challenge.id)
    if (!accepted) return

    showFeedbackToast("success", `${getCampaignKindDisplayLabel(accepted)} aceito: ${getChallengeDisplayTitle(accepted)}`)
    setSelectedChallenge(accepted)
    setActiveTab("andamento")
    focusChallengeCard(accepted.id)
    await refreshAlert()
  }

  async function handleDismiss(challenge: Challenge) {
    const dismissed = await dismissChallenge(challenge.id)
    if (!dismissed) return

    showFeedbackToast("error", `${getCampaignKindDisplayLabel(challenge)} recusado: ${getChallengeDisplayTitle(challenge)}`)
    await refreshAlert()
  }

  const activeChallengesCount = inProgressChallenges.length + availableChallengesRaw.length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppShellNav user={authUser} />
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-8 sm:px-6">
        {error ? (
          <div className="rounded-[20px] border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {/* Hero */}
        <section className="rounded-[28px] border border-white/[0.08] bg-[#0d1421] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                Painel do Vendedor
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Seus desafios
              </h1>
              {inProgressChallenges.length > 0 ? (
                <p className="mt-2 text-sm text-white/45">
                  {formatCurrencyBRL(acceptedUnlockedReward)} liberados nas campanhas em andamento.
                </p>
              ) : availablePotentialReward > 0 ? (
                <p className="mt-2 text-sm text-white/45">
                  {formatCurrencyBRL(availablePotentialReward)} em prêmios esperando sua decisão.
                </p>
              ) : null}
            </div>

            <div className="flex gap-3">
              <QuickStat
                label="Ativos"
                value={activeChallengesCount}
                icon={<Swords className="h-3.5 w-3.5" />}
                color="cyan"
                loading={loading}
              />
              <QuickStat
                label="Prêmio acumulado"
                value={formatCurrencyBRL(totalAcumulatedReward)}
                icon={<Trophy className="h-3.5 w-3.5" />}
                color="amber"
                loading={loading}
              />
              <QuickStat
                label="Concluídos"
                value={completedChallengesCount}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                color="emerald"
                loading={loading}
              />
            </div>
          </div>
        </section>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SellerTab)} className="space-y-5">
          <TabsList className="h-auto w-full justify-start rounded-[20px] border border-white/[0.08] bg-[#0d1421] p-1.5 sm:w-auto">
            <TabsTrigger
              value="andamento"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold text-white/45 transition-colors data-[state=active]:bg-white/[0.09] data-[state=active]:text-white data-[state=active]:shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
            >
              Em andamento
              {inProgressChallenges.length > 0 ? (
                <span className="ml-2 rounded-full bg-cyan-400/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
                  {inProgressChallenges.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="disponiveis"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold text-white/45 transition-colors data-[state=active]:bg-white/[0.09] data-[state=active]:text-white data-[state=active]:shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
            >
              Disponíveis
              {availableChallengesRaw.length > 0 ? (
                <span className="ml-2 rounded-full bg-blue-400/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-200">
                  {availableChallengesRaw.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="encerrados"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold text-white/45 transition-colors data-[state=active]:bg-white/[0.09] data-[state=active]:text-white data-[state=active]:shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
            >
              Encerrados
              {encerradosChallenges.length > 0 ? (
                <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/50">
                  {encerradosChallenges.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="andamento" className="space-y-4">
            <p className="text-[13px] text-white/42">Desafios que você já aceitou e está participando.</p>
            <ChallengeCardList
              items={inProgressChallenges}
              loading={loading}
              selectedChallenge={selectedChallenge}
              openingChallengeId={openingChallengeId}
              emptyTitle="Nenhuma campanha em andamento"
              emptyDescription="Aceite um desafio disponível para começar a acompanhar seu progresso e recompensas."
              onToggle={handleOpen}
              onClose={() => setSelectedChallenge(null)}
            />
          </TabsContent>

          <TabsContent value="disponiveis" className="space-y-4">
            <p className="text-[13px] text-white/42">Novos desafios aguardando seu aceite.</p>
            <ChallengeCardList
              items={availableChallengesRaw}
              loading={loading}
              selectedChallenge={selectedChallenge}
              openingChallengeId={openingChallengeId}
              emptyTitle="Nenhuma campanha disponível"
              emptyDescription="Quando uma nova campanha for lançada para você, ela aparece aqui para aceite."
              onToggle={handleOpen}
              onClose={() => setSelectedChallenge(null)}
              onAccept={acting ? undefined : handleAccept}
              onDismiss={acting ? undefined : handleDismiss}
            />
          </TabsContent>

          <TabsContent value="encerrados" className="space-y-4">
            <p className="text-[13px] text-white/42">Histórico de desafios finalizados.</p>
            <ChallengeCardList
              items={encerradosChallenges}
              loading={loading}
              selectedChallenge={selectedChallenge}
              openingChallengeId={openingChallengeId}
              emptyTitle="Nenhuma campanha encerrada"
              emptyDescription="O histórico de campanhas que você concluiu ou que expiraram aparece aqui."
              onToggle={handleOpen}
              onClose={() => setSelectedChallenge(null)}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function VendedorDesafiosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(145deg,#04070f,#0b1220_45%,#08111b)] px-6 text-sm text-white/70">
          Carregando desafios do vendedor...
        </div>
      }
    >
      <VendedorDesafiosContent />
    </Suspense>
  )
}

function getChallengeAnchorId(challengeId: number | string) {
  return `challenge-card-${challengeId}`
}

const quickStatColorMap = {
  cyan: { border: "border-cyan-400/15", bg: "bg-cyan-400/[0.07]", label: "text-cyan-300/70", icon: "text-cyan-300/70" },
  emerald: { border: "border-emerald-400/15", bg: "bg-emerald-400/[0.07]", label: "text-emerald-300/70", icon: "text-emerald-300/70" },
  amber: { border: "border-amber-400/15", bg: "bg-amber-400/[0.07]", label: "text-amber-300/70", icon: "text-amber-300/70" },
}

function QuickStat({
  label,
  value,
  icon,
  color,
  loading = false,
}: {
  label: string
  value: string | number
  icon: ReactNode
  color: "cyan" | "emerald" | "amber"
  loading?: boolean
}) {
  const c = quickStatColorMap[color]
  return (
    <div className={`min-w-[100px] rounded-[18px] border px-4 py-3.5 ${c.border} ${c.bg}`}>
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${c.label}`}>
        {icon}
        {label}
      </div>
      {loading ? (
        <div className="mt-2 h-6 w-12 animate-pulse rounded-full bg-white/8" />
      ) : (
        <p className="mt-2 text-lg font-black text-white">{value}</p>
      )}
    </div>
  )
}

function ChallengeCardList({
  items,
  loading,
  selectedChallenge,
  openingChallengeId,
  emptyTitle,
  emptyDescription,
  onToggle,
  onClose,
  onAccept,
  onDismiss,
  detailEyebrow = "Detalhe do desafio",
  defaultDetailTitle = "Desafio",
}: {
  items: Challenge[]
  loading: boolean
  selectedChallenge: Challenge | null
  openingChallengeId: string | null
  emptyTitle: string
  emptyDescription: string
  onToggle: (c: Challenge) => void
  onClose: () => void
  onAccept?: (c: Challenge) => void
  onDismiss?: (c: Challenge) => void
  detailEyebrow?: string
  defaultDetailTitle?: string
}) {
  if (loading) {
    return <LoadingStack />
  }

  if (!items.length) {
    return <ChallengeEmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-4">
      {items.map((challenge) => {
        const isOpen = String(selectedChallenge?.id ?? "") === String(challenge.id)
        const detailChallenge = isOpen ? selectedChallenge : null

        return (
          <ChallengeExpandableCard
            key={challenge.id}
            anchorId={getChallengeAnchorId(challenge.id)}
            challenge={challenge}
            mode="seller"
            isOpen={isOpen}
            isLoading={openingChallengeId === String(challenge.id)}
            detailEyebrow={detailEyebrow}
            detailTitle={detailChallenge?.titulo ?? challenge.titulo ?? defaultDetailTitle}
            detailContent={detailChallenge ? <ChallengeDetailsPanel challenge={detailChallenge} /> : null}
            onToggle={onToggle}
            onClose={onClose}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        )
      })}
    </div>
  )
}

function LoadingStack() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="h-[280px] animate-pulse rounded-[30px] border border-white/8 bg-white/5" />
      ))}
    </div>
  )
}

function getSellerStatusWeight(status: Challenge["participant"] extends { statusParticipacao: infer T } ? T : string | undefined) {
  const weights: Record<string, number> = {
    EM_ANDAMENTO: 4,
    ACEITO: 3,
    CONCLUIDO: 2,
    DISPONIVEL: 1,
  }

  return weights[String(status ?? "").toUpperCase()] ?? 0
}

function getCampaignKindDisplayLabel(challenge: Pick<Challenge, "exigeAceite">) {
  return getChallengeCampaignKind(challenge) === "BONUS" ? "Bônus" : "Desafio"
}

function getChallengeDisplayTitle(challenge: Pick<Challenge, "titulo">) {
  return challenge.titulo?.trim() || "Campanha sem título"
}

function resolveTabForChallenge(challenge: Challenge): SellerTab {
  const status = String(challenge.participant?.statusParticipacao ?? "").toUpperCase()
  if (status === "CONCLUIDO" || status === "EXPIRADO") return "encerrados"
  if (isClosedChallengeStatus(getChallengeLifecycleStatus(challenge))) return "encerrados"
  if (status === "ACEITO" || status === "EM_ANDAMENTO") return "andamento"
  return "disponiveis"
}
