"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Gift, Swords } from "lucide-react"
import { useRouter } from "next/navigation"
import { ChallengeExistingList } from "@/components/challenges/ChallengeExistingList"
import { ChallengeInlineWizard } from "@/components/challenges/ChallengeInlineWizard"
import { ChallengesModeSwitcher } from "@/components/challenges/ChallengesModeSwitcher"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { useManagerChallenges } from "@/hooks/useChallenges"
import {
  getChallengeCampaignKind,
  getChallengeLifecycleStatus,
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
    const user = getStoredUser()
    if (!user || user.role !== "GERENTE") {
      router.push("/login")
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
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppShellNav user={authUser} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 lg:px-6">
        <section className="overflow-hidden rounded-[32px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/38">Painel gerencial</p>
              <h1 className="mt-3 text-[2.35rem] font-black tracking-tight text-white sm:text-[3rem]">Campanhas & Incentivos</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
                Acompanhe desafios e bônus do time.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[24px] border border-rose-400/16 bg-rose-400/8 p-5 text-sm leading-7 text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full flex-wrap rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-1.5 xl:w-auto">
            {campaignTabs.map((tab) => {
              const active = tab.kind === campaignKind
              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => handleKindChange(tab.kind)}
                  className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-semibold transition xl:flex-none ${
                    active
                      ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      : "text-white/52 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </section>

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
