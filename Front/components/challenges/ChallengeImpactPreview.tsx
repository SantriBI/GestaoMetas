"use client"

import type { ReactNode } from "react"
import { BarChart3, Coins, Sparkles, Target, TrendingUp, Users } from "lucide-react"
import { formatCurrencyBRL, type ChallengeImpactMetrics } from "@/lib/challenges"

export function ChallengeImpactPreview({
  impact,
  loading = false,
  error = null,
  title = "Impacto estimado da campanha",
  description = "Leitura gerencial do custo potencial, do retorno esperado e do que já foi capturado até aqui.",
  preview = false,
}: {
  impact?: ChallengeImpactMetrics | null
  loading?: boolean
  error?: string | null
  title?: string
  description?: string
  preview?: boolean
}) {
  if (loading) {
    return (
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.18)]">
        <div className="h-6 w-64 animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-white/10" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-[30px] border border-rose-300/18 bg-rose-400/10 p-6 text-sm leading-7 text-rose-100">
        {error}
      </section>
    )
  }

  if (!impact) {
    return (
      <section className="rounded-[30px] border border-dashed border-white/12 bg-white/[0.03] p-6 text-sm leading-7 text-white/55">
        Preencha nome, metas e prazo para gerar a leitura de impacto da campanha.
      </section>
    )
  }

  const relationPotentialText = impact.returnPerBonusPotential > 0
    ? `Para cada R$ 1 em bônus potencial, a campanha projeta ${formatCurrencyBRL(impact.returnPerBonusPotential)} em retorno.`
    : "Ainda não foi possível relacionar bônus e retorno estimado para esta configuração."

  const relationRealText = impact.returnPerBonusRealized > 0
    ? `No realizado, cada R$ 1 pago gerou ${formatCurrencyBRL(impact.returnPerBonusRealized)} em retorno apurado.`
    : "O retorno realizado ainda está em consolidação ou não houve bônus liberado até agora."

  return (
    <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.18)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
            <Sparkles className="h-3.5 w-3.5" />
            {preview ? "Antes de publicar" : "Performance financeira"}
          </div>
          <h3 className="mt-4 text-3xl font-black tracking-tight text-white">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-white/60">{description}</p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/20 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Base de estimativa</p>
          <p className="mt-3 text-sm font-semibold text-white">
            Ticket médio {formatCurrencyBRL(impact.referenceTicketMedio)}
          </p>
          <p className="mt-1 text-sm text-white/55">
            Receita por cliente {formatCurrencyBRL(impact.referenceReceitaPorCliente)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ImpactCard label="Bônus potencial" value={formatCurrencyBRL(impact.bonusPotential)} icon={<Coins className="h-4 w-4 text-amber-200" />} />
        <ImpactCard label="Retorno potencial" value={formatCurrencyBRL(impact.estimatedRevenue)} icon={<TrendingUp className="h-4 w-4 text-emerald-200" />} />
        <ImpactCard label="Bônus pago" value={formatCurrencyBRL(impact.bonusPaid)} icon={<Coins className="h-4 w-4 text-rose-200" />} />
        <ImpactCard label="Retorno realizado" value={formatCurrencyBRL(impact.realizedRevenue)} icon={<BarChart3 className="h-4 w-4 text-cyan-200" />} />
        <ImpactCard label="Participantes" value={`${impact.eligibleParticipants}`} icon={<Users className="h-4 w-4 text-white/75" />} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Pedidos estimados" value={String(Math.round(impact.estimatedOrders))} />
        <MiniMetric label="Pedidos realizados" value={String(Math.round(impact.realizedOrders))} />
        <MiniMetric label="Clientes estimados" value={String(Math.round(impact.estimatedClients))} />
        <MiniMetric label="Clientes ativados" value={String(Math.round(impact.realizedClients))} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
            <Target className="h-3.5 w-3.5 text-cyan-200" />
            Leitura executiva
          </div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-white/68">
            <p>{relationPotentialText}</p>
            {!preview ? <p>{relationRealText}</p> : null}
            <p>
              A campanha considera {impact.eligibleParticipants} vendedor(es) elegíveis e usa uma base de {impact.referenceWindowDays} dias
              para estimar ticket médio e receita por cliente.
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Indicadores-chave</p>
          <div className="mt-4 space-y-3 text-sm text-white/68">
            <p>Adesão atual: {impact.acceptedParticipants} vendedor(es) no fluxo.</p>
            <p>Conclusões: {impact.completedParticipants} participante(s) com todas as metas batidas.</p>
            <p>Burn rate do bônus: {impact.bonusBurnRate.toFixed(1)}%.</p>
            <p>Captura de retorno: {impact.revenueCaptureRate.toFixed(1)}% do estimado.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ImpactCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </article>
  )
}

function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
