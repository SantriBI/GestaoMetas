import { getChallengeStatusLabel, getParticipantStatusLabel, type ChallengeStatus, type ParticipantStatus } from "@/lib/challenges"

const styles = {
  RASCUNHO: "border-white/[0.08] bg-white/[0.04] text-white/72",
  AGENDADO: "border-sky-300/12 bg-sky-400/[0.08] text-sky-100/88",
  ATIVO: "border-emerald-300/12 bg-emerald-400/[0.08] text-emerald-100/88",
  ENCERRADO: "border-slate-300/[0.12] bg-slate-400/[0.08] text-slate-200/88",
  ENCERRADO_AUTOMATICO: "border-slate-300/[0.12] bg-slate-400/[0.08] text-slate-200/88",
  ENCERRADO_MANUAL: "border-amber-300/12 bg-amber-400/[0.08] text-amber-100/88",
  CANCELADO: "border-rose-300/12 bg-rose-400/[0.08] text-rose-100/88",
  CONVIDADO: "border-white/[0.08] bg-white/[0.04] text-white/72",
  DISPONIVEL: "border-cyan-300/12 bg-cyan-400/[0.08] text-cyan-100/88",
  ACEITO: "border-indigo-300/12 bg-indigo-400/[0.08] text-indigo-100/88",
  EM_ANDAMENTO: "border-amber-300/12 bg-amber-400/[0.08] text-amber-100/88",
  CONCLUIDO: "border-emerald-300/12 bg-emerald-400/[0.1] text-emerald-50/92",
  EXPIRADO: "border-slate-300/[0.12] bg-slate-400/[0.08] text-slate-200/88",
  RECUSADO: "border-rose-300/12 bg-rose-400/[0.08] text-rose-100/88",
}

export function ChallengeStatusBadge({
  status,
  scope = "challenge",
}: {
  status: ChallengeStatus | ParticipantStatus
  scope?: "challenge" | "participant"
}) {
  const label = scope === "challenge"
    ? getChallengeStatusLabel(status as ChallengeStatus)
    : getParticipantStatusLabel(status as ParticipantStatus)

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${styles[status] ?? styles.RASCUNHO}`}>
      {label}
    </span>
  )
}
