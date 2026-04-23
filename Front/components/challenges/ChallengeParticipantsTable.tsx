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

  return (
    <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-white/4">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(170px,0.9fr)_minmax(180px,0.9fr)] gap-4 border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        <span>Vendedor</span>
        <span>Aceite</span>
        <span>% de atingimento</span>
      </div>
      <div className="divide-y divide-white/6">
        {orderedParticipants.map((participant) => (
          <div
            key={`${participant.skVendedor}-${participant.id ?? "p"}`}
            className="grid grid-cols-[minmax(0,1.3fr)_minmax(170px,0.9fr)_minmax(180px,0.9fr)] gap-4 px-4 py-4 text-sm text-white/80"
          >
            <span className="font-semibold text-white">{participant.nomeVendedor}</span>
            <span className="inline-flex items-center">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isAcceptedParticipant(participant.statusParticipacao, requiresAcceptance)
                  ? "border-emerald-300/18 bg-emerald-400/10 text-emerald-50"
                  : "border-white/12 bg-white/6 text-white/72"
              }`}>
                {getAcceptanceLabel(participant.statusParticipacao, requiresAcceptance)}
              </span>
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
        ))}
      </div>
    </div>
  )
}

function isAcceptedParticipant(status: ChallengeParticipant["statusParticipacao"], requiresAcceptance: boolean) {
  if (!requiresAcceptance) return true
  return ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO"].includes(String(status ?? "").toUpperCase())
}

function getAcceptanceWeight(status: ChallengeParticipant["statusParticipacao"], requiresAcceptance: boolean) {
  return isAcceptedParticipant(status, requiresAcceptance) ? 2 : 1
}

function getAcceptanceLabel(status: ChallengeParticipant["statusParticipacao"], requiresAcceptance: boolean) {
  if (!requiresAcceptance) return "Participacao automatica"
  return isAcceptedParticipant(status, requiresAcceptance) ? "Aceitou o desafio" : "Nao aceitou"
}
