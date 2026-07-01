"use client"

import { PencilLine, Trash2 } from "lucide-react"
import {
  formatCurrencyBRL,
  formatMetaValue,
  getChallengeMetaFocusLabel,
  getMetaTypeLabel,
  type ChallengeMeta,
} from "@/lib/challenges"

export function ChallengeMetaItem({
  meta,
  onEdit,
  onRemove,
}: {
  meta: ChallengeMeta
  onEdit: () => void
  onRemove: () => void
}) {
  const targetValue = getChallengeMetaFocusLabel(meta)
  const reward = formatCurrencyBRL(Number(meta.recompensaValor) || 0)

  return (
    <article className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-6 shadow-[0_24px_70px_rgba(2,6,23,0.18)] md:px-7 md:py-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/52">
              Meta {meta.ordemExibicao}
            </span>
            <span className="rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
              {reward}
            </span>
          </div>

          <h4 className="mt-4 text-[1.75rem] font-black tracking-tight text-white">{getMetaTypeLabel(meta.tipoMeta)}</h4>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Objetivo configurado para guiar o time com uma leitura direta e acionável.
          </p>
          {targetValue ? <p className="mt-3 text-sm leading-7 text-cyan-100/74">Foco específico: {targetValue}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <PencilLine className="h-4 w-4" />
            Editar
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/18 bg-rose-400/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/16"
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </button>
        </div>
      </div>

      <div className="mt-7 grid gap-4 border-t border-white/8 pt-6 md:grid-cols-[minmax(0,1.2fr)_260px]">
        <MetaStat label="Meta definida" value={formatMetaValue(meta)} />
        <MetaStat label="Recompensa" value={reward} highlight />
      </div>
    </article>
  )
}

function MetaStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-[22px] border px-5 py-4 ${
        highlight ? "border-amber-300/18 bg-amber-400/[0.08]" : "border-white/10 bg-black/20"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}
