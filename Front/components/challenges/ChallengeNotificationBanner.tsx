import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatMetaValue,
  getChallengeCampaignKind,
  getChallengeMetaFocusLabel,
  type ChallengeMeta,
} from "@/lib/challenges"
import { cn } from "@/lib/utils"

export function ChallengeNotificationBanner({
  campaign,
  href,
  onAccept,
  loading = false,
  compact = false,
}: {
  campaign: ChallengeNotificationCampaign
  href: string
  onAccept?: () => void
  loading?: boolean
  compact?: boolean
}) {
  const kind = getChallengeCampaignKind({ exigeAceite: campaign.exigeAceite })
  const title = String(campaign.titulo ?? "").trim() || (kind === "BONUS" ? "B\u00f4nus mensal ativo" : "Desafio ativo")
  const participantStatus = String(campaign.participant?.statusParticipacao ?? campaign.participantStatus ?? "").trim().toUpperCase()
  const metas = campaign.metas ?? []
  const primaryMeta = metas[0] ?? null
  const totalReward = metas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
  const metaLabel = primaryMeta ? buildMetaLabel(primaryMeta) : "ver detalhes"
  const rewardLabel = totalReward > 0
    ? `Pr\u00eamio ${formatReward(totalReward)}`
    : kind === "BONUS"
      ? "Premia\u00e7\u00e3o autom\u00e1tica"
      : "Premia\u00e7\u00e3o ativa"
  const extraMetaLabel = metas.length > 1 ? `+${metas.length - 1} meta(s)` : null
  const detailsLine = [`Meta: ${metaLabel}`, rewardLabel, extraMetaLabel].filter(Boolean).join(" \u00b7 ")
  const primaryAction = getPrimaryActionState({ kind, onAccept, participantStatus })

  return (
    <article
      className={cn(
        "group rounded-[18px] bg-transparent transition-[background-color,border-color,box-shadow,transform] duration-200 hover:bg-white/[0.03] hover:shadow-[0_10px_24px_rgba(2,8,23,0.14)]",
        compact ? "px-3 py-4" : "px-3 py-4 sm:px-4 sm:py-5"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
            <p className={cn("truncate tracking-tight text-white", compact ? "text-xl font-bold" : "text-xl font-bold sm:text-[1.35rem]")}>
              {title}
            </p>
          </div>

          <p className={cn("mt-2 text-white/60", compact ? "text-[13px] leading-6" : "text-sm leading-6")}>
            {detailsLine}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {primaryAction.interactive ? (
            <Button
              type="button"
              className={cn(
                "rounded-xl border border-cyan-300/28 bg-[linear-gradient(135deg,rgba(8,145,178,0.98),rgba(5,150,105,0.98))] font-semibold text-white shadow-[0_10px_24px_rgba(6,182,212,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-px hover:brightness-105 hover:shadow-[0_14px_30px_rgba(6,182,212,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0",
                compact ? "h-9 px-3.5 text-sm" : "h-9 px-4 text-sm"
              )}
              disabled={loading}
              onClick={() => onAccept?.()}
            >
              {primaryAction.label}
            </Button>
          ) : (
            <span
              className={cn(
                "inline-flex h-9 items-center rounded-xl border px-3.5 text-sm font-medium",
                primaryAction.tone === "cyan"
                  ? "border-cyan-400/14 bg-cyan-400/10 text-cyan-100"
                  : primaryAction.tone === "amber"
                    ? "border-amber-400/14 bg-amber-400/10 text-amber-100"
                    : "border-white/10 bg-white/[0.04] text-white/72",
                compact ? "px-3.5 text-sm" : "px-4 text-sm"
              )}
            >
              {primaryAction.label}
            </span>
          )}

          <Button
            asChild
            variant="ghost"
            className={cn(
              "rounded-xl text-white/72 hover:bg-white/[0.05] hover:text-white",
              compact ? "h-9 px-3.5 text-sm" : "h-9 px-4 text-sm"
            )}
          >
            <Link href={href}>
              Ver desafio
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

type ChallengeNotificationCampaign = {
  titulo?: string | null
  exigeAceite?: boolean | null
  metas?: ChallengeMeta[] | null
  participantStatus?: string | null
  participant?: {
    statusParticipacao?: string | null
  } | null
}

function buildMetaLabel(meta: ChallengeMeta) {
  const focusLabel = getChallengeMetaFocusLabel(meta)
  const focusSuffix = focusLabel ? ` em ${focusLabel}` : ""
  return `${formatMetaValue(meta)}${focusSuffix}`
}

function formatReward(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function getPrimaryActionState({
  kind,
  onAccept,
  participantStatus,
}: {
  kind: "DESAFIO" | "BONUS"
  onAccept?: () => void
  participantStatus: string
}) {
  if (onAccept) {
    return { label: "Participar", interactive: true, tone: "cyan" as const }
  }

  if (kind === "BONUS") {
    return { label: "Automático", interactive: false, tone: "amber" as const }
  }

  if (participantStatus === "CONCLUIDO") {
    return { label: "Concluído", interactive: false, tone: "cyan" as const }
  }

  if (["ACEITO", "EM_ANDAMENTO"].includes(participantStatus)) {
    return { label: "Em andamento", interactive: false, tone: "cyan" as const }
  }

  return { label: "Ativo", interactive: false, tone: "neutral" as const }
}
