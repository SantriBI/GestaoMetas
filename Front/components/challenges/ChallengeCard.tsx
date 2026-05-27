import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CalendarRange, ChevronUp, Coins, LoaderCircle, Target, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChallengeStatusBadge } from "@/components/challenges/ChallengeStatusBadge"
import {
  formatCurrencyBRL,
  formatDateBR,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getChallengeLifecycleStatus,
  getMetaTypeLabel,
  type Challenge,
} from "@/lib/challenges"

export function ChallengeCard({
  challenge,
  mode,
  onOpen,
  onAccept,
  onDismiss,
  detailsState = "closed",
}: {
  challenge: Challenge
  mode: "manager" | "seller"
  onOpen: (challenge: Challenge) => void
  onAccept?: (challenge: Challenge) => void
  onDismiss?: (challenge: Challenge) => void
  detailsState?: "closed" | "loading" | "open"
}) {
  const metas = challenge.participant?.metas ?? challenge.metas ?? []
  const participant = challenge.participant
  const impact = challenge.impact
  const kind = getChallengeCampaignKind(challenge)
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)
  const ctas = challenge.ctas ?? []
  const participantPotentialReward = formatCurrencyBRL(
    metas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
  )
  const participantUnlockedReward = formatCurrencyBRL(Number(participant?.premioTotalLiberado ?? 0))
  const participantProgress = Math.round(Number(participant?.resumo?.percentualGeral ?? 0))
  const completedMetas = Number(participant?.resumo?.metasConcluidas ?? 0)
  const totalMetas = Number(participant?.resumo?.totalMetas ?? metas.length)
  const isSellerAvailable = mode === "seller" && kind === "DESAFIO" && ["DISPONIVEL"].includes(participant?.statusParticipacao ?? "")
  const metaHighlights = metas.slice(0, 2).map((meta) => getMetaTypeLabel(meta.tipoMeta))
  const remainingMetaCount = Math.max(metas.length - metaHighlights.length, 0)
  const detailsButtonLabel = detailsState === "loading" ? "Abrindo..." : detailsState === "open" ? "Fechar detalhes" : "Ver detalhes"
  const detailsButtonIcon = detailsState === "loading"
    ? <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />
    : detailsState === "open"
      ? <ChevronUp className="ml-2 h-4 w-4" />
      : <ArrowRight className="ml-2 h-4 w-4" />

  if (mode === "seller") {
    return (
      <article
        className={`rounded-[30px] border p-6 shadow-[0_26px_90px_rgba(0,0,0,0.22)] ${
          kind === "BONUS"
            ? "border-amber-300/14 bg-[linear-gradient(145deg,rgba(17,24,39,0.96),rgba(8,13,24,0.98),rgba(120,53,15,0.16))]"
            : isSellerAvailable
              ? "border-cyan-300/18 bg-[linear-gradient(145deg,rgba(17,24,39,0.96),rgba(8,13,24,0.98),rgba(8,145,178,0.18))]"
              : "border-white/10 bg-[linear-gradient(145deg,rgba(17,24,39,0.96),rgba(8,13,24,0.98),rgba(6,78,59,0.18))]"
        }`}
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  kind === "BONUS"
                    ? "border-amber-200/18 bg-amber-200/10 text-amber-50"
                    : "border-cyan-300/18 bg-cyan-300/10 text-cyan-50"
                }`}
              >
                {kind === "BONUS" ? "Bonus mensal" : "Desafio"}
              </span>
              {participant && kind === "DESAFIO" ? <ChallengeStatusBadge status={participant.statusParticipacao} scope="participant" /> : null}
              <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                {formatDateBR(challenge.dataInicio)} ate {formatDateBR(challenge.dataFim)}
              </span>
            </div>

            <h3 className="mt-4 text-2xl font-black tracking-tight text-white">{challenge.titulo}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
              {challenge.descricao || (kind === "BONUS" ? "Meta mensal automatica para acompanhar seu ritmo comercial." : "Campanha comercial pronta para voce entrar em acao.")}
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-300/14 bg-emerald-300/[0.07] px-5 py-4 xl:min-w-[260px] xl:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/68">
              {kind === "BONUS" ? "Bonus do mes" : "Recompensa"}
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight text-white">{participantPotentialReward}</p>
            <p className="mt-2 text-sm text-white/58">Ja liberado: {participantUnlockedReward}</p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Progresso</p>
              <p className="mt-2 text-sm text-white/64">
                {metaHighlights.length
                  ? `${metaHighlights.join(" | ")}${remainingMetaCount > 0 ? ` | +${remainingMetaCount} meta(s)` : ""}`
                  : "As metas desta campanha aparecem assim que o cadastro for concluido."}
              </p>
            </div>
            <div className="text-sm font-semibold text-white">
              {participantProgress}% | {completedMetas}/{totalMetas} meta(s)
            </div>
          </div>

          <div className="mt-4 h-2.5 rounded-full bg-white/10">
            <div
              className={`h-2.5 rounded-full ${
                kind === "BONUS"
                  ? "bg-[linear-gradient(90deg,#f59e0b,#f97316,#fb7185)]"
                  : "bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"
              }`}
              style={{ width: `${Math.min(Math.max(participantProgress, 0), 100)}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/58">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Target className="h-4 w-4 text-cyan-200" />
              {totalMetas} meta(s)
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-200" />
              Faturamento: {formatCurrencyBRL(impact?.realizedRevenue ?? 0)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {isSellerAvailable && onAccept ? (
            <Button className="rounded-2xl bg-[linear-gradient(135deg,#34d399,#22d3ee)] text-black hover:opacity-95" onClick={() => onAccept(challenge)}>
              Participar
            </Button>
          ) : null}

          {ctas.map((cta) => (
            <Button
              key={`${challenge.id}-${cta.label}`}
              asChild
              variant="outline"
              className="rounded-2xl border-white/15 bg-white/6 text-white hover:bg-white/10"
            >
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ))}

          {isSellerAvailable && onDismiss ? (
            <Button
              variant="outline"
              className="rounded-2xl border-white/15 bg-white/6 text-white hover:bg-white/10"
              onClick={() => onDismiss(challenge)}
            >
              Nao participar
            </Button>
          ) : null}

          <Button
            variant="outline"
            className={`rounded-2xl border-white/15 text-white hover:bg-white/10 ${
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

  const managerMetaHighlights = challenge.metas.slice(0, 3).map((meta) => getMetaTypeLabel(meta.tipoMeta))
  const managerRemainingMetaCount = Math.max(challenge.metas.length - managerMetaHighlights.length, 0)

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,39,0.98),rgba(8,13,24,0.98),rgba(15,23,42,0.94))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
              {getChallengeCampaignKindLabel(kind)}
            </span>
            <ChallengeStatusBadge status={lifecycleStatus} />
            <CampaignPill icon={<CalendarRange className="h-4 w-4 text-cyan-200" />} label={`${formatDateBR(challenge.dataInicio)} ate ${formatDateBR(challenge.dataFim)}`} />
          </div>

          <h3 className="mt-3 text-xl font-black tracking-tight text-white">{challenge.titulo}</h3>

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/60">
            <CampaignPill icon={<Users className="h-4 w-4 text-emerald-200" />} label={`${challenge.stats.totalParticipants} participante(s)`} />
            <CampaignPill icon={<Target className="h-4 w-4 text-amber-200" />} label={`${challenge.metas.length} meta(s)`} />
          </div>

          <p className="mt-3 text-sm leading-6 text-white/58">
            {managerMetaHighlights.length
              ? `${managerMetaHighlights.join(" | ")}${managerRemainingMetaCount > 0 ? ` | +${managerRemainingMetaCount} meta(s)` : ""}`
              : "As metas aparecem aqui assim que o cadastro for concluido."}
          </p>
        </div>

        <div className="flex flex-col gap-4 xl:min-w-[420px] xl:items-end">
          <div className="grid gap-3 sm:grid-cols-3 xl:w-full">
            <ValueCard label="Bonus potencial" value={formatCurrencyBRL(impact?.bonusPotential ?? 0)} />
            <ValueCard label="Bonus pago" value={formatCurrencyBRL(impact?.bonusPaid ?? 0)} />
            <ValueCard label="Faturamento gerado" value={formatCurrencyBRL(impact?.realizedRevenue ?? 0)} />
          </div>

          <Button
            variant="outline"
            className={`rounded-2xl border-white/15 text-white hover:bg-white/10 ${
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

function ValueCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
