"use client"

import { Activity, AlertTriangle, Car, Check, Flag, MapPin } from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"

interface ProgressTrailProps {
  vendedores: VendedorProcessado[]
  viewMode?: "mensal" | "diario"
}

export function ProgressTrail({ vendedores, viewMode = "mensal" }: ProgressTrailProps) {
  const sorted = [...vendedores].sort((a, b) => b.percentual - a.percentual)
  const trailVendedores = sorted.slice(3)

  if (trailVendedores.length === 0) return null

  const pinColors = [
    "text-primary",
    "text-info",
    "text-warning",
    "text-chart-4",
    "text-pink-500",
    "text-cyan-500",
    "text-orange-500",
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "achieved":
        return Check
      case "risk":
        return AlertTriangle
      default:
        return Activity
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "achieved":
        return "Meta batida"
      case "risk":
        return "Em risco"
      default:
        return "Em progresso"
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case "achieved":
        return "border-success/30 bg-success/20 text-success"
      case "risk":
        return "border-destructive/30 bg-destructive/20 text-destructive"
      default:
        return "border-warning/30 bg-warning/20 text-warning"
    }
  }

  const getProgressBarClass = (status: string) => {
    switch (status) {
      case "achieved":
        return "bg-success"
      case "risk":
        return "bg-destructive"
      default:
        return "bg-warning"
    }
  }

  return (
    <div className="mt-8 h-auto overflow-visible">
      <div className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          <Flag className="h-3.5 w-3.5" />
          Pelotao em disputa
        </div>
        <div className="flex items-center justify-center gap-2">
          <Car className="h-5 w-5 text-primary" />
        </div>
      </div>

      <div className="mb-5 overflow-visible rounded-2xl border border-white/8 bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Ritmo de corrida</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Do 4° lugar em diante, cada vendedor segue vivo na disputa.
            </p>
          </div>
          <div className="rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            {trailVendedores.length} no pelotao
          </div>
        </div>
      </div>

      <div className="mb-4 flex justify-center">
        <svg width="4" height="40" viewBox="0 0 4 40" className="text-border">
          <path d="M2 0 L2 40" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" fill="none" />
        </svg>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        {trailVendedores.map((vendedor, i) => {
          const position = i + 4
          const side = i % 2 === 0 ? "left" : "right"
          const StatusIcon = getStatusIcon(vendedor.status)
          const pinColor = pinColors[i % pinColors.length]

          return (
            <div
              key={vendedor.id}
              className={`flex flex-col items-stretch gap-3 sm:items-center sm:gap-4 ${side === "right" ? "sm:flex-row-reverse" : "sm:flex-row"}`}
            >
              <div
                className={`w-full flex-1 rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_36px_rgba(0,0,0,0.14)] sm:max-w-md ${
                  side === "right" ? "sm:ml-auto" : "sm:mr-auto"
                }`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-primary">
                    {position}o
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-foreground">{vendedor.nome}</h4>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(vendedor.status)}`}>
                      <StatusIcon className="h-3 w-3" />
                      {getStatusLabel(vendedor.status)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Faturamento</span>
                    <span className="font-semibold text-success">{formatCurrency(vendedor.receita)}</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressBarClass(vendedor.status)}`}
                      style={{ width: `${Math.min(vendedor.percentual, 100)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Meta: {formatCurrency(vendedor.meta)}</span>
                    <span
                      className={`font-semibold ${
                        vendedor.status === "achieved"
                          ? "text-success"
                          : vendedor.status === "risk"
                            ? "text-destructive"
                            : "text-warning"
                      }`}
                    >
                      {vendedor.percentual}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row items-center justify-center gap-2 sm:flex-col sm:gap-0">
                <div className="h-8 w-0.5 bg-border" />
                <MapPin className={`h-6 w-6 ${pinColor}`} />
              </div>

              <div className="hidden max-w-md flex-1 sm:block" />
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-3 text-center sm:px-6">
          <Flag className="h-5 w-5 text-primary" />
          <span className="font-semibold text-muted-foreground">
            {viewMode === "diario" ? "LARGADA DO DIA" : "LARGADA DO MES"}
          </span>
        </div>
      </div>
    </div>
  )
}
