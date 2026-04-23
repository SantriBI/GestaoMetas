"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Coins, Gift, Swords, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { ChallengeCampaignSummary } from "@/components/challenges/ChallengeCampaignSummary"
import { ChallengeExistingList } from "@/components/challenges/ChallengeExistingList"
import { ChallengeInlineWizard } from "@/components/challenges/ChallengeInlineWizard"
import { ChallengesModeSwitcher } from "@/components/challenges/ChallengesModeSwitcher"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { useManagerChallenges } from "@/hooks/useChallenges"
import {
  aggregateChallengesSummary,
  formatCurrencyBRL,
  getChallengeCampaignKind,
  type Challenge,
  type ChallengeCampaignKind,
  type ChallengeFormPayload,
} from "@/lib/challenges"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

type ChallengesMode = "create" | "list"

const campaignTabs: Array<{
  kind: ChallengeCampaignKind
  label: string
  icon: ReactNode
}> = [
  {
    kind: "DESAFIO",
    label: "Desafios",
    icon: <Swords className="h-4 w-4" />,
  },
  {
    kind: "BONUS",
    label: "Bônus",
    icon: <Gift className="h-4 w-4" />,
  },
]

export default function DesafiosPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [mode, setMode] = useState<ChallengesMode>("list")
  const [campaignKind, setCampaignKind] = useState<ChallengeCampaignKind>("DESAFIO")
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [modeInitialized, setModeInitialized] = useState(false)
  const {
    data,
    metadata,
    setup,
    selectedChallenge,
    setSelectedChallenge,
    loading,
    saving,
    error,
    actionError,
    clearActionError,
    saveChallenge,
    openDetails,
    endChallenge,
    cancelChallenge,
    estimateImpact,
  } = useManagerChallenges()

  useEffect(() => {
    const user = getStoredUser()
    if (!user || user.role !== "GERENTE") {
      router.push("/login")
      return
    }
    setStoredUser(user)
    setAuthUser(user)
  }, [router])

  useEffect(() => {
    if (modeInitialized || loading || !data) return
    const hasChallenges = data.items.some((item) => getChallengeCampaignKind(item) === "DESAFIO")
    const hasBonus = data.items.some((item) => getChallengeCampaignKind(item) === "BONUS")

    setCampaignKind(hasChallenges ? "DESAFIO" : hasBonus ? "BONUS" : "DESAFIO")
    setMode(data.items.length ? "list" : "create")
    setModeInitialized(true)
  }, [data, loading, modeInitialized])

  const visibleItems = (data?.items ?? []).filter((item) => getChallengeCampaignKind(item) === campaignKind)
  const visibleSummary = aggregateChallengesSummary(visibleItems)
  const selectedVisibleChallenge =
    selectedChallenge && getChallengeCampaignKind(selectedChallenge) === campaignKind ? selectedChallenge : null
  const activeCount = visibleItems.filter((item) => item.status === "ATIVO").length
  const previewReturn =
    visibleSummary.returnPerBonusRealized && visibleSummary.returnPerBonusRealized > 0
      ? `${visibleSummary.returnPerBonusRealized.toFixed(2)}x`
      : visibleSummary.returnPerBonusPotential && visibleSummary.returnPerBonusPotential > 0
        ? `${visibleSummary.returnPerBonusPotential.toFixed(2)}x`
        : "0,00x"

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
    }
    return saved
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_20%),radial-gradient(circle_at_88%_12%,rgba(245,158,11,0.14),transparent_24%),linear-gradient(145deg,#04070f,#0b1220_45%,#111827)]">
      <AppShellNav user={authUser} />

      <main className="mx-auto max-w-[1320px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-[38px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_24%),radial-gradient(circle_at_85%_12%,rgba(251,191,36,0.18),transparent_24%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(17,24,39,0.94))] p-6 shadow-[0_30px_110px_rgba(0,0,0,0.3)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/80">CENTRAL COMERCIAL</p>
              <h1 className="mt-3 text-[2.2rem] font-black tracking-tight text-white sm:text-[3.1rem]">Desafios & Bônus</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-200">Crie campanhas, acompanhe resultados e acelere seu time.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <PulseStat label="Ativas" value={activeCount} icon={<Swords className="h-4 w-4 text-cyan-200" />} />
              <PulseStat
                label="Bonus potencial"
                value={formatCurrencyBRL(Number(visibleSummary.estimatedRewardTotal ?? 0))}
                icon={<Coins className="h-4 w-4 text-amber-200" />}
              />
              <PulseStat label="Retorno" value={previewReturn} icon={<TrendingUp className="h-4 w-4 text-emerald-200" />} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[28px] border border-rose-400/18 bg-rose-400/10 p-5 text-sm leading-7 text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-full flex-wrap rounded-[24px] border border-white/10 bg-white/[0.04] p-1.5 lg:w-auto">
            {campaignTabs.map((tab) => {
              const active = tab.kind === campaignKind
              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => handleKindChange(tab.kind)}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold transition lg:flex-none ${
                    active
                      ? "bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(59,130,246,0.14))] text-white"
                      : "text-white/58 hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>

          <p className="text-sm leading-6 text-white/55">
            {campaignKind === "BONUS"
              ? "Bonus mensais automaticos, com leitura do mes atual."
              : "Campanhas com inicio, fim e aceite do time."}
          </p>
        </section>

        <ChallengesModeSwitcher
          mode={mode}
          campaignKind={campaignKind}
          activeCount={activeCount}
          totalCount={visibleItems.length}
          onChange={handleModeChange}
        />

        <ChallengeCampaignSummary
          summary={visibleSummary}
          campaignKind={campaignKind}
          activeCount={activeCount}
          totalCount={visibleItems.length}
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
            onEstimateImpact={estimateImpact}
          />
        ) : (
          <ChallengeExistingList
            campaignKind={campaignKind}
            loading={loading}
            items={visibleItems}
            selectedChallenge={selectedVisibleChallenge}
            setup={setup}
            onOpen={handleOpen}
            onClose={() => setSelectedChallenge(null)}
            onEdit={handleEdit}
            onEnd={(challenge) => void endChallenge(challenge.id)}
            onCancel={(challenge) => void cancelChallenge(challenge.id)}
          />
        )}

        {mode === "list" && !visibleItems.length && !loading ? (
          <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-6 text-center">
            <p className="text-lg font-semibold text-white">
              {campaignKind === "BONUS" ? "Nenhum bonus mensal configurado" : "Nenhuma campanha publicada"}
            </p>
            <button
              type="button"
              onClick={handleStartCreate}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] px-5 text-sm font-semibold text-black"
            >
              Criar nova campanha
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function PulseStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
