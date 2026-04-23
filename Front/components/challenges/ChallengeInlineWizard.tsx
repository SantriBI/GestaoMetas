"use client"

import { Wand2 } from "lucide-react"
import { ChallengeInitializationWarning } from "@/components/challenges/ChallengeInitializationWarning"
import { ChallengeWizard } from "@/components/challenges/ChallengeWizard"
import {
  getChallengeCampaignKindLabel,
  type Challenge,
  type ChallengeCampaignKind,
  type ChallengeFormPayload,
  type ChallengeImpactPreviewResponse,
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
  onEstimateImpact,
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
  onEstimateImpact: (payload: ChallengeFormPayload) => Promise<ChallengeImpactPreviewResponse | null>
}) {
  const title = editingChallenge
    ? `Editar ${getChallengeCampaignKindLabel(campaignKind).toLowerCase()}`
    : `Nova ${campaignKind === "BONUS" ? "rotina de bonus" : "campanha"}`

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(24,24,52,0.92))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.32)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Wand2 className="h-4 w-4" />
              Criacao inline
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{title}</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/62">Preencha so o essencial: nome, metas, recompensa, prazo e impacto.</p>
        </div>
      </div>

      {!setup?.ready ? (
        <ChallengeInitializationWarning
          setup={setup}
          title="A central de campanhas ainda precisa ser liberada no banco."
          description="Voce pode montar a campanha, mas a publicacao depende da inicializacao."
          compact
        />
      ) : null}

      {actionError && actionError !== setup?.error ? (
        <div className="rounded-[24px] border border-rose-300/18 bg-rose-400/10 p-5 text-sm leading-7 text-rose-100">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,24,0.98),rgba(2,8,23,0.98))] shadow-[0_30px_100px_rgba(2,6,23,0.24)]">
        <ChallengeWizard
          open
          campaignKind={campaignKind}
          onCancel={onCancel}
          onSubmit={onSubmit}
          onEstimateImpact={onEstimateImpact}
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
