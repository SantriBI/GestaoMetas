import type { ReactNode } from "react"

export function ChallengeSummaryCards({
  cards,
}: {
  cards: Array<{ label: string; value: string | number; description?: string; icon?: ReactNode }>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_18px_70px_rgba(15,23,42,0.24)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {card.icon}
            {card.label}
          </div>
          <p className="mt-4 text-3xl font-black tracking-tight text-white">{card.value}</p>
          {card.description ? <p className="mt-3 text-sm leading-6 text-white/52">{card.description}</p> : null}
        </article>
      ))}
    </div>
  )
}
