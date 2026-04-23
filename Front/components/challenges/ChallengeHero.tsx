import type { ReactNode } from "react"

export function ChallengeHero({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_26%),radial-gradient(circle_at_left,rgba(56,189,248,0.16),transparent_28%),linear-gradient(145deg,rgba(8,13,24,0.98),rgba(15,23,42,0.96),rgba(24,24,52,0.94))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:p-8">
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/80">{eyebrow}</p>
          <h1 className="mt-3 text-[2rem] font-black tracking-tight text-white sm:text-[3rem]">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-200 sm:text-base">{description}</p>
        </div>
        {action}
      </div>
    </section>
  )
}
