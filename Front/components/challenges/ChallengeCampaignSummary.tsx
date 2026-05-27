"use client"

import { BarChart3, Coins, Gauge, Wallet } from "lucide-react"
import { formatCurrencyBRL, type ChallengesResponse } from "@/lib/challenges"

export function ChallengeCampaignSummary({
  summary,
  activeCount = 0,
  totalCount = 0,
}: {
  summary: ChallengesResponse["summary"] | null | undefined
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
      label: "Bonus",
      value: formatCurrencyBRL(Number(summary?.estimatedRewardTotal ?? 0)),
      icon: <Coins className="h-4 w-4 text-amber-200" />,
    },
    {
      label: "Pago",
      value: formatCurrencyBRL(Number(summary?.paidRewardTotal ?? 0)),
      icon: <Wallet className="h-4 w-4 text-rose-200" />,
    },
    {
      label: "Faturado",
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
    <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/36">Panorama</p>
          <p className="mt-2 text-sm font-medium text-white/48">{activeCount} ativa(s) | {totalCount} total</p>
        </div>

        <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4 lg:max-w-[980px]">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-[20px] border border-white/[0.05] bg-white/[0.03] px-4 py-3.5 transition hover:bg-white/[0.045]"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {card.icon}
                {card.label}
              </div>
              <p className="mt-2.5 text-base font-semibold text-white">{card.value}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
