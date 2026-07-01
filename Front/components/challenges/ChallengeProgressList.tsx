import {
  formatCurrencyBRL,
  formatMetaProgressValue,
  formatMetaValue,
  getChallengeMetaFocusLabel,
  getChallengeMetaTargetSummary,
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
        {metas.map((meta, index) => {
          const pct = Math.min(Math.max(Number(meta.percentualConclusao ?? 0), 0), 100)
          const isCompleted = pct >= 100 || meta.premioLiberado === true
          const hasProgress = Number(meta.progressoAtual ?? 0) > 0
          const multiplier = Number(meta.multiplier ?? 0)
          const earnedAmount = Number(meta.premioValor ?? 0)
          const baseReward = Number(meta.recompensaValor ?? 0)
          const hasMultiplier = multiplier > 1
          const isMissingTarget = meta.tipoMeta === "PRODUTO_OU_MARCA" && !getChallengeMetaTargetSummary(meta)
          const metaStatusLabel = isCompleted ? "Concluída" : hasProgress ? "Em andamento" : "Pendente"
          const metaStatusClass = isCompleted
            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
            : hasProgress
              ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
              : "border-white/10 bg-white/5 text-white/40"
          const gapValue = Math.max(Number(meta.metaValor ?? 0) - Number(meta.progressoAtual ?? 0), 0)
          const gapFormatted = formatMetaValue({ ...meta, metaValor: gapValue })
          const showGap = meta.progressoAtual != null && !isCompleted

          return (
            <div
              key={`${meta.idMeta ?? index}-${meta.tipoMeta}`}
              className={`px-5 py-4 ${index !== metas.length - 1 ? "border-b border-white/8" : ""}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{getMetaTypeLabel(meta.tipoMeta)}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${metaStatusClass}`}>
                      {metaStatusLabel}
                    </span>
                  </div>
                  {isMissingTarget ? (
                    <p className="mt-1 text-sm text-white/40">Em configuração pelo gerente</p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-white/55">
                        {hasMultiplier ? "Meta por ciclo" : "Meta"}: {formatMetaValue(meta)}
                      </p>
                      {getChallengeMetaFocusLabel(meta) ? (
                        <p className="mt-1 text-sm text-cyan-100/72">Escopo: {getChallengeMetaFocusLabel(meta)}</p>
                      ) : null}
                      <p className="mt-1 text-sm text-white/55">Vendido: {formatMetaProgressValue(meta)}</p>
                      {showGap ? (
                        <p className="mt-1 text-sm font-medium text-white/50">Falta: {gapFormatted}</p>
                      ) : null}
                      {isCompleted ? (
                        <p className="mt-1 text-sm font-medium text-emerald-300/80">
                          {hasMultiplier ? `${multiplier} ciclos completos` : "Meta atingida"}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>

                {showReward ? (
                  <div className="self-start rounded-full border border-amber-200/14 bg-amber-200/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                    {hasMultiplier && earnedAmount > 0
                      ? `${formatCurrencyBRL(earnedAmount)} ganhos`
                      : formatCurrencyBRL(baseReward)}
                  </div>
                ) : null}
              </div>

              {!isMissingTarget ? (
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2.5 flex-1 rounded-full bg-white/10">
                    <div
                      className={`h-2.5 rounded-full transition-[width] duration-500 ${isCompleted ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">
                    {Math.round(pct)}%
                  </span>
                </div>
              ) : null}
            </div>
          )
        })}
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
            <span className="min-w-0">Vendido: {formatMetaProgressValue(meta)}</span>
            <span className="text-sm font-semibold text-white">{Math.round(meta.percentualConclusao ?? 0)}% concluído</span>
          </div>
        </div>
      ))}
    </div>
  )
}
