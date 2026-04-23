"use client"

import { ArrowRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type CardDashboardTheme = {
  surface: string
  active: string
  hoverGlow: string
  iconWrap: string
  iconColor: string
  tag: string
  badge: string
  cta: string
  dot: string
}

export const dashboardCardThemes: Record<"sky" | "emerald" | "amber" | "cyan" | "rose" | "violet", CardDashboardTheme> = {
  sky: {
    surface:
      "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_28%),linear-gradient(165deg,rgba(10,30,48,0.98),rgba(8,18,31,0.96),rgba(6,13,23,0.98))]",
    active: "border-sky-300/28 shadow-[0_20px_42px_rgba(56,189,248,0.16)]",
    hoverGlow: "bg-sky-400/18",
    iconWrap: "bg-[linear-gradient(160deg,rgba(56,189,248,0.18),rgba(59,130,246,0.12))]",
    iconColor: "text-sky-100",
    tag: "text-sky-100/72",
    badge: "border-sky-200/14 bg-sky-400/12 text-sky-50/92",
    cta: "border-sky-200/14 bg-sky-400/12 text-sky-50 group-hover:bg-sky-400/18",
    dot: "bg-sky-300",
  },
  emerald: {
    surface:
      "bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.11),transparent_28%),linear-gradient(165deg,rgba(8,35,28,0.98),rgba(7,20,18,0.96),rgba(6,13,18,0.98))]",
    active: "border-emerald-300/28 shadow-[0_20px_42px_rgba(34,197,94,0.16)]",
    hoverGlow: "bg-emerald-400/18",
    iconWrap: "bg-[linear-gradient(160deg,rgba(52,211,153,0.16),rgba(74,222,128,0.1))]",
    iconColor: "text-emerald-100",
    tag: "text-emerald-100/72",
    badge: "border-emerald-200/14 bg-emerald-400/12 text-emerald-50/92",
    cta: "border-emerald-200/14 bg-emerald-400/12 text-emerald-50 group-hover:bg-emerald-400/18",
    dot: "bg-emerald-300",
  },
  amber: {
    surface:
      "bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(165deg,rgba(43,28,10,0.98),rgba(24,18,11,0.96),rgba(10,13,18,0.98))]",
    active: "border-amber-300/28 shadow-[0_20px_42px_rgba(245,158,11,0.16)]",
    hoverGlow: "bg-amber-300/18",
    iconWrap: "bg-[linear-gradient(160deg,rgba(251,191,36,0.18),rgba(249,115,22,0.1))]",
    iconColor: "text-amber-50",
    tag: "text-amber-100/74",
    badge: "border-amber-200/14 bg-amber-300/12 text-amber-50/92",
    cta: "border-amber-200/14 bg-amber-300/12 text-amber-50 group-hover:bg-amber-300/18",
    dot: "bg-amber-300",
  },
  cyan: {
    surface:
      "bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.12),transparent_28%),linear-gradient(165deg,rgba(8,33,36,0.98),rgba(7,19,22,0.96),rgba(7,14,20,0.98))]",
    active: "border-cyan-300/28 shadow-[0_20px_42px_rgba(34,211,238,0.16)]",
    hoverGlow: "bg-cyan-300/18",
    iconWrap: "bg-[linear-gradient(160deg,rgba(34,211,238,0.16),rgba(20,184,166,0.1))]",
    iconColor: "text-cyan-100",
    tag: "text-cyan-100/72",
    badge: "border-cyan-200/14 bg-cyan-400/12 text-cyan-50/92",
    cta: "border-cyan-200/14 bg-cyan-400/12 text-cyan-50 group-hover:bg-cyan-400/18",
    dot: "bg-cyan-300",
  },
  rose: {
    surface:
      "bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.13),transparent_28%),linear-gradient(165deg,rgba(55,18,34,0.98),rgba(31,16,21,0.96),rgba(13,14,20,0.98))]",
    active: "border-rose-300/28 shadow-[0_20px_42px_rgba(244,63,94,0.16)]",
    hoverGlow: "bg-rose-300/18",
    iconWrap: "bg-[linear-gradient(160deg,rgba(251,113,133,0.18),rgba(249,115,22,0.1))]",
    iconColor: "text-rose-50",
    tag: "text-rose-100/72",
    badge: "border-rose-200/14 bg-rose-300/12 text-rose-50/92",
    cta: "border-rose-200/14 bg-rose-300/12 text-rose-50 group-hover:bg-rose-300/18",
    dot: "bg-rose-300",
  },
  violet: {
    surface:
      "bg-[radial-gradient(circle_at_top_right,rgba(196,181,253,0.13),transparent_28%),linear-gradient(165deg,rgba(28,19,47,0.98),rgba(18,14,30,0.96),rgba(10,11,20,0.98))]",
    active: "border-violet-300/28 shadow-[0_20px_42px_rgba(168,85,247,0.16)]",
    hoverGlow: "bg-violet-300/18",
    iconWrap: "bg-[linear-gradient(160deg,rgba(167,139,250,0.18),rgba(139,92,246,0.1))]",
    iconColor: "text-violet-100",
    tag: "text-violet-100/72",
    badge: "border-violet-200/14 bg-violet-300/12 text-violet-50/92",
    cta: "border-violet-200/14 bg-violet-300/12 text-violet-50 group-hover:bg-violet-300/18",
    dot: "bg-violet-300",
  },
}

type CardDashboardProps = {
  title: string
  description: string
  icon: LucideIcon
  gradient: CardDashboardTheme
  actionLabel: string
  badge?: string
  highlight?: boolean
  tag?: string
  microcopy?: string
  active?: boolean
  ariaExpanded?: boolean
  onClick: () => void
  className?: string
}

export type CardDashboardConfig = Omit<CardDashboardProps, "className">

export function CardDashboard({
  title,
  description,
  icon: Icon,
  gradient,
  actionLabel,
  badge,
  highlight = false,
  tag,
  microcopy,
  active = false,
  ariaExpanded,
  onClick,
  className,
}: CardDashboardProps) {
  return (
    <button
      type="button"
      aria-expanded={ariaExpanded}
      onClick={onClick}
      className={cn(
        "group relative isolate flex h-full min-h-[198px] cursor-pointer flex-col overflow-hidden rounded-[24px] border border-white/8 p-4 text-left backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:brightness-110 active:scale-[0.98] sm:min-h-[208px] sm:p-5",
        gradient.surface,
        active || highlight
          ? gradient.active
          : "shadow-[0_16px_34px_rgba(0,0,0,0.28)] hover:border-white/14 hover:shadow-[0_22px_44px_rgba(0,0,0,0.34)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
      <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_32%)]" />
      <div
        className={cn(
          "pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100",
          gradient.hoverGlow,
          active || highlight ? "opacity-100" : "opacity-60",
        )}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md",
              gradient.iconWrap,
            )}
          >
            <Icon className={cn("h-5 w-5", gradient.iconColor)} />
          </div>

          {badge ? (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                gradient.badge,
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex-1">
          {tag ? (
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", gradient.tag)}>{tag}</p>
          ) : null}

          <div className="mt-2 space-y-2">
            <h3 className="text-balance text-[1.16rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-[1.22rem]">
              {title}
            </h3>
            <p className="line-clamp-2 text-[13px] leading-5 text-white/72">{description}</p>
          </div>

          {microcopy ? (
            <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-white/62">
              <span className={cn("h-1.5 w-1.5 rounded-full", gradient.dot)} />
              <span className="line-clamp-1">{microcopy}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-white/8 pt-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_rgba(0,0,0,0.2)]",
              gradient.cta,
            )}
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  )
}
