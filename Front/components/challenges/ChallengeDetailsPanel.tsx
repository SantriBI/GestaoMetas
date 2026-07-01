import type { ReactNode } from "react"
import { useState } from "react"
import { Award, ChevronDown, Coins, TrendingUp, Users } from "lucide-react"
import { ChallengePayoutReport } from "@/components/challenges/ChallengePayoutReport"
import { ChallengeParticipantsTable } from "@/components/challenges/ChallengeParticipantsTable"
import { ChallengeProgressList } from "@/components/challenges/ChallengeProgressList"
import { ChallengeStatusBadge } from "@/components/challenges/ChallengeStatusBadge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  formatCurrencyBRL,
  formatDateBR,
  formatMetaProgressValue,
  formatMetaValue,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getChallengeLifecycleStatus,
  getChallengeMetaFocusLabel,
  getMetaTypeLabel,
  type Challenge,
  type ChallengeMeta,
} from "@/lib/challenges"

export function ChallengeDetailsPanel({ challenge }: { challenge: Challenge }) {
  const participant = challenge.participant
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)
  const [showPayoutReport, setShowPayoutReport] = useState(false)

  if (participant) {
    const kind = getChallengeCampaignKind(challenge)
    const participantMetas = participant.metas ?? challenge.metas
    const potentialReward = participantMetas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
    const unlockedReward = Number(participant.premioTotalLiberado ?? 0)
    const progress = Math.round(Number(participant.resumo?.percentualGeral ?? 0))
    const totalMultiplier = participantMetas.reduce((sum, m) => sum + (Number(m.multiplier) || 0), 0)

    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(24,24,52,0.92))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.28)] sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            {kind === "DESAFIO" ? <ChallengeStatusBadge status={participant.statusParticipacao} scope="participant" /> : null}
            {kind === "BONUS" ? (
              <span className="rounded-full border border-amber-200/18 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-50">
                Bônus mensal automático
              </span>
            ) : null}
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="text-3xl font-black tracking-tight text-white">{challenge.titulo}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{challenge.descricao}</p>
            <p className="mt-4 text-sm font-semibold text-white/58">
              {kind === "BONUS" ? "Mês de referência" : "Prazo"}: {formatDateBR(challenge.dataInicio)} até {formatDateBR(challenge.dataFim)}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-white/8 pt-5 text-sm">
            <LinearStat label="Por ciclo" value={formatCurrencyBRL(potentialReward)} icon={<Award className="h-4 w-4 text-amber-200" />} />
            <LinearStat
              label={totalMultiplier > 1 ? `Ganhos (${totalMultiplier}× ciclos)` : "Prêmio liberado"}
              value={formatCurrencyBRL(unlockedReward)}
              icon={<Coins className="h-4 w-4 text-emerald-200" />}
            />
            <LinearStat label="Progresso geral" value={`${progress}%`} icon={<TrendingUp className="h-4 w-4 text-sky-200" />} />
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="text-2xl font-bold tracking-tight text-white">{kind === "BONUS" ? "Meta do seu bônus" : "Meta da sua missão"}</h3>
          <ChallengeProgressList metas={participantMetas} variant="list" />
        </section>
      </div>
    )
  }

  const kind = getChallengeCampaignKind(challenge)
  const meta = challenge.metas[0]

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(24,24,52,0.92))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.28)] sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
            {getChallengeCampaignKindLabel(kind)}
          </span>
          <ChallengeStatusBadge status={lifecycleStatus} />
        </div>

        <h2 className="mt-4 text-3xl font-black tracking-tight text-white">{challenge.titulo}</h2>
        <p className="mt-2 text-sm font-semibold text-white/58">
          {formatDateBR(challenge.dataInicio)} até {formatDateBR(challenge.dataFim)}
        </p>
      </div>

      <section className={detailPanelClass}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Participantes"
            value={`${challenge.stats.acceptedParticipants}/${challenge.stats.totalParticipants}`}
            icon={<Users className="h-4 w-4 text-cyan-200" />}
          />
          <SummaryCard
            label="Progresso médio"
            value={`${Math.round(challenge.stats.progressAverage)}%`}
            icon={<TrendingUp className="h-4 w-4 text-sky-200" />}
          />
          <SummaryCard
            label="Bônus pago / potencial"
            value={`${formatCurrencyBRL(challenge.impact.bonusPaid)} / ${formatCurrencyBRL(challenge.impact.bonusPotential)}`}
            icon={<Coins className="h-4 w-4 text-amber-200" />}
          />
          <SummaryCard
            label="Concluíram"
            value={`${challenge.stats.completedParticipants}/${challenge.stats.totalParticipants}`}
            icon={<Award className="h-4 w-4 text-emerald-200" />}
          />
        </div>
      </section>

      <section className={detailPanelClass}>
        <SectionHeader eyebrow="Meta" title={kind === "BONUS" ? "Meta do bônus" : "Meta do desafio"} />
        {meta ? <ChallengeMetaLine meta={meta} /> : <p className="text-sm leading-7 text-white/55">Nenhuma meta configurada.</p>}
      </section>

      <section className={detailPanelClass}>
        <SectionHeader eyebrow="Participação" title="Participação do time" />
        {challenge.participants?.length ? (
          <ChallengeParticipantsTable participants={challenge.participants} requiresAcceptance={challenge.exigeAceite} />
        ) : (
          <p className="text-sm leading-7 text-white/55">Nenhum participante vinculado a esta campanha.</p>
        )}
      </section>

      {challenge.participants?.length ? (
        <Collapsible open={showPayoutReport} onOpenChange={setShowPayoutReport}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-3.5 text-left transition hover:bg-white/[0.05]"
            >
              <span className="text-sm font-semibold text-white">
                {showPayoutReport ? "Ocultar relatório de pagamento" : "Ver relatório de pagamento"}
              </span>
              <ChevronDown className={`h-4 w-4 text-white/50 transition-transform duration-300 ${showPayoutReport ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="mt-4">
              <ChallengePayoutReport challenge={challenge} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}

function ChallengeMetaLine({ meta }: { meta: ChallengeMeta }) {
  const pct = Math.min(Math.max(Number(meta.percentualConclusao ?? 0), 0), 100)
  const focusLabel = getChallengeMetaFocusLabel(meta)

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-white/68">
          <span className="font-semibold text-white">{focusLabel ?? getMetaTypeLabel(meta.tipoMeta)}</span>
          {" · "}{formatMetaProgressValue(meta)} / {formatMetaValue(meta)}
        </span>
        <span className="rounded-full border border-amber-200/14 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
          Recompensa {formatCurrencyBRL(meta.recompensaValor)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-white">{title}</h3>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function LinearStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-white/55">{label}:</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}

const detailPanelClass = "rounded-[30px] border border-white/10 bg-white/[0.04] p-5"
