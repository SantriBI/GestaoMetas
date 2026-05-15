"use client"

import { useState } from "react"
import { Flag, Pencil, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChallengeDetailsPanel } from "@/components/challenges/ChallengeDetailsPanel"
import { ChallengeEmptyState } from "@/components/challenges/ChallengeEmptyState"
import { ChallengeExpandableCard } from "@/components/challenges/ChallengeExpandableCard"
import { ChallengeInitializationWarning } from "@/components/challenges/ChallengeInitializationWarning"
import {
  getChallengeCampaignKindLabel,
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
  onEnd,
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
  onEnd: (challenge: Challenge) => void | Promise<void>
  onCancel: (challenge: Challenge) => void | Promise<void>
}) {
  const sortedItems = [...items].sort((left, right) => getStatusWeight(right.status) - getStatusWeight(left.status))
  const activeCount = items.filter((item) => item.status === "ATIVO").length
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleToggle(challenge: Challenge) {
    if (String(selectedChallenge?.id ?? "") === String(challenge.id)) {
      onClose()
      return
    }

    setOpeningId(String(challenge.id))
    try {
      await onOpen(challenge)
    } finally {
      setOpeningId((current) => (current === String(challenge.id) ? null : current))
    }
  }

  return (
    <section className="space-y-4">
      {!setup?.ready ? (
        <ChallengeInitializationWarning
          setup={setup}
          title="As tabelas do modulo de campanhas ainda nao foram localizadas no banco."
          description="Voce pode revisar a tela, mas a publicacao depende da persistencia do modulo."
          compact
        />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Carteira atual</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            {campaignKind === "BONUS" ? "Bonus mensais" : `${getChallengeCampaignKindLabel(campaignKind)}s publicados`}
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/72">
            {activeCount} ativa(s)
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/72">
            {items.length} campanha(s)
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-[240px] animate-pulse rounded-[30px] border border-white/8 bg-white/5" />
          ))}
        </div>
      ) : sortedItems.length ? (
        <>
          <div className="space-y-4">
            {sortedItems.map((challenge) => {
              const isOpen = String(selectedChallenge?.id ?? "") === String(challenge.id)
              const isLoading = openingId === String(challenge.id)
              const detailChallenge = isOpen ? selectedChallenge : null

              return (
                <ChallengeExpandableCard
                  key={challenge.id}
                  challenge={challenge}
                  mode="manager"
                  isOpen={isOpen}
                  isLoading={isLoading}
                  detailEyebrow={campaignKind === "BONUS" ? "Detalhes do bonus" : "Detalhes do desafio"}
                  detailTitle={detailChallenge?.titulo ?? challenge.titulo ?? (campaignKind === "BONUS" ? "Bonus mensal" : "Desafio")}
                  detailActions={
                    detailChallenge ? (
                      <>
                        <Button className="rounded-2xl bg-white/8 text-white hover:bg-white/12" onClick={() => onEdit(detailChallenge)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button className="rounded-2xl bg-amber-400/12 text-amber-100 hover:bg-amber-400/18" onClick={() => void onEnd(detailChallenge)}>
                          <Flag className="mr-2 h-4 w-4" />
                          Encerrar
                        </Button>
                        <Button className="rounded-2xl bg-rose-400/12 text-rose-100 hover:bg-rose-400/18" onClick={() => void onCancel(detailChallenge)}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                      </>
                    ) : null
                  }
                  detailContent={detailChallenge ? <ChallengeDetailsPanel challenge={detailChallenge} /> : null}
                  onToggle={() => void handleToggle(challenge)}
                  onClose={onClose}
                />
              )
            })}
          </div>
        </>
      ) : (
        <ChallengeEmptyState
          title={campaignKind === "BONUS" ? "Nenhum bonus mensal criado" : "Nenhum desafio criado"}
          description={campaignKind === "BONUS" ? "Assim que o primeiro bonus for publicado, ele aparece aqui." : "Assim que o primeiro desafio for publicado, ele aparece aqui."}
        />
      )}
    </section>
  )
}

function getStatusWeight(status: ChallengeStatus) {
  const weights: Record<ChallengeStatus, number> = {
    ATIVO: 5,
    AGENDADO: 4,
    RASCUNHO: 3,
    ENCERRADO: 2,
    CANCELADO: 1,
  }

  return weights[status]
}
