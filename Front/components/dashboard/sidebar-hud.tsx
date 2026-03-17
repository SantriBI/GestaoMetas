"use client"

import { useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"

interface SidebarHUDProps {
  vendedores: VendedorProcessado[]
  resumoDiario?: string | null
  resumoMensal?: string | null
  viewMode?: "mensal" | "diario"
}

export function SidebarHUD({ vendedores, resumoDiario, resumoMensal, viewMode = "mensal" }: SidebarHUDProps) {
  const [isResumoOpen, setIsResumoOpen] = useState(true)
  const receitaTotal = vendedores.reduce((s, v) => s + v.receita, 0)
  const metaTotal = vendedores.reduce((s, v) => s + v.meta, 0)
  const percentual = metaTotal > 0 ? Math.round((receitaTotal / metaTotal) * 100) : 0
  const gap = receitaTotal - metaTotal

  const getMetaStatus = () => {
    if (percentual >= 80) return { className: "bg-success/15 text-success", icon: Check, label: "OK" }
    if (percentual >= 60) return { className: "bg-warning/20 text-warning", icon: AlertTriangle, label: "Atencao" }
    return { className: "bg-destructive/20 text-destructive", icon: AlertCircle, label: "Critico" }
  }

  const getGapStatus = () => {
    if (gap >= 0) return { className: "bg-success/15 text-success", icon: Check, label: "Positivo" }
    if (gap >= -50000) return { className: "bg-warning/20 text-warning", icon: AlertTriangle, label: "Atencao" }
    return { className: "bg-destructive/20 text-destructive", icon: AlertCircle, label: "Risco" }
  }

  const metaStatus = getMetaStatus()
  const gapStatus = getGapStatus()
  const ToggleIcon = isResumoOpen ? ChevronDown : ChevronRight

  const items = [
    {
      icon: DollarSign,
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      label: "Receita Total",
      value: formatCurrency(receitaTotal),
      valueColor: "text-primary",
      status: { className: "bg-success/15 text-success", icon: Check, label: "OK" },
    },
    {
      icon: Target,
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      label: "% da Meta",
      value: `${percentual}%`,
      valueColor: percentual >= 80 ? "text-success" : percentual >= 60 ? "text-warning" : "text-destructive",
      status: metaStatus,
    },
    {
      icon: TrendingDown,
      iconBg: gap >= 0 ? "bg-primary/15" : "bg-destructive/20",
      iconColor: gap >= 0 ? "text-primary" : "text-destructive",
      label: "Restante para a meta",
      value: gap >= 0 ? `+${formatCurrency(gap)}` : formatCurrency(gap),
      valueColor: gap >= 0 ? "text-success" : gap >= -50000 ? "text-warning" : "text-destructive",
      status: gapStatus,
    },
  ]

  return (
    <>
      <aside
        className={`hidden xl:block fixed right-0 top-16 bottom-0 z-30 w-[340px] transform overflow-y-auto border-l border-border/80 bg-[linear-gradient(180deg,rgba(10,18,14,0.98),rgba(7,12,10,0.98))] p-6 transition-transform duration-300 ease-in-out ${
          isResumoOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-border/80 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsResumoOpen(false)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={isResumoOpen}
                aria-controls="resumo-kpi-panel"
              >
                  <div className="flex min-w-0 items-center gap-2">
                    <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
                    <h3 className="font-semibold text-foreground">Resumo</h3>
                  </div>
                <ToggleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Indicadores Rápidos do período analisado
              </p>
            </div>
          </div>
        </div>
        <div id="resumo-kpi-panel" className="pt-4">
          <div className="space-y-6">
            {items.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/70 bg-secondary/35 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.iconBg}`}>
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">{item.label}</div>
                    <div className={`text-xl font-bold ${item.valueColor}`}>{item.value}</div>
                  </div>
                  <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${item.status.className}`}>
                    <item.status.icon className="h-3 w-3" />
                    <span>{item.status.label}</span>
                  </div>
                </div>
              </div>
            ))}
            {viewMode === "mensal" && resumoMensal ? (
              <div className="rounded-[24px] border border-emerald-500/14 bg-[linear-gradient(180deg,rgba(34,197,94,0.08),rgba(9,17,13,0.86))] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/14 text-emerald-200">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/70">Resumo do mes</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#c6d8cd]">{resumoMensal}</p>
                  </div>
                </div>
              </div>
            ) : null}
            {viewMode === "diario" && resumoDiario ? (
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-emerald-200">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/55">Resumo do dia</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{resumoDiario}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      {!isResumoOpen ? (
        <button
          type="button"
          onClick={() => setIsResumoOpen(true)}
          className="hidden xl:flex fixed right-0 top-1/2 z-40 -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-border bg-card/95 px-3 py-4 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm"
          aria-label="Abrir painel Resumo"
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Resumo
          </span>
        </button>
      ) : null}
    </>
  )
}
