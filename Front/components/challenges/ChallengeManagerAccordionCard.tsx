"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Clock3, Pencil, Sparkles, Target, TrendingUp, Users, Wallet, XCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChallengeParticipantsTable } from "@/components/challenges/ChallengeParticipantsTable"
import { ChallengePayoutReport } from "@/components/challenges/ChallengePayoutReport"
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
  getChallengeMetaTargetSummary,
  formatMetaProgressValue,
  formatMetaValue,
  parseChallengeDateTime,
  type Challenge,
  type ChallengeMeta,
  type ChallengeParticipant,
} from "@/lib/challenges"

export function ChallengeManagerAccordionCard({
  challenge,
  isOpen,
  isLoading = false,
  onEdit,
  onCancel,
}: {
  challenge: Challenge
  isOpen: boolean
  isLoading?: boolean
  onEdit: (challenge: Challenge) => void
  onCancel: (challenge: Challenge) => void | Promise<void>
}) {
  const [showPayoutPreview, setShowPayoutPreview] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const kind = getChallengeCampaignKind(challenge)
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)
  const lifecycleLabel = getChallengeLifecycleLabel(challenge)
  const adherenceRate = Math.round(Number(challenge.stats.adherenceRate ?? 0))
  const completionRate = Math.round(Number(challenge.stats.completionRate ?? 0))
  const acceptedParticipants = Number(challenge.stats.acceptedParticipants ?? 0)
  const totalParticipants = Number(challenge.stats.totalParticipants ?? 0)
  const summaryActionLabel = isLoading ? "Abrindo..." : isOpen ? "Fechar análise" : "Analisar campanha"
  const insights = buildCampaignInsights(challenge, lifecycleStatus, adherenceRate, completionRate)
  const adherenceBadge = getAdherenceBadgeConfig(acceptedParticipants, totalParticipants)
  const primaryMeta = challenge.metas[0] ?? null

  useEffect(() => {
    if (!isOpen) {
      setShowPayoutPreview(false)
      setShowCancelConfirm(false)
    }
  }, [isOpen])

  function handleConfirmCancel() {
    setShowCancelConfirm(false)
    void onCancel(challenge)
  }

  return (
    <AccordionItem
      value={String(challenge.id)}
      className={`overflow-hidden rounded-[30px] border border-b-0 transition-[border-color,background-color,transform] duration-300 ${
        isOpen
          ? "border-white/[0.08] bg-white/[0.04] shadow-[0_22px_60px_rgba(0,0,0,0.22)]"
          : "border-white/[0.05] bg-white/[0.03] shadow-[0_14px_34px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 hover:border-white/[0.08] hover:bg-white/[0.045]"
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
                label={`${formatDateBR(challenge.dataInicio)} até ${formatDateBR(challenge.dataFim)}`}
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
                label="Bônus pago"
                value={formatCurrencyBRL(challenge.impact.bonusPaid)}
                helper={challenge.impact.bonusPaid > 0 ? undefined : "Sem pagamento ainda"}
              />
              <SummaryMetric
                label="Bônus potencial"
                value={formatCurrencyBRL(challenge.impact.bonusPotential)}
                helper={challenge.impact.bonusPotential > 0 ? undefined : "Zerado"}
              />
              <SummaryMetric
                label="Participantes"
                value={`${acceptedParticipants}/${totalParticipants}`}
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
              <div className="h-14 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
              <div className="h-32 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
              <div className="h-24 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
            </div>
          ) : (
            <div className="space-y-4">
              <section className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CompactActionButton className="bg-white/8 text-white hover:bg-white/12" onClick={() => onEdit(challenge)} icon={<Pencil className="h-4 w-4" />}>
                    Editar
                  </CompactActionButton>
                  <CompactActionButton className="bg-rose-400/12 text-rose-100 hover:bg-rose-400/18" onClick={() => setShowCancelConfirm(true)} icon={<XCircle className="h-4 w-4" />}>
                    Cancelar campanha
                  </CompactActionButton>
                </div>
              </section>

              <section className={panelClass}>
                <SectionHeader title={kind === "BONUS" ? "Meta do bônus" : "Meta do desafio"} />
                {primaryMeta ? <ManagerMetaBlock meta={primaryMeta} /> : <p className="text-sm leading-7 text-white/55">Nenhuma meta configurada.</p>}
              </section>

              <section className={panelClass}>
                <SectionHeader title="Vendedores" />
                {challenge.participants?.length ? (
                  <ManagerParticipantsSection participants={challenge.participants} requiresAcceptance={challenge.exigeAceite} />
                ) : (
                  <p className="text-sm leading-7 text-white/55">Sem participantes.</p>
                )}
              </section>

              {challenge.participants?.length ? (
                <Collapsible open={showPayoutPreview} onOpenChange={setShowPayoutPreview} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Pagamento</p>
                      <p className="mt-1.5 text-sm font-semibold text-white">{showPayoutPreview ? "Prévia aberta" : "Gerar sob demanda"}</p>
                    </div>

                    <CollapsibleTrigger asChild>
                      <Button className="h-10 rounded-xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] px-4 text-sm font-semibold text-black hover:opacity-95">
                        <Wallet className="mr-2 h-4 w-4" />
                        {showPayoutPreview ? "Ocultar prévia" : "Ver prévia de pagamento"}
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
          )}
        </div>
      </AccordionContent>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta campanha?</AlertDialogTitle>
            <AlertDialogDescription>Bônus pendentes não serão pagos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleConfirmCancel}>
              Cancelar campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccordionItem>
  )
}

function ManagerMetaBlock({ meta }: { meta: ChallengeMeta }) {
  const target = getChallengeMetaTargetSummary(meta)
  const isMissingTarget = meta.tipoMeta === "PRODUTO_OU_MARCA" && target === null
  const typeLabel = target?.kind === "BRAND"
    ? "Marca: todos os produtos"
    : target?.kind === "PRODUCT"
      ? "Produto específico"
      : "Produto ou marca"
  const pct = Math.min(Math.max(Number(meta.percentualConclusao ?? 0), 0), 100)

  if (isMissingTarget) {
    return (
      <div className="rounded-[24px] border border-amber-400/25 bg-amber-400/[0.07] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/15">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-200">Produto ou marca não configurado</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Esta meta precisa de um produto ou marca para medir o progresso. Use "Editar" acima para configurar.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-300/[0.06] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10">
            <Target className="h-5 w-5 text-cyan-200" />
          </span>
          <div>
            <p className="text-base font-semibold text-white">{target?.value ?? "Meta não configurada"}</p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">{typeLabel}</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
          Recompensa {formatCurrencyBRL(Number(meta.recompensaValor ?? 0))}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">{formatMetaProgressValue(meta)} de {formatMetaValue(meta)}</span>
          <span className="font-semibold text-white">{Math.round(pct)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function ManagerParticipantsSection({
  participants,
  requiresAcceptance,
}: {
  participants: ChallengeParticipant[]
  requiresAcceptance: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const achievedCount = participants.filter((participant) => Number(participant.resumo?.percentualGeral ?? 0) >= 100).length
  const achievedPct = participants.length ? Math.round((achievedCount / participants.length) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-white/68">
          <Users className="h-4 w-4 text-cyan-200" />
          <span className="font-semibold text-white">{achievedPct}%</span> dos vendedores já atingiram a meta
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setExpanded((current) => !current)}
          className="h-9 rounded-xl border-white/12 bg-white/5 px-4 text-xs font-semibold text-white hover:bg-white/10"
        >
          {expanded ? "Ocultar" : `Ver todos (${participants.length})`}
          <ChevronDown className={`ml-2 h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {expanded ? <ChallengeParticipantsTable participants={participants} requiresAcceptance={requiresAcceptance} /> : null}
    </div>
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
  const primaryMeta = challenge.metas[0] ?? null

  if (primaryMeta?.tipoMeta === "PRODUTO_OU_MARCA" && !getChallengeMetaTargetSummary(primaryMeta)) {
    insights.push({
      tone: "warning",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      message: "Produto ou marca não configurado",
    })
  }

  if (lifecycleStatus === "ATIVO" && adherenceRate === 0) {
    insights.push({
      tone: "warning",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      message: "Sem adesão",
    })
  }

  if (lifecycleStatus === "ATIVO" && remainingDays !== null && remainingDays > 0 && remainingDays <= 1) {
    insights.push({
      tone: "urgent",
      icon: <Clock3 className="h-3.5 w-3.5" />,
      message: "Últimas 24h",
    })
  }

  if (lifecycleStatus === "ATIVO" && completionRate > 50) {
    insights.push({
      tone: "positive",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      message: "Conclusão alta",
    })
  }

  if (lifecycleStatus === "AGENDADO") {
    insights.push({
      tone: "info",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      message: "Preparar lançamento",
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
