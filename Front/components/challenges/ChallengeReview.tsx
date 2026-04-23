"use client"

import type { ReactNode } from "react"
import { CalendarRange, Coins, Sparkles, Target } from "lucide-react"
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
  empresaId,
  metas,
  dataInicio,
  dataFim,
  isFlash,
}: {
  titulo: string
  descricao: string
  empresaId: string
  metas: ChallengeMeta[]
  dataInicio: string
  dataFim: string
  isFlash: boolean
}) {
  const totalReward = metas.reduce((sum, meta) => sum + (Number(meta.recompensaValor) || 0), 0)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_360px]">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_28px_90px_rgba(2,6,23,0.22)]">
        <div className="border-b border-white/8 px-6 py-6 md:px-7">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
            <Sparkles className="h-3.5 w-3.5" />
            Resumo do desafio
          </div>

          <h3 className="mt-4 text-3xl font-black tracking-tight text-white">{titulo || "Novo desafio"}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">
            {descricao?.trim() || "Sem descricao informada. O desafio sera publicado com uma comunicacao curta, objetiva e direta."}
          </p>
        </div>

        <div className="space-y-6 px-6 py-6 md:px-7">
          <div className="grid gap-4 md:grid-cols-3">
            <ReviewInfoCard
              label="Prazo"
              value={`${formatDateBR(dataInicio)} ate ${formatDateBR(dataFim)}`}
              icon={<CalendarRange className="h-4 w-4 text-cyan-200" />}
            />
            <ReviewInfoCard
              label="Modo"
              value={isFlash ? "Relampago" : "Padrao"}
              icon={<Sparkles className="h-4 w-4 text-pink-200" />}
            />
            <ReviewInfoCard
              label="Premiacao total"
              value={formatCurrencyBRL(totalReward)}
              icon={<Coins className="h-4 w-4 text-amber-200" />}
            />
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Metas confirmadas</p>
                <p className="mt-2 text-lg font-semibold text-white">{metas.length} meta(s) prontas para publicar</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Escopo {empresaId ? `Empresa ${empresaId}` : "Todas"}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {metas.map((meta, index) => (
                <div key={`review-meta-${index}`} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{getMetaTypeLabel(meta.tipoMeta)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/34">Meta {index + 1}</p>
                    </div>
                    <span className="rounded-full border border-amber-300/18 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      {formatCurrencyBRL(Number(meta.recompensaValor) || 0)}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-white/72">Objetivo: {formatMetaValue(meta)}</p>
                  {getChallengeMetaFocusLabel(meta) ? (
                    <p className="mt-2 text-sm leading-6 text-cyan-100/72">Foco: {getChallengeMetaFocusLabel(meta)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.18)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
            <Target className="h-3.5 w-3.5" />
            Publicacao
          </div>

          <h4 className="mt-4 text-2xl font-black tracking-tight text-white">Pronto para criar</h4>
          <p className="mt-3 text-sm leading-7 text-white/58">
            Use este painel para uma ultima leitura executiva antes de confirmar o desafio.
          </p>

          <div className="mt-6 space-y-3">
            <ReviewLine label="Escopo" value={empresaId ? `Empresa ${empresaId}` : "Todas as empresas"} />
            <ReviewLine label="Modo" value={isFlash ? "Relampago" : "Padrao"} />
            <ReviewLine label="Metas" value={`${metas.length} configuradas`} />
            <ReviewLine label="Premiacao" value={formatCurrencyBRL(totalReward)} />
          </div>
        </section>

        <section className="rounded-[26px] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Checklist rapido</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/62">
            <p>Titulo e descricao comunicam o foco da campanha.</p>
            <p>As metas possuem objetivo valido e recompensa definida.</p>
            <p>O prazo combina com o ritmo esperado do time.</p>
          </div>
        </section>
      </aside>
    </div>
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

function ReviewLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  )
}
