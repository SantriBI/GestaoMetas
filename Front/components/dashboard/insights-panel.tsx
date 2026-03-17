"use client"

import { Lightbulb, TrendingUp, AlertTriangle, Target } from "lucide-react"
import { VendedorProcessado } from "@/lib/types"

interface InsightsPanelProps {
  vendedores: VendedorProcessado[]
}

export function InsightsPanel({ vendedores }: InsightsPanelProps) {
  if (!vendedores.length) return null

  const sortedByPerc = [...vendedores].sort((a, b) => b.percentual - a.percentual)
  const lider = sortedByPerc[0]
  const emRisco = vendedores.filter(v => v.status === 'risk').length
  
  const metaTotal = vendedores.reduce((s, v) => s + v.meta, 0)
  const receitaTotal = vendedores.reduce((s, v) => s + v.receita, 0)
  const performance = metaTotal > 0 ? Math.round((receitaTotal / metaTotal) * 100) : 0

  const insights = [
    {
      icon: TrendingUp,
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      text: `${lider.nome} lidera com ${lider.percentual}% da meta!`
    },
    {
      icon: AlertTriangle,
      iconBg: "bg-warning/20",
      iconColor: "text-warning",
      text: `${emRisco} vendedor${emRisco !== 1 ? 'es' : ''} precisa${emRisco === 1 ? '' : 'm'} de atencao`
    },
    {
      icon: Target,
      iconBg: "bg-info/20",
      iconColor: "text-info",
      text: `Meta do time: ${performance}% alcancada`
    }
  ]

  return (
    <div className="p-6 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <Lightbulb className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Insights</h3>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div 
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary"
          >
            <div className={`w-8 h-8 rounded-lg ${insight.iconBg} flex items-center justify-center`}>
              <insight.icon className={`w-4 h-4 ${insight.iconColor}`} />
            </div>
            <span className="text-sm text-foreground">{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
