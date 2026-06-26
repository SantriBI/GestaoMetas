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
    <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-white/4">
      <div className="grid min-w-[820px] grid-cols-[minmax(180px,1.3fr)_minmax(150px,0.8fr)_minmax(100px,0.6fr)_minmax(150px,0.8fr)_minmax(160px,0.8fr)] gap-3 border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        <span>Vendedor</span>
        <span>Aceite</span>
        <span>Multiplicador</span>
        <span>Prêmio ganho</span>
        <span>% de atingimento</span>
      </div>
      <div className="divide-y divide-white/6">
        {orderedParticipants.map((participant) => {
          const maxMultiplier = getMaxMultiplier(participant)
          return (
            <div
              key={`${participant.skVendedor}-${participant.id ?? "p"}`}
              className="grid min-w-[820px] grid-cols-[minmax(180px,1.3fr)_minmax(150px,0.8fr)_minmax(100px,0.6fr)_minmax(150px,0.8fr)_minmax(160px,0.8fr)] items-center gap-3 px-4 py-4 text-sm text-white/80"
            >
              <span className="min-w-0 whitespace-normal break-words font-semibold leading-5 text-white">{participant.nomeVendedor}</span>
              <span className="inline-flex items-center">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isAcceptedParticipant(participant.statusParticipacao, requiresAcceptance)
                    ? "border-emerald-300/18 bg-emerald-400/10 text-emerald-50"
                    : "border-white/12 bg-white/6 text-white/72"
                }`}>
                  {getAcceptanceLabel(participant.statusParticipacao, requiresAcceptance)}
                </span>
              </span>
              <span className="inline-flex items-center">
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
              </span>
              <span className="font-semibold text-white">
                {formatCurrencyBRL(Number(participant.premioTotalLiberado ?? 0))}
              </span>
              <span>
                <span className="text-sm font-semibold text-white">{Math.round(participant.resumo?.percentualGeral ?? 0)}%</span>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"
                    style={{ width: `${Math.min(Math.max(Number(participant.resumo?.percentualGeral ?? 0), 0), 100)}%` }}
                  />
                </div>
              </span>
            </div>
          )
        })}
      </div>

      {orderedParticipants.length > 0 ? (
        <div className="grid min-w-[820px] grid-cols-[minmax(180px,1.3fr)_minmax(150px,0.8fr)_minmax(100px,0.6fr)_minmax(150px,0.8fr)_minmax(160px,0.8fr)] gap-3 border-t border-white/8 bg-white/[0.02] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Total</span>
          <span />
          <span />
          <span className="text-sm font-bold text-white">{formatCurrencyBRL(totalPremio)}</span>
          <span />
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
  if (!requiresAcceptance) return "Participacao automatica"
  return isAcceptedParticipant(status, requiresAcceptance) ? "Aceitou o desafio" : "Nao aceitou"
}
