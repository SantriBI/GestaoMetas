"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, RadioTower, TrendingDown, TrendingUp } from "lucide-react"
import { RadarAlerta, RadarAlertaTipo } from "@/lib/types"

type AlertStyle = {
  icon: typeof TrendingUp
  containerClassName: string
  iconClassName: string
  badgeClassName: string
  label: string
}

function getAlertStyle(tipo: RadarAlertaTipo): AlertStyle {
  switch (tipo) {
    case "sucesso":
      return {
        icon: TrendingUp,
        containerClassName: "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)]",
        iconClassName: "bg-[rgba(34,197,94,0.14)] text-emerald-300",
        badgeClassName:
          "border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.14)] text-emerald-200",
        label: "SUCESSO",
      }
    case "queda":
      return {
        icon: TrendingDown,
        containerClassName: "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]",
        iconClassName: "bg-[rgba(239,68,68,0.14)] text-red-400",
        badgeClassName:
          "border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.14)] text-red-300",
        label: "QUEDA",
      }
    case "alerta":
    default:
      return {
        icon: AlertTriangle,
        containerClassName: "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)]",
        iconClassName: "bg-[rgba(245,158,11,0.14)] text-amber-400",
        badgeClassName:
          "border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.14)] text-amber-300",
        label: "ALERTA",
      }
  }
}

type RadarVendasProps = {
  empresaId?: string | number | null
}

async function fetchRadarVendas(empresaId?: string | number | null) {
  const params = new URLSearchParams()
  if (empresaId !== null && empresaId !== undefined && String(empresaId).trim()) {
    params.set("empresa_id", String(empresaId))
  }

  const query = params.toString()
  const response = await fetch(`/api/radar-vendas${query ? `?${query}` : ""}`, {
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Falha ao carregar radar de vendas")
  }

  const json = await response.json()
  return Array.isArray(json?.alertas) ? (json.alertas as RadarAlerta[]) : []
}

function RadarSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[90px] rounded-xl border theme-shell-panel animate-pulse"
        />
      ))}
    </div>
  )
}

function RadarAlertList({ alertas }: { alertas: RadarAlerta[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {alertas.map((alerta, index) => {
        const style = getAlertStyle(alerta.tipo_alerta)
        const Icon = style.icon

        return (
          // Renderiza um alerta do Radar de Vendas.
          <article
            key={`${alerta.tipo_alerta}-${index}`}
            className={`min-h-[90px] rounded-xl border px-[18px] py-4 ${style.containerClassName}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconClassName}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2">
                  {/* Aplica estilo baseado no tipo do alerta. */}
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${style.badgeClassName}`}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="text-sm leading-6 text-foreground">{alerta.mensagem}</p>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function RadarVendas({ empresaId }: RadarVendasProps) {
  const [alertas, setAlertas] = useState<RadarAlerta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregarRadar() {
      setIsLoading(true)
      setError(null)

      try {
        const dados = await fetchRadarVendas(empresaId)
        if (ativo) {
          setAlertas(dados)
        }
      } catch (err) {
        if (ativo) {
          setError(err instanceof Error ? err.message : "Erro ao carregar radar")
        }
      } finally {
        if (ativo) {
          setIsLoading(false)
        }
      }
    }

    carregarRadar()

    return () => {
      ativo = false
    }
  }, [empresaId])

  return (
    <section className="h-full rounded-[28px] border bg-card p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <RadioTower className="h-5 w-5 text-emerald-300" />
            <h3 className="font-semibold text-foreground">Radar de Vendas</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Mostra sinais de aceleracao, queda e alerta comparando os ultimos 30 dias com os 30 dias imediatamente anteriores.
          </p>
        </div>
      </div>

      {isLoading ? <RadarSkeleton /> : null}

      {!isLoading && error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!isLoading && !error ? <RadarAlertList alertas={alertas} /> : null}
    </section>
  )
}

