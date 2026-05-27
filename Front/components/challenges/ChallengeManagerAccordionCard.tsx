"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Clock3, Coins, Flag, Pencil, Sparkles, Target, TrendingUp, Users, Wallet, XCircle } from "lucide-react"
import { ChallengeParticipantsTable } from "@/components/challenges/ChallengeParticipantsTable"
import { ChallengePayoutReport } from "@/components/challenges/ChallengePayoutReport"
import { ChallengeProgressList } from "@/components/challenges/ChallengeProgressList"
import { ChallengeStatusBadge } from "@/components/challenges/ChallengeStatusBadge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  formatCurrencyBRL,
  formatDateBR,
  getChallengeDateInputValue,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getChallengeLifecycleLabel,
  getChallengeLifecycleStatus,
  getChallengeMetaFocusLabel,
  getChallengeMetaTargetSummary,
  getChallengeStatusLabel,
  formatMetaProgressValue,
  formatMetaValue,
  parseChallengeDateTime,
  type Challenge,
  type ChallengeMeta,
} from "@/lib/challenges"

export function ChallengeManagerAccordionCard({
  challenge,
  isOpen,
  isLoading = false,
  onEdit,
  onEnd,
  onCancel,
}: {
  challenge: Challenge
  isOpen: boolean
  isLoading?: boolean
  onEdit: (challenge: Challenge) => void
  onEnd: (challenge: Challenge) => void | Promise<void>
  onCancel: (challenge: Challenge) => void | Promise<void>
}) {
  const [showPayoutPreview, setShowPayoutPreview] = useState(false)
  const kind = getChallengeCampaignKind(challenge)
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)
  const lifecycleLabel = getChallengeLifecycleLabel(challenge)
  const focusLabels = Array.from(
    new Set(
      challenge.metas
        .map((meta) => getChallengeMetaFocusLabel(meta))
        .filter((value): value is string => Boolean(value))
    )
  )
  const campaignDescription = challenge.descricao?.trim()
    || (kind === "BONUS"
      ? "Bonus mensal com leitura automatica."
      : "Campanha com prazo e meta definida.")
  const totalReward = challenge.metas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
  const adherenceRate = Math.round(Number(challenge.stats.adherenceRate ?? 0))
  const completionRate = Math.round(Number(challenge.stats.completionRate ?? 0))
  const acceptedParticipants = Number(challenge.stats.acceptedParticipants ?? 0)
  const totalParticipants = Number(challenge.stats.totalParticipants ?? 0)
  const completedParticipants = Number(challenge.stats.completedParticipants ?? 0)
  const summaryActionLabel = isLoading ? "Abrindo..." : isOpen ? "Fechar analise" : "Analisar campanha"
  const insights = buildCampaignInsights(challenge, lifecycleStatus, adherenceRate, completionRate)
  const primaryRuleMeta = getPrimaryRuleMeta(challenge)
  const primaryRuleFocus = primaryRuleMeta ? getRuleFocusSummary(primaryRuleMeta) : null
  const adherenceBadge = getAdherenceBadgeConfig(acceptedParticipants, totalParticipants)

  useEffect(() => {
    if (!isOpen) {
      setShowPayoutPreview(false)
    }
  }, [isOpen])

  return (
    <AccordionItem
      value={String(challenge.id)}
      className={`overflow-hidden rounded-[30px] border border-b-0 transition-all duration-300 ${
        isOpen
          ? "border-white/[0.08] bg-white/[0.04] shadow-[0_22px_60px_rgba(0,0,0,0.22)]"
          : "border-white/[0.05] bg-white/[0.03] shadow-[0_14px_34px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 hover:border-white/[0.08] hover:bg-white/[0.045] hover:shadow-[0_22px_48px_rgba(0,0,0,0.2)]"
      }`}
    >
      <AccordionTrigger className="px-5 py-4 text-left hover:no-underline focus-visible:ring-0 [&>svg]:hidden sm:px-6 sm:py-4.5">
        <div className="flex w-full flex-col gap-4.5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                {getChallengeCampaignKindLabel(kind)}
              </span>
              <ChallengeStatusBadge status={lifecycleStatus} />
              {challenge.metas.length ? <SurfacePill icon={<Target className="h-4 w-4 text-cyan-200" />} label={`${challenge.metas.length} meta(s)`} /> : null}
              <AdherencePill
                icon={<Users className={`h-4 w-4 ${adherenceBadge.iconClassName}`} />}
                label={`${acceptedParticipants}/${totalParticipants} ${totalParticipants === 1 ? "participante" : "participantes"}`}
                className={adherenceBadge.className}
              />
            </div>

            <h3 className="mt-4 text-[1.55rem] font-black tracking-tight text-white sm:text-[1.75rem]">{challenge.titulo}</h3>

            <div className="mt-3.5 flex flex-wrap gap-2.5 text-sm text-white/58">
              <SurfacePill
                icon={<Sparkles className="h-4 w-4 text-amber-200" />}
                label={`${formatDateBR(challenge.dataInicio)} ate ${formatDateBR(challenge.dataFim)}`}
              />
              <SurfacePill icon={<Clock3 className="h-4 w-4 text-amber-200" />} label={lifecycleLabel} />
            </div>

            <div className="mt-3.5 flex flex-wrap gap-2">
              {insights.map((insight) => (
                <InsightBadge key={insight.message} tone={insight.tone} icon={insight.icon} message={insight.message} />
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3.5 xl:max-w-[540px]">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetric
                label="Impacto"
                value={formatCurrencyBRL(challenge.impact.estimatedRevenue)}
                helper={challenge.impact.estimatedRevenue > 0 ? undefined : "Sem previsao"}
              />
              <SummaryMetric
                label="Bonus"
                value={formatCurrencyBRL(challenge.impact.bonusPotential)}
                helper={challenge.impact.bonusPotential > 0 ? undefined : "Zerado"}
              />
              <SummaryMetric
                label="Faturado"
                value={formatCurrencyBRL(challenge.impact.realizedRevenue)}
                helper={challenge.impact.realizedRevenue > 0 ? undefined : "Sem receita"}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="hidden sm:block" />
              <span className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                isOpen
                  ? "border-white/[0.08] bg-white/[0.07] text-white"
                  : "border-white/[0.08] bg-white text-black"
              }`}>
                <BarChart3 className="h-4 w-4" />
                {summaryActionLabel}
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </span>
            </div>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="pb-0">
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                <div className="h-40 animate-pulse rounded-[26px] border border-white/8 bg-white/5" />
                <div className="h-40 animate-pulse rounded-[26px] border border-white/8 bg-white/5" />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="h-72 animate-pulse rounded-[26px] border border-white/8 bg-white/5" />
                <div className="h-72 animate-pulse rounded-[26px] border border-white/8 bg-white/5" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <section className={panelClass}>
                <SectionHeader title="KPIs" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailMetric label="Impacto estimado" value={formatCurrencyBRL(challenge.impact.estimatedRevenue)} icon={<TrendingUp className="h-4 w-4 text-emerald-200" />} />
                  <DetailMetric label="Bonus potencial" value={formatCurrencyBRL(challenge.impact.bonusPotential)} icon={<Wallet className="h-4 w-4 text-amber-200" />} />
                  <DetailMetric label="Bonus pago" value={formatCurrencyBRL(challenge.impact.bonusPaid)} icon={<Coins className="h-4 w-4 text-cyan-200" />} />
                  <DetailMetric label="Faturado" value={formatCurrencyBRL(challenge.impact.realizedRevenue)} icon={<TrendingUp className="h-4 w-4 text-sky-200" />} />
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
                <section className={panelClass}>
                  <SectionHeader title="Regras" />
                  <div className="space-y-4">
                    {primaryRuleMeta && primaryRuleFocus ? (
                      <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-300/[0.06] p-4">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))]">
                          <CompactRuleMetric label={primaryRuleFocus.label} value={primaryRuleFocus.value} />
                          <CompactRuleMetric label="Meta" value={formatMetaValue(primaryRuleMeta)} />
                          <CompactRuleMetric label="Recompensa" value={formatCurrencyBRL(Number(primaryRuleMeta.recompensaValor ?? 0))} />
                          <CompactRuleMetric label="Atual" value={formatMetaProgressValue(primaryRuleMeta)} />
                        </div>
                      </div>
                    ) : null}
                    <p className="text-sm leading-7 text-white/64">{campaignDescription}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniMetric label="Periodo" value={`${formatDateBR(challenge.dataInicio)} ate ${formatDateBR(challenge.dataFim)}`} />
                      <MiniMetric label="Participacao" value={challenge.exigeAceite ? "Com aceite" : "Automatica"} />
                    </div>
                    {focusLabels.length ? (
                      <div className="flex flex-wrap gap-2">
                        {focusLabels.map((label) => (
                          <span key={label} className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-semibold text-cyan-50">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <ChallengeProgressList metas={challenge.metas} variant="list" />
                  </div>
                </section>

                <section className={panelClass}>
                  <SectionHeader title="Progresso" />
                  <div className="space-y-4">
                    <ProgressRow
                      label="Adesao"
                      value={adherenceRate}
                      description={`${acceptedParticipants}/${totalParticipants || 0} aderiram`}
                      tone="cyan"
                    />
                    <ProgressRow
                      label="Conclusao"
                      value={completionRate}
                      description={`${completedParticipants} concluiram`}
                      tone="emerald"
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniMetric label="Participantes" value={String(challenge.stats.totalParticipants)} />
                      <MiniMetric label="Atingimento medio" value={`${Math.round(challenge.stats.progressAverage)}%`} />
                      <MiniMetric label="Premio configurado" value={formatCurrencyBRL(totalReward)} />
                      <MiniMetric label="Bonus pago" value={formatCurrencyBRL(challenge.impact.bonusPaid)} />
                    </div>

                    {challenge.participants?.length ? (
                      <ChallengeParticipantsTable participants={challenge.participants} requiresAcceptance={challenge.exigeAceite} />
                    ) : (
                      <p className="text-sm leading-7 text-white/55">Sem participantes.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className={panelClass}>
                <SectionHeader title="Acoes" />
                <div className="space-y-3.5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2.5">
                      <CompactActionButton className="bg-white/8 text-white hover:bg-white/12" onClick={() => onEdit(challenge)} icon={<Pencil className="h-4 w-4" />}>
                        Editar
                      </CompactActionButton>
                      <CompactActionButton className="bg-amber-400/12 text-amber-100 hover:bg-amber-400/18" onClick={() => void onEnd(challenge)} icon={<Flag className="h-4 w-4" />}>
                        Encerrar
                      </CompactActionButton>
                      <CompactActionButton className="bg-rose-400/12 text-rose-100 hover:bg-rose-400/18" onClick={() => void onCancel(challenge)} icon={<XCircle className="h-4 w-4" />}>
                        Cancelar
                      </CompactActionButton>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-3 xl:min-w-[360px]">
                      <MiniMetric label="Status" value={getChallengeStatusLabel(lifecycleStatus)} />
                      <MiniMetric label="Janela" value={lifecycleLabel} />
                      <MiniMetric label="Metas" value={`${challenge.metas.length}`} />
                    </div>
                  </div>

                  {challenge.participants?.length ? (
                    <Collapsible open={showPayoutPreview} onOpenChange={setShowPayoutPreview} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Pagamento</p>
                          <p className="mt-1.5 text-sm font-semibold text-white">{showPayoutPreview ? "Previa aberta" : "Gerar sob demanda"}</p>
                        </div>

                        <CollapsibleTrigger asChild>
                          <Button className="h-10 rounded-xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] px-4 text-sm font-semibold text-black hover:opacity-95">
                            <Wallet className="mr-2 h-4 w-4" />
                            {showPayoutPreview ? "Ocultar previa" : "Ver previa de pagamento"}
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <div className="mt-4 border-t border-white/8 pt-4">
                          <ChallengePayoutReport challenge={challenge} compact />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </div>
              </section>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function SurfacePill({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5">
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}

function AdherencePill({
  icon,
  label,
  className,
}: {
  icon: ReactNode
  label: string
  className: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${className}`}>
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.03] p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white sm:text-base">{value}</p>
      {helper ? <p className="mt-1 text-[11px] leading-5 text-white/42">{helper}</p> : null}
    </div>
  )
}

function DetailMetric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {icon}
        {label}
      </div>
      <p className="mt-2.5 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white sm:text-base">{value}</p>
    </div>
  )
}

function CompactRuleMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-[18px] border border-white/[0.05] bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-white sm:text-base">{value}</p>
    </div>
  )
}

function CompactActionButton({
  className,
  onClick,
  icon,
  children,
}: {
  className: string
  onClick: () => void | Promise<void>
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Button
      className={`h-10 rounded-xl border border-transparent px-4 text-sm font-semibold shadow-none ${className}`}
      onClick={() => void onClick()}
    >
      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
        {icon}
      </span>
      {children}
    </Button>
  )
}

function SectionHeader({
  title,
}: {
  title: string
}) {
  return (
    <div className="mb-3.5">
      <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
    </div>
  )
}

function InsightBadge({
  tone,
  icon,
  message,
}: {
  tone: "warning" | "positive" | "urgent" | "info"
  icon: ReactNode
  message: string
}) {
  const toneClassMap = {
    warning: "border-rose-300/12 bg-rose-400/[0.08] text-rose-100/88",
    positive: "border-emerald-300/12 bg-emerald-400/[0.08] text-emerald-100/88",
    urgent: "border-amber-300/12 bg-amber-400/[0.08] text-amber-100/88",
    info: "border-cyan-300/12 bg-cyan-400/[0.08] text-cyan-100/88",
  } as const

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClassMap[tone]}`}>
      {icon}
      {message}
    </span>
  )
}

function ProgressRow({
  label,
  value,
  description,
  tone,
}: {
  label: string
  value: number
  description: string
  tone: "cyan" | "emerald"
}) {
  const gradient = tone === "emerald"
    ? "bg-[linear-gradient(90deg,#34d399,#22c55e,#84cc16)]"
    : "bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#38bdf8)]"

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="text-sm font-semibold text-white">{Math.round(value)}%</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-white/48">{description}</p>
      <div className="mt-3 h-2.5 rounded-full bg-white/10">
        <div
          className={`h-2.5 rounded-full ${gradient} transition-[width] duration-700 ease-out`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}

function buildCampaignInsights(
  challenge: Challenge,
  lifecycleStatus: ReturnType<typeof getChallengeLifecycleStatus>,
  adherenceRate: number,
  completionRate: number
) {
  const insights: Array<{
    tone: "warning" | "positive" | "urgent" | "info"
    icon: ReactNode
    message: string
  }> = []
  const remainingDays = getRemainingDays(challenge, lifecycleStatus)

  if (lifecycleStatus === "ATIVO" && adherenceRate === 0) {
    insights.push({
      tone: "warning",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      message: "Sem adesao",
    })
  }

  if (lifecycleStatus === "ATIVO" && remainingDays !== null && remainingDays > 0 && remainingDays <= 1) {
    insights.push({
      tone: "urgent",
      icon: <Clock3 className="h-3.5 w-3.5" />,
      message: "Ultimas 24h",
    })
  }

  if (lifecycleStatus === "ATIVO" && completionRate > 50) {
    insights.push({
      tone: "positive",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      message: "Conclusao alta",
    })
  }

  if (lifecycleStatus === "AGENDADO") {
    insights.push({
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      message: "Preparar lancamento",
    })
  }

  if (!insights.length) {
    insights.push({
      tone: "info",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      message: "Acompanhar agora",
    })
  }

  return insights.slice(0, 2)
}

function getRemainingDays(challenge: Challenge, lifecycleStatus: ReturnType<typeof getChallengeLifecycleStatus>) {
  if (lifecycleStatus !== "ATIVO") return null
  const endValue = getChallengeDateInputValue(challenge.dataFim)
  const endDate = endValue ? parseChallengeDateTime(endValue, "end") : null
  if (!endDate) return null

  const now = new Date()
  const diff = endDate.getTime() - now.getTime()
  return Math.max(Math.ceil(diff / 86400000), 0)
}

function getPrimaryRuleMeta(challenge: Challenge) {
  return challenge.metas.find((meta) => Boolean(getRuleFocusSummary(meta))) ?? null
}

function getRuleFocusSummary(meta: ChallengeMeta) {
  const target = getChallengeMetaTargetSummary(meta)
  if (target) {
    return {
      label: target.label,
      value: target.value,
    }
  }

  const fallbackLabel = getChallengeMetaFocusLabel(meta)
  return fallbackLabel
    ? {
        label: "Produto ou marca",
        value: fallbackLabel,
      }
    : null
}

function getAdherenceBadgeConfig(acceptedParticipants: number, totalParticipants: number) {
  if (totalParticipants <= 0) {
    return {
      className: "border-white/[0.06] bg-white/[0.04] text-white/64",
      iconClassName: "text-white/58",
    }
  }

  const adherence = acceptedParticipants / totalParticipants

  if (adherence >= 0.7) {
    return {
      className: "border-emerald-300/12 bg-emerald-400/[0.08] text-emerald-100/88",
      iconClassName: "text-emerald-200",
    }
  }

  if (adherence >= 0.35) {
    return {
      className: "border-white/[0.06] bg-white/[0.04] text-white/72",
      iconClassName: "text-white/62",
    }
  }

  return {
    className: acceptedParticipants === 0
      ? "border-rose-300/12 bg-rose-400/[0.08] text-rose-100/88"
      : "border-amber-300/12 bg-amber-400/[0.08] text-amber-100/88",
    iconClassName: acceptedParticipants === 0 ? "text-rose-200" : "text-amber-200",
  }
}

const panelClass = "rounded-[24px] border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5"
