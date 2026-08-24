"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, CheckCircle2, Gift, Loader2, Swords, TrendingUp, Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { ChallengeExistingList } from "@/components/challenges/ChallengeExistingList"
import { ChallengeInlineWizard } from "@/components/challenges/ChallengeInlineWizard"
import { ChallengesModeSwitcher } from "@/components/challenges/ChallengesModeSwitcher"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useManagerChallenges } from "@/hooks/useChallenges"
import { useRotatingMessage } from "@/hooks/useRotatingMessage"
import {
  formatCurrencyBRL,
  getChallengeCampaignKind,
  getChallengeLifecycleStatus,
  type Challenge,
  type ChallengeCampaignKind,
  type ChallengeFormPayload,
} from "@/lib/challenges"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

type ChallengesMode = "create" | "list"

const OPENING_LOADING_MESSAGES = [
  "Buscando campanhas, metas e progresso do time.",
  "Isso pode levar alguns segundos, já já aparece tudo aqui.",
  "Existem muitos dados sendo cruzados agora, calma que já vem.",
  "Só mais um instante...",
]

const SAVING_LOADING_MESSAGES = [
  "Isso pode levar alguns segundos.",
  "Estamos conferindo os vendedores elegíveis.",
  "Existem muitos dados sendo processados, calma que já vai.",
  "Só mais um instante...",
]

export default function DesafiosPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [mode, setMode] = useState<ChallengesMode>("list")
  const [campaignKind, setCampaignKind] = useState<ChallengeCampaignKind>("DESAFIO")
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [modeInitialized, setModeInitialized] = useState(false)
  const [publishedMessage, setPublishedMessage] = useState<string | null>(null)
  const dismissPublishedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openingLoadingMessage = useRotatingMessage(OPENING_LOADING_MESSAGES)
  const savingLoadingMessage = useRotatingMessage(SAVING_LOADING_MESSAGES)
  const {
    data,
    metadata,
    setup,
    selectedChallenge,
    setSelectedChallenge,
    loadingChallenges,
    saving,
    error,
    actionError,
    clearActionError,
    saveChallenge,
    openDetails,
    cancelChallenge,
  } = useManagerChallenges()

  useEffect(() => {
    return () => {
      if (dismissPublishedTimeoutRef.current) clearTimeout(dismissPublishedTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      router.push("/login")
      return
    }

    const isManager = user.role === "GERENTE"
    const isSystemManagerViewingManager =
      user.role === "GERENTE_SISTEMAS" && user.gerente_sistemas_view === "GERENTE" && !!user.empresa_id

    if (!isManager && !isSystemManagerViewingManager) {
      router.push(user.role === "GERENTE_SISTEMAS" ? "/gerente-sistemas" : "/login")
      return
    }

    setStoredUser(user)
    setAuthUser(user)
  }, [router])

  useEffect(() => {
    if (modeInitialized || loadingChallenges || !data) return
    const hasChallenges = data.items.some((item) => getChallengeCampaignKind(item) === "DESAFIO")
    const hasBonus = data.items.some((item) => getChallengeCampaignKind(item) === "BONUS")

    setCampaignKind(hasChallenges ? "DESAFIO" : hasBonus ? "BONUS" : "DESAFIO")
    setMode(data.items.length ? "list" : "create")
    setModeInitialized(true)
  }, [data, loadingChallenges, modeInitialized])

  const visibleItems = useMemo(
    () => (data?.items ?? []).filter((item) => getChallengeCampaignKind(item) === campaignKind),
    [data, campaignKind]
  )
  const activeItems = useMemo(
    () => visibleItems.filter((item) => getChallengeLifecycleStatus(item) === "ATIVO"),
    [visibleItems]
  )
  const selectedVisibleChallenge =
    selectedChallenge && getChallengeCampaignKind(selectedChallenge) === campaignKind ? selectedChallenge : null
  const activeCount = activeItems.length
  const desafiosCount = useMemo(
    () => (data?.items ?? []).filter((item) => getChallengeCampaignKind(item) === "DESAFIO").length,
    [data]
  )
  const bonusCount = useMemo(
    () => (data?.items ?? []).filter((item) => getChallengeCampaignKind(item) === "BONUS").length,
    [data]
  )
  const totalBonusPaid = useMemo(
    () => visibleItems.reduce((sum, item) => sum + Number(item.impact?.bonusPaid ?? 0), 0),
    [visibleItems]
  )

  async function handleOpen(challenge: Challenge) {
    const detail = await openDetails(challenge.id)
    setSelectedChallenge(detail)
    setCampaignKind(getChallengeCampaignKind(detail))
    setMode("list")
  }

  async function handleSave(payload: ChallengeFormPayload, id?: number | string) {
    const saved = await saveChallenge({ ...payload, criadoPor: authUser?.nome ?? "Gerente SIP" }, id)
    if (saved) {
      setEditingChallenge(null)
      setSelectedChallenge(saved)
      setCampaignKind(getChallengeCampaignKind(saved))
      setMode("list")
      const kindLabel = getChallengeCampaignKind(saved) === "BONUS" ? "Bônus" : "Desafio"
      showPublishedFeedback(id ? `${kindLabel} atualizado com sucesso!` : `${kindLabel} publicado com sucesso!`)
    }
    return saved
  }

  function showPublishedFeedback(message: string) {
    if (dismissPublishedTimeoutRef.current) clearTimeout(dismissPublishedTimeoutRef.current)
    setPublishedMessage(message)
    dismissPublishedTimeoutRef.current = setTimeout(() => setPublishedMessage(null), 3200)
  }

  function handleModeChange(nextMode: ChallengesMode) {
    clearActionError()
    setMode(nextMode)

    if (nextMode === "create") {
      setSelectedChallenge(null)
      return
    }

    setEditingChallenge(null)
  }

  function handleStartCreate() {
    clearActionError()
    setEditingChallenge(null)
    setSelectedChallenge(null)
    setMode("create")
  }

  function handleEdit(challenge: Challenge) {
    clearActionError()
    setCampaignKind(getChallengeCampaignKind(challenge))
    setEditingChallenge(challenge)
    setMode("create")
  }

  function handleKindChange(nextKind: ChallengeCampaignKind) {
    clearActionError()
    setCampaignKind(nextKind)

    if (editingChallenge && getChallengeCampaignKind(editingChallenge) !== nextKind) {
      setEditingChallenge(null)
    }

    if (selectedChallenge && getChallengeCampaignKind(selectedChallenge) !== nextKind) {
      setSelectedChallenge(null)
    }
  }

  const campaignNoun = campaignKind === "BONUS" ? "bônus" : "desafio"
  const savingMessage = editingChallenge
    ? `Salvando alterações no ${campaignNoun}...`
    : `Publicando o ${campaignNoun} para todos os vendedores...`

  if (loadingChallenges && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <AppShellNav user={authUser} />
        <main className="mx-auto flex max-w-[1400px] flex-col items-center justify-center gap-4 px-4 py-32 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-cyan-300" />
          <p className="text-lg font-semibold text-white">Estamos abrindo os desafios...</p>
          <p key={openingLoadingMessage} className="max-w-md animate-in fade-in text-sm text-white/45 duration-500">
            {openingLoadingMessage}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-mobile-tabbar">
      {saving ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="flex w-full max-w-sm animate-in fade-in zoom-in-95 flex-col items-center gap-5 rounded-[32px] border border-cyan-300/20 bg-[linear-gradient(160deg,rgba(15,23,42,0.98),rgba(8,13,24,0.98))] px-8 py-10 text-center shadow-[0_40px_120px_rgba(0,0,0,0.6)] duration-300">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl" />
              <Loader2 className="relative h-14 w-14 animate-spin text-cyan-300" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-bold text-white">{savingMessage}</p>
              <p key={savingLoadingMessage} className="animate-in fade-in text-sm text-white/45 duration-500">
                {savingLoadingMessage}
              </p>
            </div>
          </div>
        </div>
      ) : publishedMessage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="flex w-full max-w-sm animate-in fade-in zoom-in-95 flex-col items-center gap-5 rounded-[32px] border border-emerald-300/25 bg-[linear-gradient(160deg,rgba(6,20,15,0.98),rgba(4,14,10,0.98))] px-8 py-10 text-center shadow-[0_40px_120px_rgba(0,0,0,0.6)] duration-300">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
              <CheckCircle2 className="relative h-14 w-14 text-emerald-300" />
            </div>
            <p className="text-lg font-bold text-emerald-50">{publishedMessage}</p>
          </div>
        </div>
      ) : null}

      <AppShellNav user={authUser} />
      <MobileTabBar user={authUser} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 lg:px-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao painel
        </button>

        <section className="rounded-[28px] border border-white/[0.08] bg-[#0d1421] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">Painel gerencial</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Campanhas & Incentivos</h1>
              <p className="mt-2 text-sm text-white/45">Acompanhe desafios e bônus do time.</p>
            </div>

            <div className="flex gap-3">
              <QuickStat
                label="Ativos"
                value={activeCount}
                icon={<Swords className="h-3.5 w-3.5" />}
                color="cyan"
                loading={loadingChallenges}
              />
              <QuickStat
                label="Bônus pago"
                value={formatCurrencyBRL(totalBonusPaid)}
                icon={<Wallet className="h-3.5 w-3.5" />}
                color="amber"
                loading={loadingChallenges}
              />
              <QuickStat
                label="Total"
                value={visibleItems.length}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                color="emerald"
                loading={loadingChallenges}
              />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[24px] border border-rose-400/16 bg-rose-400/8 p-5 text-sm leading-7 text-rose-100">
            {error}
          </div>
        ) : null}

        <Tabs value={campaignKind} onValueChange={(value) => handleKindChange(value as ChallengeCampaignKind)}>
          <TabsList className="h-auto w-full justify-start rounded-[20px] border border-white/[0.08] bg-[#0d1421] p-1.5 sm:w-auto">
            <TabsTrigger
              value="DESAFIO"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold text-white/45 transition-colors data-[state=active]:bg-white/[0.09] data-[state=active]:text-white data-[state=active]:shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
            >
              <Swords className="mr-1.5 h-4 w-4" />
              Desafios
              {desafiosCount > 0 ? (
                <span className="ml-2 rounded-full bg-cyan-400/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
                  {desafiosCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="BONUS"
              className="rounded-[14px] px-4 py-2 text-[13px] font-semibold text-white/45 transition-colors data-[state=active]:bg-white/[0.09] data-[state=active]:text-white data-[state=active]:shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
            >
              <Gift className="mr-1.5 h-4 w-4" />
              Bônus
              {bonusCount > 0 ? (
                <span className="ml-2 rounded-full bg-blue-400/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-200">
                  {bonusCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ChallengesModeSwitcher
          mode={mode}
          activeCount={activeCount}
          totalCount={visibleItems.length}
          onChange={handleModeChange}
        />

        {mode === "create" ? (
          <ChallengeInlineWizard
            editingChallenge={editingChallenge}
            campaignKind={campaignKind}
            metadata={metadata}
            saving={saving}
            setup={setup}
            createdBy={authUser?.nome}
            actionError={actionError}
            onCancel={() => {
              setEditingChallenge(null)
              setMode("list")
            }}
            onSubmit={handleSave}
          />
        ) : (
          <ChallengeExistingList
            campaignKind={campaignKind}
            loading={loadingChallenges}
            items={visibleItems}
            selectedChallenge={selectedVisibleChallenge}
            setup={setup}
            onOpen={handleOpen}
            onClose={() => setSelectedChallenge(null)}
            onEdit={handleEdit}
            onCancel={(challenge) => void cancelChallenge(challenge.id)}
          />
        )}

        {mode === "list" && !visibleItems.length && !loadingChallenges ? (
          <div className="rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.025] p-6 text-center">
            <p className="text-lg font-semibold text-white">
              {campaignKind === "BONUS" ? "Nenhum bônus configurado" : "Nenhum desafio publicado"}
            </p>
            <button
              type="button"
              onClick={handleStartCreate}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:opacity-92"
            >
              {campaignKind === "BONUS" ? "Criar novo bônus" : "Criar novo desafio"}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
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
