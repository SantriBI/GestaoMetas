import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CalendarRange, ChevronUp, LoaderCircle, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { ChallengeStatusBadge } from "@/components/challenges/ChallengeStatusBadge"
import {
  formatCurrencyBRL,
  formatDateBR,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getChallengeLifecycleLabel,
  getChallengeLifecycleStatus,
  getChallengeMetaFocusLabel,
  getMetaTypeLabel,
  isClosedChallengeStatus,
  type Challenge,
  type ChallengeMeta,
} from "@/lib/challenges"

export function ChallengeCard({
  challenge,
  mode,
  onOpen,
  onAccept,
  onDismiss,
  detailsState = "closed",
  inlineExpansion,
}: {
  challenge: Challenge
  mode: "manager" | "seller"
  onOpen: (challenge: Challenge) => void
  onAccept?: (challenge: Challenge) => void
  onDismiss?: (challenge: Challenge) => void
  detailsState?: "closed" | "loading" | "open"
  inlineExpansion?: ReactNode
}) {
  const metas = challenge.participant?.metas ?? challenge.metas ?? []
  const participant = challenge.participant
  const kind = getChallengeCampaignKind(challenge)
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)
  const ctas = challenge.ctas ?? []
  const participantPotentialReward = formatCurrencyBRL(
    metas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
  )
  const participantUnlockedReward = formatCurrencyBRL(Number(participant?.premioTotalLiberado ?? 0))
  const participantProgress = Math.round(Number(participant?.resumo?.percentualGeral ?? 0))
  const isSellerAvailable = mode === "seller" && kind === "DESAFIO" && ["DISPONIVEL", "CONVIDADO"].includes(String(participant?.statusParticipacao ?? "").toUpperCase())
  const detailsButtonIcon = detailsState === "loading"
    ? <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />
    : detailsState === "open"
      ? <ChevronUp className="ml-2 h-4 w-4" />
      : <ArrowRight className="ml-2 h-4 w-4" />

  if (mode === "seller") {
    const progressBarClass = kind === "BONUS"
      ? "bg-gradient-to-r from-amber-400 to-orange-400"
      : participantProgress >= 100
        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
        : "bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400"

    const unlockedAmount = Number(participant?.premioTotalLiberado ?? 0)
    const totalMultiplier = metas.reduce((sum, m) => sum + (Number(m.multiplier) || 0), 0)
    const primaryMeta = metas[0] ?? null
    const isMissingTarget = primaryMeta?.tipoMeta === "PRODUTO_OU_MARCA" && !getChallengeMetaTargetSummary(primaryMeta)

    const participantStatus = String(participant?.statusParticipacao ?? "").toUpperCase()
    const isClosed = ["CONCLUIDO", "EXPIRADO"].includes(participantStatus) || isClosedChallengeStatus(lifecycleStatus)
    const isInProgress = ["ACEITO", "EM_ANDAMENTO"].includes(participantStatus)
    const openActionLabel = isClosed ? "Ver resultado" : isInProgress ? "Acompanhar agora" : "Ver detalhes"
    const detailsButtonLabel = detailsState === "loading" ? "Abrindo..." : detailsState === "open" ? "Fechar" : openActionLabel

    const lifecycleLabel = getChallengeLifecycleLabel(challenge)
    const isLifecycleClosed = isClosedChallengeStatus(lifecycleStatus)
    const isUrgent = lifecycleLabel.includes("24h")

    return (
      <article
        className={`rounded-[24px] border p-5 sm:p-6 ${
          kind === "BONUS"
            ? "border-amber-300/15 bg-[linear-gradient(160deg,rgba(14,18,30,0.98),rgba(10,13,21,0.98),rgba(100,45,12,0.10))]"
            : isSellerAvailable
              ? "border-cyan-300/20 bg-[linear-gradient(160deg,rgba(14,18,30,0.98),rgba(10,13,21,0.98),rgba(8,130,165,0.10))]"
              : "border-white/[0.08] bg-[linear-gradient(160deg,rgba(14,18,30,0.98),rgba(10,13,21,0.98))]"
        }`}
      >
        {/* Tags + data + lifecycle label */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest ${
            kind === "BONUS"
              ? "border-amber-300/22 bg-amber-300/[0.08] text-amber-100"
              : "border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100"
          }`}>
            {kind === "BONUS" ? "Bônus" : "Desafio"}
          </span>
          {participant && kind === "DESAFIO" ? (
            <ChallengeStatusBadge status={participant.statusParticipacao} scope="participant" />
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-white/28">
              {formatDateBR(challenge.dataInicio)} – {formatDateBR(challenge.dataFim)}
            </span>
            {lifecycleLabel ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                isLifecycleClosed
                  ? "border-white/10 bg-white/5 text-white/35"
                  : isUrgent
                    ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
              }`}>
                {lifecycleLabel}
              </span>
            ) : null}
          </div>
        </div>

        {/* Título + Prêmio */}
        <div className="mt-4 flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h3 className="text-xl font-bold tracking-tight text-white leading-snug">{challenge.titulo}</h3>
            {challenge.descricao ? (
              <p className="mt-1.5 text-[13px] leading-6 text-white/42 line-clamp-2">{challenge.descricao}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {unlockedAmount > 0 ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/70">Ganhos</p>
                <p className="mt-0.5 text-[22px] font-black tracking-tight text-emerald-300">{participantUnlockedReward}</p>
                <p className="mt-0.5 text-[11px] text-white/38">
                  {participantPotentialReward} por ciclo{totalMultiplier > 1 ? ` · ${totalMultiplier}×` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/32">Por ciclo</p>
                <p className="mt-0.5 text-[22px] font-black tracking-tight text-white">{participantPotentialReward}</p>
              </>
            )}
          </div>
        </div>

        {/* Progresso */}
        {isMissingTarget ? (
          <p className="mt-5 text-[12px] text-white/38">Em configuração pelo gerente</p>
        ) : (
          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-white/38">Progresso</span>
              <span className="text-sm font-bold text-white tabular-nums">{participantProgress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${progressBarClass}`}
                style={{ width: `${Math.min(Math.max(participantProgress, 0), 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-4">
          {isSellerAvailable && onAccept ? (
            <Button
              className="h-8 rounded-full bg-cyan-500 px-4 text-[13px] font-bold text-black hover:bg-cyan-400 active:scale-[0.98]"
              onClick={() => onAccept(challenge)}
            >
              Participar do desafio
            </Button>
          ) : null}

          {ctas.map((cta) => (
            <Button
              key={`${challenge.id}-${cta.label}`}
              asChild
              variant="outline"
              className="h-8 rounded-[12px] border-white/10 bg-white/[0.04] text-[13px] text-white hover:bg-white/[0.07]"
            >
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ))}

          <Button
            variant="outline"
            className={`ml-auto h-8 rounded-full border-white/10 text-[13px] text-white/65 hover:bg-white/[0.04] hover:text-white ${
              detailsState === "open" ? "bg-white/[0.05]" : "bg-transparent"
            }`}
            disabled={detailsState === "loading"}
            aria-expanded={detailsState === "open"}
            onClick={() => onOpen(challenge)}
          >
            {detailsButtonLabel}
            {detailsButtonIcon}
          </Button>

          {isSellerAvailable && onDismiss ? (
            <Button
              variant="ghost"
              className="h-8 rounded-full border border-white/10 px-3 text-[13px] text-white/50 hover:border-white/20 hover:bg-white/[0.03] hover:text-white/70"
              onClick={() => onDismiss(challenge)}
            >
              Recusar
            </Button>
          ) : null}
        </div>

        {/* Expansão inline — detalhe abre dentro do próprio card */}
        <Collapsible open={detailsState !== "closed"}>
          <CollapsibleContent
            forceMount
            className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
          >
            <div className="mt-5 border-t border-white/[0.07] pt-5">
              {detailsState === "loading" ? (
                <div className="space-y-4">
                  <div className="h-28 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
                  <div className="h-52 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
                </div>
              ) : (
                inlineExpansion ?? null
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </article>
    )
  }

  const detailsButtonLabel = detailsState === "loading" ? "Abrindo..." : detailsState === "open" ? "Fechar detalhes" : "Ver detalhes"
  const managerMetaHighlights = challenge.metas.slice(0, 3).map((meta: ChallengeMeta) => {
    const typeLabel = getMetaTypeLabel(meta.tipoMeta)
    const focusLabel = getChallengeMetaFocusLabel(meta)
    return focusLabel ? `${typeLabel}: ${focusLabel}` : typeLabel
  })
  const managerRemainingMetaCount = Math.max(challenge.metas.length - managerMetaHighlights.length, 0)

  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,39,0.98),rgba(8,13,24,0.98),rgba(15,23,42,0.94))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
              {getChallengeCampaignKindLabel(kind)}
            </span>
            <ChallengeStatusBadge status={lifecycleStatus} />
            <CampaignPill icon={<CalendarRange className="h-4 w-4 text-cyan-200" />} label={`${formatDateBR(challenge.dataInicio)} até ${formatDateBR(challenge.dataFim)}`} />
          </div>

          <h3 className="mt-3 text-xl font-black tracking-tight text-white">{challenge.titulo}</h3>

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/60">
            <CampaignPill icon={<Users className="h-4 w-4 text-emerald-200" />} label={`${challenge.stats.totalParticipants} participante(s)`} />
          </div>

          <p className="mt-3 text-sm leading-6 text-white/58">
            {managerMetaHighlights.length
              ? managerMetaHighlights.join(" | ")
              : "A meta aparece aqui assim que o cadastro for concluído."}
          </p>
        </div>

        <Button
          variant="outline"
          className={`shrink-0 rounded-2xl border-white/15 text-white hover:bg-white/10 ${
            detailsState === "open" ? "bg-white/10" : "bg-white/6"
          }`}
          disabled={detailsState === "loading"}
          aria-expanded={detailsState === "open"}
          onClick={() => onOpen(challenge)}
        >
          {detailsButtonLabel}
          {detailsButtonIcon}
        </Button>
      </div>
    </article>
  )
}

function CampaignPill({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      {icon}
      {label}
    </span>
  )
}
