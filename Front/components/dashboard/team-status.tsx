"use client"

import { Users } from "lucide-react"
import { VendedorProcessado, ViewMode } from "@/lib/types"
import { STATUS_CONFIG, VendedorStatus } from "@/lib/status"

interface TeamStatusProps {
  vendedores: VendedorProcessado[]
  viewMode?: ViewMode
}

const GROUP_ORDER: VendedorStatus[] = ["risk", "progress", "achieved"]

function getManchete(status: VendedorStatus, count: number, total: number, percentage: number) {
  switch (status) {
    case "risk":
      return `${count} de ${total} vendedores (${percentage}%) precisam de atenção agora`
    case "progress":
      return `${count} de ${total} vendedores (${percentage}%) estão em progresso rumo à meta`
    case "achieved":
      return `${count} de ${total} vendedores (${percentage}%) já bateram a meta`
  }
}

export function TeamStatus({ vendedores, viewMode = "mensal" }: TeamStatusProps) {
  const total = vendedores.length
  const totalSafe = total || 1

  const groups = GROUP_ORDER.map((status) => {
    const count = vendedores.filter((v) => v.status === status).length
    return {
      status,
      count,
      percentage: Math.round((count / totalSafe) * 100),
    }
  })

  const highlight =
    groups.find((g) => g.status === "risk" && g.count > 0) ??
    groups.find((g) => g.status === "progress" && g.count > 0) ??
    groups.find((g) => g.status === "achieved" && g.count > 0) ??
    null

  return (
    <div className="h-full rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Como a equipe está na meta</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {total} vendedores comparados com a {viewMode === "diario" ? "meta do dia" : "meta mensal"}, do mais crítico ao mais avançado.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200/70">Equipe</p>
          <p className="text-lg font-semibold text-emerald-200">{vendedores.length}</p>
        </div>
      </div>

      {highlight ? (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 text-sm font-medium ${STATUS_CONFIG[highlight.status].bgSoft} ${STATUS_CONFIG[highlight.status].textColor}`}
        >
          {getManchete(highlight.status, highlight.count, total, highlight.percentage)}
        </div>
      ) : null}

      <div className="space-y-4">
        {groups.map((group) => {
          const config = STATUS_CONFIG[group.status]
          return (
            <div key={group.status} className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${config.badgeClassName}`}
                >
                  {config.badgeLabel}
                </span>
                <div className="whitespace-nowrap text-right">
                  <span className="text-sm font-semibold text-foreground">{group.count}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {group.count === 1 ? "vendedor" : "vendedores"} · {group.percentage}% do time
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full ${config.barColor} transition-all duration-500`}
                  style={{ width: `${group.percentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{config.criterio(viewMode)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
