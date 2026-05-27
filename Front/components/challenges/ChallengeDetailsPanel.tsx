import Image from "next/image"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Award, Coins, TrendingUp, Users } from "lucide-react"
import { ChallengePayoutReport } from "@/components/challenges/ChallengePayoutReport"
import { ChallengeParticipantsTable } from "@/components/challenges/ChallengeParticipantsTable"
import { ChallengeProgressList } from "@/components/challenges/ChallengeProgressList"
import { ChallengeStatusBadge } from "@/components/challenges/ChallengeStatusBadge"
import { Button } from "@/components/ui/button"
import {
  formatCurrencyBRL,
  formatDateBR,
  getChallengeBannerAsset,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getChallengeLifecycleStatus,
  type Challenge,
} from "@/lib/challenges"

export function ChallengeDetailsPanel({ challenge }: { challenge: Challenge }) {
  const challengeBanner = getChallengeBannerAsset({ title: challenge.titulo, metas: challenge.metas })
  const participant = challenge.participant
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)

  if (participant) {
    const kind = getChallengeCampaignKind(challenge)
    const participantMetas = participant.metas ?? challenge.metas
    const potentialReward = participantMetas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
    const unlockedReward = Number(participant.premioTotalLiberado ?? 0)
    const remainingReward = Math.max(potentialReward - unlockedReward, 0)
    const progress = Math.round(Number(participant.resumo?.percentualGeral ?? 0))
    const ctas = challenge.ctas ?? []

    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(24,24,52,0.92))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.28)] sm:p-7">
          {challengeBanner ? (
            <div className="mb-6 overflow-hidden rounded-[26px] border border-white/10 bg-black/20 shadow-[0_18px_50px_rgba(2,6,23,0.22)]">
              <Image
                src={challengeBanner.src}
                alt={challengeBanner.alt}
                width={1600}
                height={520}
                className="h-auto w-full object-cover"
                sizes="(min-width: 1280px) 900px, (min-width: 640px) calc(100vw - 120px), calc(100vw - 72px)"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {kind === "DESAFIO" ? <ChallengeStatusBadge status={participant.statusParticipacao} scope="participant" /> : null}
            {kind === "BONUS" ? (
              <span className="rounded-full border border-amber-200/18 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-50">
                Bônus mensal automático
              </span>
            ) : null}
            <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
              {participant.resumo?.metasConcluidas ?? 0} de {participant.resumo?.totalMetas ?? participantMetas.length} metas
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-3xl font-black tracking-tight text-white">{challenge.titulo}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{challenge.descricao}</p>
              <p className="mt-4 text-sm font-semibold text-white/58">
                {kind === "BONUS" ? "Mês de referência" : "Prazo"}: {formatDateBR(challenge.dataInicio)} até {formatDateBR(challenge.dataFim)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <SummaryCard label="Ganhe ate" value={formatCurrencyBRL(potentialReward)} icon={<Award className="h-4 w-4 text-amber-200" />} />
              <SummaryCard label="Ja liberado" value={formatCurrencyBRL(unlockedReward)} icon={<Coins className="h-4 w-4 text-emerald-200" />} />
              <SummaryCard label="Progresso" value={`${progress}%`} icon={<TrendingUp className="h-4 w-4 text-sky-200" />} />
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">O que falta fazer</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">{kind === "BONUS" ? "Metas do seu bônus" : "Metas da sua missão"}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="Metas concluídas" value={`${participant.resumo?.metasConcluidas ?? 0}/${participant.resumo?.totalMetas ?? participantMetas.length}`} />
              <MiniStat label="Prêmio restante" value={formatCurrencyBRL(remainingReward)} />
            </div>
          </div>

          <ChallengeProgressList metas={participantMetas} variant="list" />
        </section>

        {ctas.length ? (
          <section className="rounded-[30px] border border-cyan-300/16 bg-cyan-300/[0.06] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/72">Ações rápidas</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Use os atalhos da campanha para agir sem sair do fluxo.
                </p>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Produtos e clientes certos, no momento certo, para movimentar a meta mais rápido.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {ctas.map((cta) => (
                  <Button key={`${challenge.id}-${cta.label}`} asChild className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] text-black hover:opacity-95">
                    <Link href={cta.href}>
                      {cta.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  const kind = getChallengeCampaignKind(challenge)

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(24,24,52,0.92))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.28)] sm:p-7">
        {challengeBanner ? (
          <div className="mb-6 overflow-hidden rounded-[26px] border border-white/10 bg-black/20 shadow-[0_18px_50px_rgba(2,6,23,0.22)]">
            <Image
              src={challengeBanner.src}
              alt={challengeBanner.alt}
              width={1600}
              height={520}
              className="h-auto w-full object-cover"
              sizes="(min-width: 1280px) 900px, (min-width: 640px) calc(100vw - 120px), calc(100vw - 72px)"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
            {getChallengeCampaignKindLabel(kind)}
          </span>
          <ChallengeStatusBadge status={lifecycleStatus} />
          <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
            {challenge.stats.totalParticipants} participante(s)
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-3xl font-black tracking-tight text-white">{challenge.titulo}</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/60">
              <DetailPill label={`Vigencia: ${formatDateBR(challenge.dataInicio)} ate ${formatDateBR(challenge.dataFim)}`} />
              <DetailPill label={`${challenge.metas.length} meta(s)`} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
            <SummaryCard label="Bonus potencial" value={formatCurrencyBRL(challenge.impact.bonusPotential)} icon={<Coins className="h-4 w-4 text-amber-200" />} />
            <SummaryCard label="Faturamento gerado" value={formatCurrencyBRL(challenge.impact.realizedRevenue)} icon={<TrendingUp className="h-4 w-4 text-emerald-200" />} />
            <SummaryCard label="Aceite do time" value={`${Math.round(challenge.stats.adherenceRate)}%`} icon={<Users className="h-4 w-4 text-cyan-200" />} />
            <SummaryCard label="Resultado" value={`${Math.round(challenge.stats.completionRate)}%`} icon={<Award className="h-4 w-4 text-sky-200" />} />
          </div>
        </div>
      </div>

      <section className={detailPanelClass}>
        <SectionHeader eyebrow="Impacto" title="Impacto da campanha" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinancialMetric label="Pode custar" value={formatCurrencyBRL(challenge.impact.bonusPotential)} />
          <FinancialMetric label="Pode gerar" value={formatCurrencyBRL(challenge.impact.estimatedRevenue)} />
          <FinancialMetric label="Pago ate agora" value={formatCurrencyBRL(challenge.impact.bonusPaid)} />
          <FinancialMetric label="Ja realizado" value={formatCurrencyBRL(challenge.impact.realizedRevenue)} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={detailPanelClass}>
          <SectionHeader eyebrow="1. Metas" title={kind === "BONUS" ? "Metas do bonus" : "Metas do desafio"} />
          <ChallengeProgressList metas={challenge.metas} variant="list" />
        </section>

        <section className={detailPanelClass}>
          <SectionHeader eyebrow="2. Participacao" title="Participacao do time" />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Time total" value={String(challenge.stats.totalParticipants)} />
            <MiniStat label="Aceitaram" value={String(challenge.stats.acceptedParticipants)} />
            <MiniStat label="Media de atingimento" value={`${Math.round(challenge.stats.progressAverage)}%`} />
          </div>
          {challenge.participants?.length ? (
            <ChallengeParticipantsTable participants={challenge.participants} requiresAcceptance={challenge.exigeAceite} />
          ) : (
            <p className="text-sm leading-7 text-white/55">Nenhum participante vinculado a esta campanha.</p>
          )}
        </section>
      </div>

      {challenge.participants?.length ? <ChallengePayoutReport challenge={challenge} /> : null}
    </div>
  )
}

function DetailPill({ label }: { label: string }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{label}</span>
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

function FinancialMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

const detailPanelClass = "rounded-[30px] border border-white/10 bg-white/[0.04] p-5"
