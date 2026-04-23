"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Gift, Sparkles, Swords, TrendingUp } from "lucide-react"
import { ChallengeDetailsPanel } from "@/components/challenges/ChallengeDetailsPanel"
import { ChallengeExpandableCard } from "@/components/challenges/ChallengeExpandableCard"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MotivationSpotlight } from "@/components/layout/MotivationSpotlight"
import { useNotifications } from "@/components/notifications/NotificationContext"
import { ChallengeEmptyState } from "@/components/challenges/ChallengeEmptyState"
import { ChallengeHero } from "@/components/challenges/ChallengeHero"
import { ChallengeNotificationBanner } from "@/components/challenges/ChallengeNotificationBanner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSellerChallengeAlert, useSellerChallenges } from "@/hooks/useChallenges"
import { useSellerMotivation } from "@/hooks/useSellerMotivation"
import {
  formatCurrencyBRL,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getSellerCampaignNotificationId,
  getSellerCampaignNotificationPrefixes,
  isSellerBonus,
  isSellerChallengeAccepted,
  isSellerChallengeAvailable,
  shouldShowSellerCampaignBanner,
  type Challenge,
  type SellerChallengeAlertItem,
} from "@/lib/challenges"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

type SellerTab = "desafios" | "bonus"

function VendedorDesafiosContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { notifications, removeNotifications } = useNotifications()
  const processedHighlightRef = useRef<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SellerTab>("desafios")
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
    acting: alertActing,
    refresh: refreshAlert,
    acceptAlert,
    dismissAlert,
  } = useSellerChallengeAlert(authUser?.sk_vendedor ?? null)
  const { getMessage } = useSellerMotivation(authUser)

  useEffect(() => {
    const user = getStoredUser()
    if (!user || user.role !== "VENDEDOR") {
      router.push("/login")
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
  const alertItems = useMemo<SellerChallengeAlertItem[]>(() => {
    if (alert?.items?.length) return alert.items
    return alert?.challenge ? [alert.challenge] : []
  }, [alert])
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
  const featuredChallengeIds = useMemo(() => new Set(alertItems.map((item) => String(item.id))), [alertItems])

  const acceptedChallenges = useMemo(
    () =>
      [...allItems]
        .filter(isSellerChallengeAccepted)
        .sort((left, right) => getSellerStatusWeight(right.participant?.statusParticipacao) - getSellerStatusWeight(left.participant?.statusParticipacao)),
    [allItems]
  )

  const availableChallengesRaw = useMemo(() => [...allItems].filter(isSellerChallengeAvailable), [allItems])

  const availableChallenges = useMemo(
    () => availableChallengesRaw.filter((item) => !featuredChallengeIds.has(String(item.id))),
    [availableChallengesRaw, featuredChallengeIds]
  )

  const bonusItems = useMemo(
    () =>
      [...allItems]
        .filter(isSellerBonus)
        .filter((item) => !["ENCERRADO", "CANCELADO"].includes(item.status))
        .sort((left, right) => getChallengeStatusWeight(right.status) - getChallengeStatusWeight(left.status)),
    [allItems]
  )

  const acceptedUnlockedReward = useMemo(
    () => acceptedChallenges.reduce((sum, challenge) => sum + Number(challenge.participant?.premioTotalLiberado ?? 0), 0),
    [acceptedChallenges]
  )

  const availablePotentialReward = useMemo(
    () => availableChallengesRaw.reduce((sum, challenge) => sum + challenge.metas.reduce((metaSum, meta) => metaSum + Number(meta.recompensaValor ?? 0), 0), 0),
    [availableChallengesRaw]
  )

  const bonusPotentialReward = useMemo(
    () => bonusItems.reduce((sum, challenge) => sum + Number(challenge.impact?.bonusPotential ?? 0), 0),
    [bonusItems]
  )
  const challengeMotivation = getMessage({
    context: "challenges",
    availableReward: availablePotentialReward + bonusPotentialReward,
    unlockedReward: acceptedUnlockedReward,
  })

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
        setActiveTab(getChallengeCampaignKind(detail) === "BONUS" ? "bonus" : "desafios")
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

    if (!staleIds.length) return

    removeNotifications(staleIds)
  }, [
    alertLoading,
    authUser?.sk_vendedor,
    loading,
    notifications,
    removeNotifications,
    sellerCampaignNotificationIdsKey,
  ])

  useEffect(() => {
    if (loading || selectedChallenge || acceptedChallenges.length || availableChallengesRaw.length || activeTab === "bonus") return
    if (bonusItems.length) {
      setActiveTab("bonus")
    }
  }, [acceptedChallenges.length, activeTab, availableChallengesRaw.length, bonusItems.length, loading, selectedChallenge])

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
    setActiveTab(getChallengeCampaignKind(detail) === "BONUS" ? "bonus" : "desafios")
    focusChallengeCard(detail.id)
    void refreshAlert()
  }

  async function handleAccept(challenge: Challenge) {
    const accepted = await acceptChallenge(challenge.id)
    if (!accepted) return

    setFeedback(`${getChallengeCampaignKindLabel(getChallengeCampaignKind(accepted))} aceito: ${accepted.titulo}`)
    setTimeout(() => setFeedback(null), 2500)
    setSelectedChallenge(accepted)
    setActiveTab("desafios")
    focusChallengeCard(accepted.id)
    await refreshAlert()
  }

  async function handleDismiss(challenge: Challenge) {
    const dismissed = await dismissChallenge(challenge.id)
    if (!dismissed) return

    setFeedback(`${getChallengeCampaignKindLabel(getChallengeCampaignKind(challenge))} recusado: ${challenge.titulo}`)
    setTimeout(() => setFeedback(null), 2500)
    await refreshAlert()
  }

  async function handleAcceptAlert(challengeId?: number | string) {
    const accepted = challengeId ? await acceptChallenge(challengeId) : await acceptAlert()
    if (!accepted) return

    setFeedback(`${getChallengeCampaignKindLabel(getChallengeCampaignKind(accepted))} aceito: ${accepted.titulo}`)
    setTimeout(() => setFeedback(null), 2500)
    await refresh()
    await refreshAlert()
    setSelectedChallenge(accepted)
    setActiveTab("desafios")
    focusChallengeCard(accepted.id)
  }

  async function handleDismissAlert(challengeId?: number | string) {
    const dismissed = challengeId ? await dismissChallenge(challengeId) : await dismissAlert()
    if (!dismissed) return

    setFeedback("Campanha recusada. O gerente vai ver que voce nao entrou nesta acao.")
    setTimeout(() => setFeedback(null), 2500)
    await refresh()
    await refreshAlert()
  }

  const showAvailableSection = availableChallenges.length > 0 || !alertItems.length

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_24%),radial-gradient(circle_at_85%_10%,rgba(245,158,11,0.16),transparent_26%),linear-gradient(145deg,#04070f,#0b1220_45%,#08111b)]">
      <AppShellNav user={authUser} />
      <main className="mx-auto max-w-[1180px] space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        {feedback ? <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-400/10 px-5 py-4 text-sm font-semibold text-emerald-50">{feedback}</div> : null}
        {error ? <div className="rounded-[24px] border border-rose-300/18 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">{error}</div> : null}

        <ChallengeHero
          eyebrow="PAINEL DO VENDEDOR"
          title="Desafios & Bonus"
          description="Campanhas claras para agir, bonus mensais para acompanhar o mes e atalhos diretos para vender mais."
          action={
            <div className="w-full max-w-[420px] rounded-[28px] border border-white/10 bg-black/20 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.2)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">
                <Sparkles className="h-4 w-4" />
                Leitura rapida
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <QuickStat label="Em destaque" value={acceptedChallenges.length} icon={<Swords className="h-4 w-4 text-cyan-200" />} />
                <QuickStat label="Disponiveis" value={availableChallengesRaw.length} icon={<TrendingUp className="h-4 w-4 text-emerald-200" />} />
                <QuickStat label="Bonus do mes" value={formatCurrencyBRL(bonusPotentialReward)} icon={<Gift className="h-4 w-4 text-amber-200" />} />
              </div>
              <p className="mt-4 text-sm leading-6 text-white/58">
                {acceptedChallenges.length
                  ? `Voce ja liberou ${formatCurrencyBRL(acceptedUnlockedReward)} nas campanhas em andamento.`
                  : `Ha ${formatCurrencyBRL(availablePotentialReward)} em recompensa esperando decisao.`}
              </p>
            </div>
          }
        />

        <MotivationSpotlight message={challengeMotivation} compact />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SellerTab)} className="space-y-6">
          <TabsList className="h-auto rounded-[26px] border border-white/10 bg-white/[0.04] p-2">
            <TabsTrigger
              value="desafios"
              className="rounded-[20px] px-5 py-3 text-sm font-semibold text-white data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,rgba(34,211,238,0.24),rgba(59,130,246,0.14))] data-[state=active]:text-white"
            >
              Desafios
            </TabsTrigger>
            <TabsTrigger
              value="bonus"
              className="rounded-[20px] px-5 py-3 text-sm font-semibold text-white data-[state=active]:border-transparent data-[state=active]:bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(249,115,22,0.14))] data-[state=active]:text-white"
            >
              Bonus
            </TabsTrigger>
          </TabsList>

          <TabsContent value="desafios" className="space-y-8">
            {alertItems.length ? (
              <div className="space-y-4">
                {alertItems.map((item) => (
                  <ChallengeNotificationBanner
                    key={item.id}
                    title={item.titulo ?? "Nova campanha disponivel"}
                    description={item.descricao ?? "Aceite a campanha com um clique e decida se vai entrar nesta acao comercial."}
                    dataInicio={item.dataInicio}
                    dataFim={item.dataFim}
                    brandNames={item.brandNames}
                    href={`/vendedor/desafios?highlight=${item.id}`}
                    onAccept={() => handleAcceptAlert(item.id)}
                    onDismiss={() => handleDismissAlert(item.id)}
                    loading={acting || alertActing}
                  />
                ))}
              </div>
            ) : null}

            <section className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Em destaque</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Campanhas que voce ja aceitou</h2>
              </div>

              {loading ? (
                <LoadingStack />
              ) : acceptedChallenges.length ? (
                <div className="space-y-4">
                  {acceptedChallenges.map((challenge) => {
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
                        detailEyebrow="Detalhe do desafio"
                        detailTitle={detailChallenge?.titulo ?? challenge.titulo ?? "Desafio"}
                        detailContent={detailChallenge ? <ChallengeDetailsPanel challenge={detailChallenge} /> : null}
                        onToggle={handleOpen}
                        onClose={() => setSelectedChallenge(null)}
                      />
                    )
                  })}
                </div>
              ) : (
                <ChallengeEmptyState
                  title="Nenhuma campanha em destaque"
                  description="Assim que voce aceitar um desafio, ele aparece aqui com progresso e recompensa."
                />
              )}
            </section>

            {showAvailableSection ? (
              <section className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Disponiveis agora</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Campanhas para participar</h2>
                </div>

                {loading ? (
                  <LoadingStack />
                ) : availableChallenges.length ? (
                  <div className="space-y-4">
                    {availableChallenges.map((challenge) => {
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
                          detailEyebrow="Detalhe do desafio"
                          detailTitle={detailChallenge?.titulo ?? challenge.titulo ?? "Desafio"}
                          detailContent={detailChallenge ? <ChallengeDetailsPanel challenge={detailChallenge} /> : null}
                          onToggle={handleOpen}
                          onClose={() => setSelectedChallenge(null)}
                          onAccept={acting ? undefined : handleAccept}
                          onDismiss={acting ? undefined : handleDismiss}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <ChallengeEmptyState
                    title="Nenhuma campanha aguardando aceite"
                    description="Quando uma nova campanha entrar para voce, ela aparece aqui."
                  />
                )}
              </section>
            ) : null}

          </TabsContent>

          <TabsContent value="bonus" className="space-y-8">
            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_70px_rgba(15,23,42,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Metas mensais</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Bonus automaticos do periodo</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
                Aqui entram os bonus mensais que acompanham faturamento, pedidos e clientes sem precisar de aceite.
              </p>
            </section>

            <section className="space-y-4">
              {loading ? (
                <LoadingStack />
              ) : bonusItems.length ? (
                <div className="space-y-4">
                  {bonusItems.map((challenge) => {
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
                        detailEyebrow="Detalhe do bonus"
                        detailTitle={detailChallenge?.titulo ?? challenge.titulo ?? "Bonus mensal"}
                        detailContent={detailChallenge ? <ChallengeDetailsPanel challenge={detailChallenge} /> : null}
                        onToggle={handleOpen}
                        onClose={() => setSelectedChallenge(null)}
                      />
                    )
                  })}
                </div>
              ) : (
                <ChallengeEmptyState
                  title="Nenhum bonus mensal ativo"
                  description="Quando uma meta mensal automatica estiver valendo, ela aparece aqui com progresso e atalhos."
                />
              )}
            </section>

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

function QuickStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
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

function getChallengeStatusWeight(status: Challenge["status"]) {
  const weights: Record<Challenge["status"], number> = {
    ATIVO: 4,
    AGENDADO: 3,
    RASCUNHO: 2,
    ENCERRADO: 1,
    CANCELADO: 0,
  }

  return weights[status]
}
