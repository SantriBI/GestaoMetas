"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Accordion } from "@/components/ui/accordion"
import { ChallengeEmptyState } from "@/components/challenges/ChallengeEmptyState"
import { ChallengeInitializationWarning } from "@/components/challenges/ChallengeInitializationWarning"
import { ChallengeManagerAccordionCard } from "@/components/challenges/ChallengeManagerAccordionCard"
import {
  getChallengeLifecycleStatus,
  type Challenge,
  type ChallengeCampaignKind,
  type ChallengeModuleSetup,
  type ChallengeStatus,
} from "@/lib/challenges"

export function ChallengeExistingList({
  campaignKind,
  loading,
  items,
  selectedChallenge,
  setup,
  onOpen,
  onClose,
  onEdit,
  onCancel,
}: {
  campaignKind: ChallengeCampaignKind
  loading: boolean
  items: Challenge[]
  selectedChallenge?: Challenge | null
  setup?: ChallengeModuleSetup | null
  onOpen: (challenge: Challenge) => void | Promise<void>
  onClose: () => void
  onEdit: (challenge: Challenge) => void
  onCancel: (challenge: Challenge) => void | Promise<void>
}) {
  const sortedItems = [...items].sort((left, right) => compareChallengesForDecision(left, right))
  const activeCount = items.filter((item) => getChallengeLifecycleStatus(item) === "ATIVO").length
  const [loadingChallengeId, setLoadingChallengeId] = useState<string | null>(null)
  const [showClosedSection, setShowClosedSection] = useState(false)
  const selectedValue = selectedChallenge ? String(selectedChallenge.id) : ""
  const accordionValue = selectedValue || undefined
  const sections = buildSections(sortedItems)

  async function handleAccordionChange(nextValue: string) {
    if (!nextValue) {
      onClose()
      return
    }

    if (nextValue === selectedValue) {
      onClose()
      return
    }

    const targetChallenge = sortedItems.find((challenge) => String(challenge.id) === nextValue)
    if (!targetChallenge) return

    setLoadingChallengeId(nextValue)
    try {
      await onOpen(targetChallenge)
    } catch {
      onClose()
    } finally {
      setLoadingChallengeId((current) => (current === nextValue ? null : current))
    }
  }

  return (
    <section className="space-y-5">
      {setup && !setup.ready ? (
        <ChallengeInitializationWarning
          setup={setup}
          title="As tabelas do módulo de campanhas ainda não foram localizadas no banco."
          description="Você pode revisar a tela, mas a publicação depende da persistência do módulo."
          compact
        />
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
          {campaignKind === "BONUS" ? "Bônus" : "Desafios"}
        </h2>
        <p className="text-sm font-medium text-white/46">{activeCount} ativa(s) | {items.length} total</p>
      </div>

      {loading && !sortedItems.length ? (
        <div className="space-y-3.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <ChallengeCardSkeleton key={index} />
          ))}
        </div>
      ) : sortedItems.length ? (
        <Accordion type="single" collapsible value={accordionValue} onValueChange={(value) => void handleAccordionChange(value)} className="space-y-5">
          {sections.map((section) => (
            <div key={section.key} className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-white">{section.title}</h3>
                <span className="self-start rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  {section.items.length} campanha(s)
                </span>
              </div>

              {section.key === "closed" ? (
                <div className="space-y-3.5">
                  <button
                    type="button"
                    onClick={() => setShowClosedSection((current) => !current)}
                    className="flex w-full items-center justify-between rounded-[20px] border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-left transition hover:bg-white/[0.04]"
                  >
                    <p className="text-sm font-semibold text-white">{showClosedSection ? "Ocultar encerradas" : "Mostrar encerradas"}</p>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white/76">
                      {showClosedSection ? "Recolher" : "Expandir"}
                      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showClosedSection ? "rotate-180" : ""}`} />
                    </span>
                  </button>

                  {showClosedSection ? (
                    <div className="space-y-3.5">
                      {section.items.map((challenge) => {
                        const challengeId = String(challenge.id)
                        const isOpen = selectedValue === challengeId
                        const isLoading = loadingChallengeId === challengeId
                        const detailChallenge = selectedValue === challengeId ? selectedChallenge : null

                        return (
                          <ChallengeManagerAccordionCard
                            key={challenge.id}
                            challenge={detailChallenge ?? challenge}
                            isOpen={isOpen}
                            isLoading={isLoading}
                            onEdit={onEdit}
                            onCancel={onCancel}
                          />
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {section.items.map((challenge) => {
                    const challengeId = String(challenge.id)
                    const isOpen = selectedValue === challengeId
                    const isLoading = loadingChallengeId === challengeId
                    const detailChallenge = selectedValue === challengeId ? selectedChallenge : null

                    return (
                      <ChallengeManagerAccordionCard
                        key={challenge.id}
                        challenge={detailChallenge ?? challenge}
                        isOpen={isOpen}
                        isLoading={isLoading}
                        onEdit={onEdit}
                        onCancel={onCancel}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </Accordion>
      ) : (
        <ChallengeEmptyState
          title={campaignKind === "BONUS" ? "Nenhum bônus criado" : "Nenhum desafio criado"}
          description={campaignKind === "BONUS" ? "Publique o primeiro bônus." : "Publique o primeiro desafio."}
        />
      )}
    </section>
  )
}

function ChallengeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,39,0.98),rgba(8,13,24,0.98),rgba(15,23,42,0.94))] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-6 w-32 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-6 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-white/[0.05]" />
        </div>
        <div className="h-10 w-32 shrink-0 animate-pulse rounded-2xl bg-white/[0.06]" />
      </div>
    </div>
  )
}

function getStatusWeight(status: ChallengeStatus) {
  const weights: Record<ChallengeStatus, number> = {
    ATIVO: 5,
    AGENDADO: 4,
    RASCUNHO: 3,
    ENCERRADO: 2,
    ENCERRADO_AUTOMATICO: 2,
    ENCERRADO_MANUAL: 2,
    CANCELADO: 1,
  }

  return weights[status]
}

function compareChallengesForDecision(left: Challenge, right: Challenge) {
  const leftStatus = getChallengeLifecycleStatus(left)
  const rightStatus = getChallengeLifecycleStatus(right)
  const weightDelta = getStatusWeight(rightStatus) - getStatusWeight(leftStatus)
  if (weightDelta !== 0) return weightDelta

  if (leftStatus === "ATIVO" && rightStatus === "ATIVO") {
    return compareDateValues(left.dataFim, right.dataFim)
  }

  if (leftStatus === "AGENDADO" && rightStatus === "AGENDADO") {
    return compareDateValues(left.dataInicio, right.dataInicio)
  }

  return compareDateValues(right.dataInicio, left.dataInicio)
}

function compareDateValues(
  left: Challenge["dataInicio"] | Challenge["dataFim"],
  right: Challenge["dataInicio"] | Challenge["dataFim"]
) {
  const leftTime = parseDateValue(left)
  const rightTime = parseDateValue(right)
  return leftTime - rightTime
}

function parseDateValue(value: Challenge["dataInicio"] | Challenge["dataFim"]) {
  if (!value) return Number.POSITIVE_INFINITY
  if (value instanceof Date) return value.getTime()

  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00`).getTime()
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
  }

  const parsed = new Date(raw).getTime()
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function buildSections(items: Challenge[]) {
  const activeItems = items.filter((item) => getChallengeLifecycleStatus(item) === "ATIVO")
  const scheduledItems = items.filter((item) => getChallengeLifecycleStatus(item) === "AGENDADO")
  const closedItems = items.filter((item) => !["ATIVO", "AGENDADO"].includes(getChallengeLifecycleStatus(item)))

  return [
    {
      key: "active",
      title: "Em andamento",
      items: activeItems,
    },
    {
      key: "scheduled",
      title: "Agendadas",
      items: scheduledItems,
    },
    {
      key: "closed",
      title: "Encerradas",
      items: closedItems,
    },
  ].filter((section) => section.items.length > 0)
}
