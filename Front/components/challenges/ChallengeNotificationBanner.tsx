import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Megaphone, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateBR, getChallengeBannerAsset } from "@/lib/challenges"

export function ChallengeNotificationBanner({
  title,
  href,
  description = "Uma nova campanha entrou no ar para acelerar vendas e abrir recompensa para o time.",
  dataInicio,
  dataFim,
  brandNames,
  onAccept,
  onDismiss,
  onClose,
  loading = false,
  compact = false,
  eyebrow = "Nova campanha",
  supportingLabel = "Campanha pensada para gerar movimento agora",
}: {
  title: string
  href: string
  description?: string
  dataInicio?: string | Date | null
  dataFim?: string | Date | null
  brandNames?: string[]
  onAccept?: () => void
  onDismiss?: () => void
  onClose?: () => void
  loading?: boolean
  compact?: boolean
  eyebrow?: string
  supportingLabel?: string
}) {
  const periodLabel = dataInicio && dataFim ? `${formatDateBR(dataInicio)} ate ${formatDateBR(dataFim)}` : null
  const bannerAsset = getChallengeBannerAsset({ title, brandNames })

  return (
    <section
      className={`relative overflow-hidden border border-amber-300/18 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.24),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.18),transparent_26%),linear-gradient(135deg,rgba(120,53,15,0.94),rgba(17,24,39,0.96),rgba(8,13,24,0.98))] ${compact ? "rounded-[28px] px-4 py-4 shadow-[0_22px_60px_rgba(15,23,42,0.24)] sm:px-5" : "rounded-[32px] px-6 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:px-7"}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-8 top-0 h-24 w-24 rounded-full bg-amber-300/16 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-cyan-300/14 blur-3xl" />
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={`absolute z-10 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/72 transition-colors hover:bg-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "right-3 top-3 h-8 w-8" : "right-4 top-4 h-9 w-9"}`}
          aria-label="Fechar notificacao de campanha"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {bannerAsset ? (
        <div
          className={`relative overflow-hidden border border-white/12 shadow-[0_18px_50px_rgba(2,6,23,0.24)] ${compact ? "mb-4 rounded-[22px] bg-black/28 px-2 py-2 sm:px-3 sm:py-3" : "mb-6 rounded-[24px] bg-black/20"}`}
        >
          <Image
            src={bannerAsset.src}
            alt={bannerAsset.alt}
            width={1600}
            height={520}
            className={compact ? "mx-auto max-h-[152px] w-auto max-w-full object-contain sm:max-h-[220px] lg:max-h-[260px]" : "h-auto w-full object-cover"}
            sizes="(min-width: 1280px) 1000px, (min-width: 640px) calc(100vw - 96px), calc(100vw - 64px)"
          />
        </div>
      ) : null}

      <div className={`relative flex flex-col ${compact ? "gap-4" : "gap-5"} lg:flex-row lg:items-center lg:justify-between`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-2 rounded-full border border-amber-200/18 bg-black/20 font-semibold uppercase text-amber-50 ${compact ? "px-2.5 py-1 text-[10px] tracking-[0.16em]" : "px-3 py-1 text-[11px] tracking-[0.18em]"}`}>
                <Megaphone className="h-3.5 w-3.5" />
                {eyebrow}
              </span>
            {periodLabel ? (
              <span className={`rounded-full border border-white/12 bg-white/8 font-semibold uppercase text-white/70 ${compact ? "px-2.5 py-1 text-[10px] tracking-[0.16em]" : "px-3 py-1 text-[11px] tracking-[0.18em]"}`}>
                {periodLabel}
              </span>
            ) : null}
          </div>

          <h2 className={`${compact ? "mt-3 text-[1.2rem] sm:text-[1.55rem]" : "mt-4 text-[1.9rem] sm:text-[2.35rem]"} font-black tracking-tight text-white`}>
            {title}
          </h2>
          <p className={`${compact ? "mt-2 max-w-2xl text-[13px] leading-6" : "mt-3 max-w-3xl text-sm leading-7"} text-white/72`}>
            {description}
          </p>

          <div className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 font-semibold text-white/76 ${compact ? "mt-3 px-2.5 py-1 text-[11px]" : "mt-4 px-3 py-1 text-xs"}`}>
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            {supportingLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {onAccept ? (
            <Button
              className={`${compact ? "h-9 rounded-xl px-3.5 text-sm" : "rounded-2xl"} bg-[linear-gradient(135deg,#f59e0b,#f97316,#22d3ee)] text-black hover:opacity-95`}
              disabled={loading}
              onClick={onAccept}
            >
              Participar agora
            </Button>
          ) : null}

          {onDismiss ? (
            <Button
              variant="outline"
              className={`${compact ? "h-9 rounded-xl px-3.5 text-sm" : "rounded-2xl"} border-white/15 bg-white/8 text-white hover:bg-white/12`}
              disabled={loading}
              onClick={onDismiss}
            >
              Nao participar
            </Button>
          ) : null}

          <Button asChild variant="ghost" className={`${compact ? "h-9 rounded-xl px-3.5 text-sm" : "rounded-2xl"} text-amber-50 hover:bg-white/10 hover:text-white`}>
            <Link href={href}>
              Ver campanha
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
