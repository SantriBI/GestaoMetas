"use client"

import { useEffect, useState } from "react"
import { ArrowRight, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"
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

export const dashboardCardThemesLight: Record<"sky" | "emerald" | "amber" | "cyan" | "rose" | "violet", CardDashboardTheme> = {
  sky: {
    surface: "bg-[linear-gradient(165deg,#f0f9ff,#e0f2fe)]",
    active: "border-sky-300 shadow-[0_8px_24px_rgba(56,189,248,0.18)]",
    hoverGlow: "bg-sky-300/20",
    iconWrap: "bg-sky-100",
    iconColor: "text-sky-600",
    tag: "text-sky-500",
    badge: "border-sky-200 bg-sky-100 text-sky-700",
    cta: "border-sky-200 bg-sky-100 text-sky-700 group-hover:bg-sky-200",
    dot: "bg-sky-500",
  },
  emerald: {
    surface: "bg-[linear-gradient(165deg,#f0fdf4,#dcfce7)]",
    active: "border-emerald-300 shadow-[0_8px_24px_rgba(34,197,94,0.18)]",
    hoverGlow: "bg-emerald-300/20",
    iconWrap: "bg-emerald-100",
    iconColor: "text-emerald-600",
    tag: "text-emerald-500",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    cta: "border-emerald-200 bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200",
    dot: "bg-emerald-500",
  },
  amber: {
    surface: "bg-[linear-gradient(165deg,#fffbeb,#fef3c7)]",
    active: "border-amber-300 shadow-[0_8px_24px_rgba(245,158,11,0.18)]",
    hoverGlow: "bg-amber-300/20",
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-600",
    tag: "text-amber-500",
    badge: "border-amber-200 bg-amber-100 text-amber-700",
    cta: "border-amber-200 bg-amber-100 text-amber-700 group-hover:bg-amber-200",
    dot: "bg-amber-500",
  },
  cyan: {
    surface: "bg-[linear-gradient(165deg,#ecfeff,#cffafe)]",
    active: "border-cyan-300 shadow-[0_8px_24px_rgba(34,211,238,0.18)]",
    hoverGlow: "bg-cyan-300/20",
    iconWrap: "bg-cyan-100",
    iconColor: "text-cyan-600",
    tag: "text-cyan-500",
    badge: "border-cyan-200 bg-cyan-100 text-cyan-700",
    cta: "border-cyan-200 bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200",
    dot: "bg-cyan-500",
  },
  rose: {
    surface: "bg-[linear-gradient(165deg,#fff1f2,#ffe4e6)]",
    active: "border-rose-300 shadow-[0_8px_24px_rgba(244,63,94,0.18)]",
    hoverGlow: "bg-rose-300/20",
    iconWrap: "bg-rose-100",
    iconColor: "text-rose-600",
    tag: "text-rose-500",
    badge: "border-rose-200 bg-rose-100 text-rose-700",
    cta: "border-rose-200 bg-rose-100 text-rose-700 group-hover:bg-rose-200",
    dot: "bg-rose-500",
  },
  violet: {
    surface: "bg-[linear-gradient(165deg,#f5f3ff,#ede9fe)]",
    active: "border-violet-300 shadow-[0_8px_24px_rgba(168,85,247,0.18)]",
    hoverGlow: "bg-violet-300/20",
    iconWrap: "bg-violet-100",
    iconColor: "text-violet-600",
    tag: "text-violet-500",
    badge: "border-violet-200 bg-violet-100 text-violet-700",
    cta: "border-violet-200 bg-violet-100 text-violet-700 group-hover:bg-violet-200",
    dot: "bg-violet-500",
  },
}

type CardDashboardProps = {
  title: string
  description: string
  icon: LucideIcon
  gradient: CardDashboardTheme
  gradientLight?: CardDashboardTheme
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
  gradientLight,
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
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = !mounted || resolvedTheme === "dark"
  const g = isDark ? gradient : (gradientLight ?? gradient)

  return (
    <button
      type="button"
      aria-expanded={ariaExpanded}
      onClick={onClick}
      className={cn(
        "group relative isolate flex h-full min-h-[198px] cursor-pointer flex-col overflow-hidden rounded-[24px] p-4 text-left backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:brightness-110 active:scale-[0.98] sm:min-h-[208px] sm:p-5",
        isDark ? "border border-white/8" : "border border-slate-200",
        g.surface,
        active || highlight
          ? g.active
          : isDark
            ? "shadow-[0_16px_34px_rgba(0,0,0,0.28)] hover:border-white/14 hover:shadow-[0_22px_44px_rgba(0,0,0,0.34)]"
            : "shadow-sm hover:border-slate-300 hover:shadow-md",
        className,
      )}
    >
      {isDark && (
        <>
          <div className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_32%)]" />
        </>
      )}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100",
          g.hoverGlow,
          active || highlight ? "opacity-100" : "opacity-60",
        )}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl backdrop-blur-md",
              isDark
                ? "border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "border border-white/80 shadow-sm",
              g.iconWrap,
            )}
          >
            <Icon className={cn("h-5 w-5", g.iconColor)} />
          </div>

          {badge ? (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                g.badge,
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex-1">
          {tag ? (
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", g.tag)}>{tag}</p>
          ) : null}

          <div className="mt-2 space-y-2">
            <h3 className={cn(
              "text-balance text-[1.16rem] font-semibold leading-[1.12] tracking-tight sm:text-[1.22rem]",
              isDark ? "text-white" : "text-slate-900"
            )}>
              {title}
            </h3>
            <p className={cn(
              "line-clamp-2 text-[13px] leading-5",
              isDark ? "text-white/72" : "text-slate-600"
            )}>
              {description}
            </p>
          </div>

          {microcopy ? (
            <div className={cn(
              "mt-4 flex items-center gap-2 text-[12px] font-medium",
              isDark ? "text-white/62" : "text-slate-500"
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", g.dot)} />
              <span className="line-clamp-1">{microcopy}</span>
            </div>
          ) : null}
        </div>

        <div className={cn(
          "mt-4 border-t pt-3",
          isDark ? "border-white/8" : "border-black/8"
        )}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-300 group-hover:-translate-y-0.5",
              isDark
                ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] group-hover:shadow-[0_8px_18px_rgba(0,0,0,0.2)]"
                : "shadow-[inset_0_1px_0_rgba(0,0,0,0.03)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
              g.cta,
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
