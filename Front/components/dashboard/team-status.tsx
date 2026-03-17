"use client"

import { Users } from "lucide-react"
import { VendedorProcessado } from "@/lib/types"

interface TeamStatusProps {
  vendedores: VendedorProcessado[]
}

export function TeamStatus({ vendedores }: TeamStatusProps) {
  const total = vendedores.length || 1
  const acimaMeta = vendedores.filter(v => v.status === 'achieved').length
  const naMedia = vendedores.filter(v => v.status === 'progress').length
  const emRisco = vendedores.filter(v => v.status === 'risk').length

  const statuses = [
    {
      label: "Acima da meta",
      count: acimaMeta,
      percentage: Math.round((acimaMeta / total) * 100),
      color: "bg-primary",
      dotColor: "bg-primary"
    },
    {
      label: "Na media",
      count: naMedia,
      percentage: Math.round((naMedia / total) * 100),
      color: "bg-warning",
      dotColor: "bg-warning"
    },
    {
      label: "Precisa de atencao",
      count: emRisco,
      percentage: Math.round((emRisco / total) * 100),
      color: "bg-destructive",
      dotColor: "bg-destructive"
    }
  ]

  return (
    <div className="h-full rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Status da Equipe</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Veja rapidamente quem ja puxou resultado, quem esta no ritmo e onde a atencao precisa entrar primeiro.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/70">Equipe</p>
          <p className="text-lg font-semibold text-emerald-200">{vendedores.length}</p>
        </div>
      </div>

      <div className="space-y-4">
        {statuses.map((status) => (
          <div key={status.label} className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${status.dotColor}`} />
                <div className="text-sm font-medium text-foreground">{status.label}</div>
              </div>
              <div className="text-xl font-bold text-foreground">{status.count}</div>
            </div>
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>Distribuicao</span>
                <span>{status.percentage}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div 
                  className={`h-full rounded-full ${status.color} transition-all duration-500`}
                  style={{ width: `${status.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
