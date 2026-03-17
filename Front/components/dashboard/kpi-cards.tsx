"use client"

import { Users, Target, DollarSign, TrendingUp } from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"

interface KPICardsProps {
  vendedores: VendedorProcessado[]
}

export function KPICards({ vendedores }: KPICardsProps) {
  const totalVendedores = vendedores.length
  const metaTotal = vendedores.reduce((sum, v) => sum + v.meta, 0)
  const receitaTotal = vendedores.reduce((sum, v) => sum + v.receita, 0)
  const performanceMedia = metaTotal > 0 ? Math.round((receitaTotal / metaTotal) * 100) : 0
  const vendedoresEmAlta = vendedores.filter((v) => v.status === "achieved").length
  const restanteMeta = Math.max(metaTotal - receitaTotal, 0)

  const kpis = [
    {
      label: "Vendedores Ativos",
      value: totalVendedores.toString(),
      change: `${vendedoresEmAlta} em alta performance`,
      icon: Users,
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      accent: "from-emerald-500/16 via-emerald-400/6 to-transparent",
    },
    {
      label: "Meta Total",
      value: formatCurrency(metaTotal),
      change: restanteMeta > 0 ? `${formatCurrency(restanteMeta)} para fechar` : "Meta consolidada atingida",
      icon: Target,
      iconBg: "bg-info/15",
      iconColor: "text-info",
      accent: "from-emerald-400/12 via-emerald-300/5 to-transparent",
    },
    {
      label: "Receita Total",
      value: formatCurrency(receitaTotal),
      change: "Acumulado da equipe",
      icon: DollarSign,
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      accent: "from-amber-400/12 via-amber-300/5 to-transparent",
    },
    {
      label: "Performance",
      value: `${performanceMedia}%`,
      change: performanceMedia >= 100 ? "Meta alcancada" : "da meta alcancada",
      icon: TrendingUp,
      iconBg: "bg-chart-4/15",
      iconColor: "text-chart-4",
      accent: "from-emerald-500/16 via-emerald-300/5 to-transparent",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className={`group relative overflow-hidden rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_20px_45px_rgba(0,0,0,0.16)]`}
        >
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${kpi.accent}`} />
          <div className="relative flex items-center gap-3 mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${kpi.iconBg} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
              <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
          </div>
          <div className="relative">
            <div className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{kpi.change}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
