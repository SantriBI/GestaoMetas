import { formatCurrencyBRL } from "@/lib/challenges"
import type { ChallengeParticipant } from "@/lib/challenges"

export function ChallengeParticipantsTable({
  participants,
  requiresAcceptance = true,
}: {
  participants: ChallengeParticipant[]
  requiresAcceptance?: boolean
}) {
  const orderedParticipants = [...participants].sort(
    (left, right) =>
      getAcceptanceWeight(right.statusParticipacao, requiresAcceptance)
      - getAcceptanceWeight(left.statusParticipacao, requiresAcceptance)
      || Number(right.resumo?.percentualGeral ?? 0) - Number(left.resumo?.percentualGeral ?? 0)
  )

  const totalPremio = orderedParticipants.reduce(
    (sum, participant) => sum + Number(participant.premioTotalLiberado ?? 0),
    0
  )

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/4">
      <div className="hidden items-center gap-4 border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 sm:flex">
        <span className="flex-1">Vendedor</span>
        <span className="w-24 shrink-0">Multiplicador</span>
        <span className="w-28 shrink-0">Prêmio ganho</span>
        <span className="w-36 shrink-0">% de atingimento</span>
      </div>
      <div className="divide-y divide-white/6">
        {orderedParticipants.map((participant) => {
          const maxMultiplier = getMaxMultiplier(participant)
          const pct = Math.min(Math.max(Number(participant.resumo?.percentualGeral ?? 0), 0), 100)

          return (
            <div
              key={`${participant.skVendedor}-${participant.id ?? "p"}`}
              className="flex flex-col gap-3 px-4 py-4 text-sm text-white/80 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate font-semibold text-white">{participant.nomeVendedor}</p>
                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${
                  isAcceptedParticipant(participant.statusParticipacao, requiresAcceptance)
                    ? "border-emerald-300/18 bg-emerald-400/10 text-emerald-50"
                    : "border-white/12 bg-white/6 text-white/72"
                }`}>
                  {getAcceptanceLabel(participant.statusParticipacao, requiresAcceptance)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 sm:w-24 sm:shrink-0 sm:justify-start">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 sm:hidden">Multiplicador</span>
                {maxMultiplier >= 1 ? (
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                    maxMultiplier >= 3
                      ? "border-amber-300/25 bg-amber-400/15 text-amber-100"
                      : maxMultiplier >= 2
                        ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                        : "border-white/12 bg-white/6 text-white/70"
                  }`}>
                    {maxMultiplier}x
                  </span>
                ) : (
                  <span className="text-white/35">—</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 sm:w-28 sm:shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 sm:hidden">Prêmio ganho</span>
                <span className="font-semibold text-white">
                  {formatCurrencyBRL(Number(participant.premioTotalLiberado ?? 0))}
                </span>
              </div>

              <div className="sm:w-36 sm:shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 sm:hidden">% de atingimento</span>
                  <span className="text-sm font-semibold text-white">{Math.round(pct)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {orderedParticipants.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-white/[0.02] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Total</span>
          <span className="text-sm font-bold text-white">{formatCurrencyBRL(totalPremio)}</span>
        </div>
      ) : null}
    </div>
  )
}

function getMaxMultiplier(participant: ChallengeParticipant): number {
  const metas = participant.metas ?? []
  return metas.reduce((max, meta) => Math.max(max, Number(meta.multiplier ?? 0)), 0)
}

function isAcceptedParticipant(status: ChallengeParticipant["statusParticipacao"], requiresAcceptance: boolean) {
  if (!requiresAcceptance) return true
  return ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO", "EXPIRADO"].includes(String(status ?? "").toUpperCase())
}

function getAcceptanceWeight(status: ChallengeParticipant["statusParticipacao"], requiresAcceptance: boolean) {
  return isAcceptedParticipant(status, requiresAcceptance) ? 2 : 1
}

function getAcceptanceLabel(status: ChallengeParticipant["statusParticipacao"], requiresAcceptance: boolean) {
  if (!requiresAcceptance) return "Participação automática"
  return isAcceptedParticipant(status, requiresAcceptance) ? "Aceitou o desafio" : "Não aceitou"
}
