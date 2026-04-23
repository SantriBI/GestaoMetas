"use client"

import type { ReactNode } from "react"
import { Eye, PlusCircle } from "lucide-react"
import type { ChallengeCampaignKind } from "@/lib/challenges"

type ChallengesMode = "create" | "list"

export function ChallengesModeSwitcher({
  mode,
  campaignKind,
  activeCount,
  totalCount,
  onChange,
}: {
  mode: ChallengesMode
  campaignKind: ChallengeCampaignKind
  activeCount: number
  totalCount: number
  onChange: (mode: ChallengesMode) => void
}) {
  const createMeta = campaignKind === "BONUS" ? "Bonus mensal com fluxo inline." : "Campanha com fluxo inline."

  return (
    <section className="flex flex-wrap gap-3">
      <ModeCard
        title="Criar nova campanha"
        description={createMeta}
        icon={<PlusCircle className="h-5 w-5" />}
        active={mode === "create"}
        onClick={() => onChange("create")}
      />
      <ModeCard
        title="Ver campanhas ativas"
        description={`${activeCount} ativa(s) de ${totalCount} nesta visao.`}
        icon={<Eye className="h-5 w-5" />}
        active={mode === "list"}
        onClick={() => onChange("list")}
      />
    </section>
  )
}

function ModeCard({
  title,
  description,
  icon,
  active,
  onClick,
}: {
  title: string
  description: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[250px] flex-1 rounded-[24px] border px-5 py-4 text-left transition ${
        active
          ? "border-cyan-300/24 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_60px_rgba(2,6,23,0.18)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/16 hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58">
            {icon}
            {active ? "Ativo" : "Acao"}
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
        </div>

        <div
          className={`mt-1 h-3 w-3 rounded-full transition ${
            active ? "bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.45)]" : "bg-white/20"
          }`}
        />
      </div>
    </button>
  )
}
