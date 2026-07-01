"use client"

import { Wand2 } from "lucide-react"
import { ChallengeInitializationWarning } from "@/components/challenges/ChallengeInitializationWarning"
import { ChallengeWizard } from "@/components/challenges/ChallengeWizard"
import {
  getChallengeCampaignKindLabel,
  type Challenge,
  type ChallengeCampaignKind,
  type ChallengeFormPayload,
  type ChallengeMetadata,
  type ChallengeModuleSetup,
} from "@/lib/challenges"

export function ChallengeInlineWizard({
  editingChallenge,
  campaignKind,
  metadata,
  saving,
  setup,
  createdBy,
  actionError,
  onCancel,
  onSubmit,
}: {
  editingChallenge?: Challenge | null
  campaignKind: ChallengeCampaignKind
  metadata?: ChallengeMetadata | null
  saving?: boolean
  setup?: ChallengeModuleSetup | null
  createdBy?: string
  actionError?: string | null
  onCancel: () => void
  onSubmit: (payload: ChallengeFormPayload, id?: number | string) => Promise<Challenge | null> | Challenge | null
}) {
  const title = editingChallenge
    ? `Editar ${getChallengeCampaignKindLabel(campaignKind).toLowerCase()}`
    : campaignKind === "BONUS"
      ? "Nova rotina de bônus"
      : "Novo desafio"

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.18)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58">
              <Wand2 className="h-4 w-4" />
              Criação inline
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{title}</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/54">Preencha o essencial: nome, meta, recompensa e prazo.</p>
        </div>
      </div>

      {setup && !setup.ready ? (
        <ChallengeInitializationWarning
          setup={setup}
          title="As tabelas do módulo de campanhas ainda não foram localizadas no banco."
          description={`Você pode montar ${campaignKind === "BONUS" ? "o bônus" : "o desafio"}, mas a publicação depende da persistência do módulo.`}
          compact
        />
      ) : null}

      {actionError && actionError !== setup?.error ? (
        <div className="rounded-[24px] border border-rose-300/18 bg-rose-400/10 p-5 text-sm leading-7 text-rose-100">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[32px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.015))] shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
        <ChallengeWizard
          open
          campaignKind={campaignKind}
          onCancel={onCancel}
          onSubmit={onSubmit}
          saving={saving}
          editingChallenge={editingChallenge}
          metadata={metadata}
          createdBy={createdBy}
          moduleSetup={setup}
        />
      </div>
    </section>
  )
}
