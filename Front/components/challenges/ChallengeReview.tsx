"use client"

import type { ReactNode } from "react"
import { CalendarRange, Sparkles } from "lucide-react"
import {
  formatCurrencyBRL,
  formatDateBR,
  formatMetaValue,
  getChallengeMetaFocusLabel,
  getMetaTypeLabel,
  type ChallengeMeta,
} from "@/lib/challenges"

export function ChallengeReview({
  titulo,
  descricao,
  metas,
  dataInicio,
  dataFim,
}: {
  titulo: string
  descricao: string
  metas: ChallengeMeta[]
  dataInicio: string
  dataFim: string
}) {
  const meta = metas[0]

  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_28px_90px_rgba(2,6,23,0.22)]">
      <div className="border-b border-white/8 px-6 py-6 md:px-7">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
          <Sparkles className="h-3.5 w-3.5" />
          Resumo do desafio
        </div>

        <h3 className="mt-4 text-3xl font-black tracking-tight text-white">{titulo || "Novo desafio"}</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
          {descricao?.trim() || "Sem descrição informada."}
        </p>
      </div>

      <div className="space-y-4 px-6 py-6 md:px-7">
        <ReviewInfoCard
          label="Prazo"
          value={`${formatDateBR(dataInicio)} até ${formatDateBR(dataFim)}`}
          icon={<CalendarRange className="h-4 w-4 text-cyan-200" />}
        />

        {meta ? (
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{getMetaTypeLabel(meta.tipoMeta)}</p>
                {getChallengeMetaFocusLabel(meta) ? (
                  <p className="mt-1 text-sm leading-6 text-cyan-100/72">{getChallengeMetaFocusLabel(meta)}</p>
                ) : null}
              </div>
              <span className="rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                {formatCurrencyBRL(Number(meta.recompensaValor) || 0)}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/72">Objetivo: {formatMetaValue(meta)}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ReviewInfoCard({
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
