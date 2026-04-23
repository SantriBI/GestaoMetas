import {
  formatCurrencyBRL,
  formatMetaProgressValue,
  formatMetaValue,
  getChallengeMetaFocusLabel,
  getMetaTypeLabel,
  type ChallengeMeta,
} from "@/lib/challenges"

export function ChallengeProgressList({
  metas,
  variant = "cards",
  showReward = true,
}: {
  metas: ChallengeMeta[]
  variant?: "cards" | "list"
  showReward?: boolean
}) {
  if (variant === "list") {
    return (
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
        {metas.map((meta, index) => (
          <div
            key={`${meta.idMeta ?? index}-${meta.tipoMeta}`}
            className={`px-5 py-4 ${index !== metas.length - 1 ? "border-b border-white/8" : ""}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{getMetaTypeLabel(meta.tipoMeta)}</p>
                <p className="mt-1 text-sm text-white/55">Meta {formatMetaValue(meta)}</p>
                {getChallengeMetaFocusLabel(meta) ? (
                  <p className="mt-1 text-sm text-cyan-100/72">Escopo: {getChallengeMetaFocusLabel(meta)}</p>
                ) : null}
                <p className="mt-1 text-sm text-white/55">Atual: {formatMetaProgressValue(meta)}</p>
              </div>

              {showReward ? (
                <div className="self-start rounded-full border border-amber-200/14 bg-amber-200/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                  {formatCurrencyBRL(meta.recompensaValor)}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-2.5 flex-1 rounded-full bg-white/10">
                <div
                  className="h-2.5 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"
                  style={{ width: `${Math.min(Math.max(meta.percentualConclusao ?? 0, 0), 100)}%` }}
                />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">
                {Math.round(meta.percentualConclusao ?? 0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {metas.map((meta, index) => (
        <div key={`${meta.idMeta ?? index}-${meta.tipoMeta}`} className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">{getMetaTypeLabel(meta.tipoMeta)}</p>
              <p className="mt-1 text-sm text-white/55">Meta {formatMetaValue(meta)}</p>
              {getChallengeMetaFocusLabel(meta) ? (
                <p className="mt-1 text-sm text-cyan-100/72">Escopo: {getChallengeMetaFocusLabel(meta)}</p>
              ) : null}
            </div>
            <div className="self-start rounded-full border border-amber-200/14 bg-amber-200/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
              {formatCurrencyBRL(meta.recompensaValor)}
            </div>
          </div>

          <div className="mt-5 h-2.5 rounded-full bg-white/10">
            <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,#fb7185,#f59e0b,#06b6d4)]" style={{ width: `${Math.min(Math.max(meta.percentualConclusao ?? 0, 0), 100)}%` }} />
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-white/58 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0">Atual: {formatMetaProgressValue(meta)}</span>
            <span className="text-sm font-semibold text-white">{Math.round(meta.percentualConclusao ?? 0)}% concluido</span>
          </div>
        </div>
      ))}
    </div>
  )
}
