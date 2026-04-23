import { getChallengeStatusLabel, getParticipantStatusLabel, type ChallengeStatus, type ParticipantStatus } from "@/lib/challenges"

const styles = {
  RASCUNHO: "border-white/15 bg-white/8 text-white/75",
  AGENDADO: "border-sky-300/18 bg-sky-400/12 text-sky-100",
  ATIVO: "border-emerald-300/18 bg-emerald-400/12 text-emerald-100",
  ENCERRADO: "border-slate-300/14 bg-slate-400/10 text-slate-200",
  CANCELADO: "border-rose-300/18 bg-rose-400/12 text-rose-100",
  CONVIDADO: "border-white/15 bg-white/8 text-white/75",
  DISPONIVEL: "border-cyan-300/18 bg-cyan-400/12 text-cyan-100",
  ACEITO: "border-indigo-300/18 bg-indigo-400/12 text-indigo-100",
  EM_ANDAMENTO: "border-amber-300/18 bg-amber-400/12 text-amber-100",
  CONCLUIDO: "border-emerald-300/18 bg-emerald-400/16 text-emerald-50",
  EXPIRADO: "border-slate-300/14 bg-slate-400/10 text-slate-200",
  RECUSADO: "border-rose-300/18 bg-rose-400/12 text-rose-100",
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
