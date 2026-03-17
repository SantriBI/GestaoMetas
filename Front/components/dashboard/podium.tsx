"use client"

import { Crown, Flag, Trophy } from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"

interface PodiumProps {
  vendedores: VendedorProcessado[]
  viewMode?: "mensal" | "diario"
}

export function Podium({ vendedores, viewMode = "mensal" }: PodiumProps) {
  const sorted = [...vendedores].sort((a, b) => b.percentual - a.percentual)
  const top3 = sorted.slice(0, 3)

  if (top3.length < 3) return null

  const displayOrder = [top3[1], top3[0], top3[2]]

  const medals = [
    {
      position: "2",
      gradient: "from-slate-400 to-slate-500",
      border: "border-slate-400/50",
      bgGradient: "from-slate-400/10 to-transparent",
      shadow: "shadow-slate-400/20",
      standHeight: "h-20",
    },
    {
      position: "1",
      gradient: "from-amber-400 to-amber-600",
      border: "border-amber-400/60",
      bgGradient: "from-amber-400/15 to-transparent",
      shadow: "shadow-amber-400/30",
      standHeight: "h-28",
      isGold: true,
    },
    {
      position: "3",
      gradient: "from-orange-500 to-orange-700",
      border: "border-orange-500/50",
      bgGradient: "from-orange-500/10 to-transparent",
      shadow: "shadow-orange-500/20",
      standHeight: "h-16",
    },
  ]

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          <Flag className="h-3.5 w-3.5" />
          Grid principal
        </div>
        <div className="flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-center font-semibold text-muted-foreground">
            Podio dos Campeoes - {viewMode === "diario" ? "Diario" : "Mensal"}
          </h3>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center">
        {displayOrder.map((vendedor, i) => {
          const medal = medals[i]

          return (
            <div
              key={vendedor.id}
              className="flex flex-col items-center animate-fade-in-up"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <div
                className={`relative mb-3 w-full max-w-[18rem] overflow-hidden rounded-[24px] border-2 bg-card bg-gradient-to-b p-4 shadow-xl transition-transform hover:-translate-y-1 hover:scale-[1.02] sm:w-52 ${medal.bgGradient} ${medal.border} ${medal.shadow}`}
              >
                {medal.isGold ? (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-[-100%] top-0 h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  <div className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${medal.gradient} text-sm font-bold text-white shadow-lg`}>
                    {medal.isGold ? (
                      <Crown className="absolute -top-3.5 left-1/2 h-5 w-5 -translate-x-1/2 text-amber-400" />
                    ) : null}
                    {medal.position}o
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-foreground">{vendedor.nome}</h4>
                    <div className="font-bold text-primary">{formatCurrency(vendedor.receita)}</div>
                    <div className="text-xs text-muted-foreground">{vendedor.percentual}% da meta</div>
                  </div>
                </div>
              </div>

              <div
                className={`flex w-16 items-center justify-center rounded-t-lg bg-gradient-to-b text-xl font-bold text-white shadow-lg sm:w-20 ${medal.gradient} ${medal.standHeight}`}
              >
                {medal.position}o
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
