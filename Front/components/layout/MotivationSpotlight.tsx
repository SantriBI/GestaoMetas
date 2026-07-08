"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles, X } from "lucide-react"
import { useTheme } from "next-themes"
import type { MotivationMessage, MotivationTone } from "@/lib/motivation"

function getToneClasses(tone: MotivationTone, isDark: boolean) {
  if (!isDark) {
    switch (tone) {
      case "sky":
        return {
          shell: "border-sky-200/60 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_24%),linear-gradient(135deg,rgba(240,249,255,0.96),rgba(255,255,255,0.98))]",
          badge: "border-sky-300/40 bg-sky-100 text-sky-700",
          chip: "border-sky-300/30 bg-sky-50 text-sky-600",
          cta: "border-sky-300/40 bg-sky-100 text-sky-700 hover:bg-sky-200",
          eyebrow: "border-slate-200/60 bg-white/80 text-slate-500",
          headline: "text-slate-900",
          body: "text-slate-600",
        }
      case "amber":
        return {
          shell: "border-amber-200/60 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_24%),linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]",
          badge: "border-amber-300/40 bg-amber-100 text-amber-700",
          chip: "border-amber-300/30 bg-amber-50 text-amber-600",
          cta: "border-amber-300/40 bg-amber-100 text-amber-700 hover:bg-amber-200",
          eyebrow: "border-slate-200/60 bg-white/80 text-slate-500",
          headline: "text-slate-900",
          body: "text-slate-600",
        }
      case "violet":
        return {
          shell: "border-violet-200/60 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.08),transparent_24%),linear-gradient(135deg,rgba(245,243,255,0.96),rgba(255,255,255,0.98))]",
          badge: "border-violet-300/40 bg-violet-100 text-violet-700",
          chip: "border-violet-300/30 bg-violet-50 text-violet-600",
          cta: "border-violet-300/40 bg-violet-100 text-violet-700 hover:bg-violet-200",
          eyebrow: "border-slate-200/60 bg-white/80 text-slate-500",
          headline: "text-slate-900",
          body: "text-slate-600",
        }
      case "emerald":
      default:
        return {
          shell: "border-emerald-200/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_24%),linear-gradient(135deg,rgba(240,253,244,0.96),rgba(255,255,255,0.98))]",
          badge: "border-emerald-300/40 bg-emerald-100 text-emerald-700",
          chip: "border-emerald-300/30 bg-emerald-50 text-emerald-600",
          cta: "border-emerald-300/40 bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
          eyebrow: "border-slate-200/60 bg-white/80 text-slate-500",
          headline: "text-slate-900",
          body: "text-slate-600",
        }
    }
  }

  switch (tone) {
    case "sky":
      return {
        shell: "border-sky-300/18 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_24%),linear-gradient(135deg,rgba(8,24,44,0.92),rgba(10,18,32,0.96))]",
        badge: "border-sky-300/18 bg-sky-400/10 text-sky-100",
        chip: "border-sky-300/14 bg-sky-400/10 text-sky-100/86",
        cta: "border-sky-300/18 bg-sky-400/12 text-sky-50 hover:bg-sky-400/18",
        eyebrow: "border-white/10 bg-white/6 text-white/76",
        headline: "text-white",
        body: "text-white/72",
      }
    case "amber":
      return {
        shell: "border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_24%),linear-gradient(135deg,rgba(42,24,10,0.92),rgba(16,20,32,0.96))]",
        badge: "border-amber-300/18 bg-amber-400/10 text-amber-50",
        chip: "border-amber-300/14 bg-amber-400/10 text-amber-50/86",
        cta: "border-amber-300/18 bg-amber-400/12 text-amber-50 hover:bg-amber-400/18",
        eyebrow: "border-white/10 bg-white/6 text-white/76",
        headline: "text-white",
        body: "text-white/72",
      }
    case "violet":
      return {
        shell: "border-violet-300/18 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_24%),linear-gradient(135deg,rgba(34,19,53,0.92),rgba(11,18,32,0.96))]",
        badge: "border-violet-300/18 bg-violet-400/10 text-violet-50",
        chip: "border-violet-300/14 bg-violet-400/10 text-violet-50/86",
        cta: "border-violet-300/18 bg-violet-400/12 text-violet-50 hover:bg-violet-400/18",
        eyebrow: "border-white/10 bg-white/6 text-white/76",
        headline: "text-white",
        body: "text-white/72",
      }
    case "emerald":
    default:
      return {
        shell: "border-emerald-300/18 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_24%),linear-gradient(135deg,rgba(6,40,29,0.92),rgba(8,17,30,0.96))]",
        badge: "border-emerald-300/18 bg-emerald-400/10 text-emerald-50",
        chip: "border-emerald-300/14 bg-emerald-400/10 text-emerald-50/86",
        cta: "border-emerald-300/18 bg-emerald-400/12 text-emerald-50 hover:bg-emerald-400/18",
        eyebrow: "border-white/10 bg-white/6 text-white/76",
        headline: "text-white",
        body: "text-white/72",
      }
  }
}

export function MotivationSpotlight({
  message,
  compact = false,
  onClose,
  closeLabel = "Fechar banner de motivacao",
}: {
  message: MotivationMessage
  compact?: boolean
  onClose?: () => void
  closeLabel?: string
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : true
  const tone = getToneClasses(message.tone, isDark)

  return (
    <section className={`relative overflow-hidden border ${isDark ? "shadow-[0_18px_48px_rgba(2,6,23,0.18)]" : "shadow-[0_8px_24px_rgba(0,0,0,0.06)]"} ${tone.shell} ${compact ? "rounded-[24px] p-4 sm:p-[18px]" : "rounded-[28px] p-5 sm:p-6"}`}>
      {isDark && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-4 h-28 w-28 rounded-full bg-white/6 blur-3xl" />
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/6 blur-3xl" />
        </div>
      )}

      <div className={`relative ${compact ? "space-y-3" : "space-y-4"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border font-semibold uppercase ${tone.eyebrow} ${compact ? "px-2.5 py-1 text-[10px] tracking-[0.16em]" : "px-3 py-1 text-[11px] tracking-[0.2em]"}`}>
              <Sparkles className="h-3.5 w-3.5" />
              {message.eyebrow}
            </div>
            <h2 className={`${tone.headline} ${compact ? "mt-2.5 text-lg" : "mt-3 text-2xl"} font-black tracking-tight`}>
              {message.headline}
            </h2>
            <p className={`${tone.body} ${compact ? "mt-1.5 max-w-2xl text-[13px] leading-[1.35rem]" : "mt-2 max-w-3xl text-sm leading-6"}`}>
              {message.body}
            </p>
          </div>

          <div className="flex self-end sm:self-auto">
            <div className="flex items-start gap-2">
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                {message.badge}
              </div>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={`inline-flex items-center justify-center rounded-full transition-colors ${isDark ? "border border-white/12 bg-white/8 text-white/72 hover:bg-white/14 hover:text-white" : "border border-slate-200/60 bg-white/80 text-slate-500 hover:bg-slate-100 hover:text-slate-700"} ${compact ? "h-7 w-7" : "h-8 w-8"}`}
                  aria-label={closeLabel}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {message.highlights.map((highlight) => (
            <span
              key={highlight}
              className={`rounded-full border font-medium ${tone.chip} ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
            >
              {highlight}
            </span>
          ))}
        </div>

        {message.ctaLabel && message.ctaHref ? (
          <Link
            href={message.ctaHref}
            className={`inline-flex items-center gap-2 rounded-full border font-semibold transition-colors ${tone.cta} ${compact ? "px-3.5 py-1.5 text-[13px]" : "px-4 py-2 text-sm"}`}
          >
            {message.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </section>
  )
}
