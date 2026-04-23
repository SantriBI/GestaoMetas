"use client"

import { BarChart3, Coins, Gauge, Wallet } from "lucide-react"
import { formatCurrencyBRL, type ChallengeCampaignKind, type ChallengesResponse } from "@/lib/challenges"

export function ChallengeCampaignSummary({
  summary,
  campaignKind,
  activeCount = 0,
  totalCount = 0,
}: {
  summary: ChallengesResponse["summary"] | null | undefined
  campaignKind: ChallengeCampaignKind
  activeCount?: number
  totalCount?: number
}) {
  const relationValue =
    summary?.returnPerBonusRealized && summary.returnPerBonusRealized > 0
      ? `${summary.returnPerBonusRealized.toFixed(2)}x`
      : summary?.returnPerBonusPotential && summary.returnPerBonusPotential > 0
        ? `${summary.returnPerBonusPotential.toFixed(2)}x`
        : "0,00x"

  const cards = [
    {
      label: "Bonus potencial",
      value: formatCurrencyBRL(Number(summary?.estimatedRewardTotal ?? 0)),
      icon: <Coins className="h-4 w-4 text-amber-200" />,
    },
    {
      label: "Bonus pago",
      value: formatCurrencyBRL(Number(summary?.paidRewardTotal ?? 0)),
      icon: <Wallet className="h-4 w-4 text-rose-200" />,
    },
    {
      label: "Faturamento gerado",
      value: formatCurrencyBRL(Number(summary?.realizedRevenueTotal ?? 0)),
      icon: <BarChart3 className="h-4 w-4 text-emerald-200" />,
    },
    {
      label: "Custo x retorno",
      value: relationValue,
      icon: <Gauge className="h-4 w-4 text-cyan-200" />,
    },
  ]

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Resumo</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            {campaignKind === "BONUS" ? "Bonus" : "Desafios"} em numeros
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/72">
            {activeCount} ativa(s)
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/72">
            {totalCount} no total
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_70px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {card.icon}
              {card.label}
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight text-white">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
