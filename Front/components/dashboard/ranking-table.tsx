"use client"

import { useState } from "react"
import { Users } from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"
import { VendedorPanoramaModal } from "@/components/dashboard/VendedorPanoramaModal"

interface RankingTableProps {
  vendedores: VendedorProcessado[]
  viewMode: "mensal" | "diario"
  empresaId?: string | number | null
}

export function RankingTable({ vendedores, viewMode, empresaId }: RankingTableProps) {
  const [panoramaAberto, setPanoramaAberto] = useState(false)
  const [vendedorSelecionado, setVendedorSelecionado] = useState<number | null>(null)
  const [nomeVendedorSelecionado, setNomeVendedorSelecionado] = useState<string | null>(null)
  const sortedVendedores = [...vendedores].sort((a, b) => b.percentual - a.percentual)
  const shouldScroll = sortedVendedores.length > 6

  function abrirPanorama(vendedorId: number, nomeVendedor: string) {
    setVendedorSelecionado(vendedorId)
    setNomeVendedorSelecionado(nomeVendedor)
    setPanoramaAberto(true)
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "achieved":
        return { label: "Alta Performance", className: "bg-success/20 text-success" }
      case "progress":
        return { label: "Em Progresso", className: "bg-warning/20 text-warning" }
      case "risk":
        return { label: "Atenção", className: "bg-destructive/20 text-destructive" }
      default:
        return { label: "N/A", className: "bg-muted text-muted-foreground" }
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-6 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Equipe</h3>
        </div>

        <div className="space-y-3 md:hidden">
          {sortedVendedores.map((vendedor) => {
            const badge = getStatusBadge(vendedor.status)
            const progressoDiario =
              vendedor.metaDia && vendedor.metaDia > 0
                ? Math.min((vendedor.receita / vendedor.metaDia) * 100, 100)
                : 0
            const saldoDia =
              viewMode === "diario" && vendedor.metaDia
                ? vendedor.receita - vendedor.metaDia
                : null
            const progressoFinal =
              viewMode === "diario" ? progressoDiario : vendedor.percentual
            const faltaMensal =
              viewMode === "mensal" ? vendedor.meta - vendedor.receita : null

            return (
              <button
                key={vendedor.id}
                type="button"
                className="w-full rounded-xl border border-border bg-secondary/35 p-4 text-left transition-colors hover:bg-secondary/60"
                onClick={() => abrirPanorama(vendedor.id, vendedor.nome)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {vendedor.iniciais}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{vendedor.nome}</div>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-success">
                        {formatCurrency(vendedor.receita)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {viewMode === "mensal" ? "Meta mensal" : "Meta do dia"}
                        </div>
                        <div className="mt-1 font-medium text-foreground">
                          {formatCurrency(viewMode === "mensal" ? vendedor.meta : vendedor.metaDia ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {viewMode === "mensal" ? "Falta p/ meta" : "Saldo do dia"}
                        </div>
                        <div className="mt-1 font-medium text-foreground">
                          {viewMode === "diario" ? (
                            saldoDia !== null && saldoDia >= 0 ? (
                              <span className="font-semibold text-success">OK</span>
                            ) : (
                              <span className="font-semibold text-destructive">
                                {formatCurrency(Math.abs(saldoDia ?? 0))}
                              </span>
                            )
                          ) : faltaMensal !== null && faltaMensal > 0 ? (
                            <span className="font-semibold text-destructive">
                              {formatCurrency(faltaMensal)}
                            </span>
                          ) : (
                            <span className="font-semibold text-success">OK</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progresso</span>
                        <span>{Math.round(progressoFinal)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-success transition-all duration-500"
                          style={{ width: `${Math.min(progressoFinal, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div
          className={`hidden overflow-x-auto md:block ${
            shouldScroll ? "max-h-[29rem] overflow-y-auto pr-1" : ""
          }`}
        >
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vendedor
                </th>

                {viewMode === "mensal" ? (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meta Mensal
                  </th>
                ) : (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meta do Dia
                  </th>
                )}

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receita
                </th>

                {viewMode === "mensal" ? (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Falta p/ Meta
                  </th>
                ) : (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saldo do Dia
                  </th>
                )}

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Progresso
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedVendedores.map((vendedor) => {
                const badge = getStatusBadge(vendedor.status)
                const progressoDiario =
                  vendedor.metaDia && vendedor.metaDia > 0
                    ? Math.min((vendedor.receita / vendedor.metaDia) * 100, 100)
                    : 0
                const saldoDia =
                  viewMode === "diario" && vendedor.metaDia
                    ? vendedor.receita - vendedor.metaDia
                    : null
                const progressoFinal =
                  viewMode === "diario" ? progressoDiario : vendedor.percentual
                const faltaMensal =
                  viewMode === "mensal" ? vendedor.meta - vendedor.receita : null

                return (
                    <tr
                      key={vendedor.id}
                      className="cursor-pointer border-b border-border transition-colors hover:bg-secondary/60 last:border-0"
                      onClick={() => abrirPanorama(vendedor.id, vendedor.nome)}
                    >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {vendedor.iniciais}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{vendedor.nome}</div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-foreground">
                      {formatCurrency(viewMode === "mensal" ? vendedor.meta : vendedor.metaDia ?? 0)}
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-semibold text-success">
                        {formatCurrency(vendedor.receita)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {viewMode === "diario" ? (
                        saldoDia !== null && saldoDia >= 0 ? (
                          <span className="font-semibold text-success">OK</span>
                        ) : (
                          <span className="font-semibold text-destructive">
                            {formatCurrency(Math.abs(saldoDia ?? 0))}
                          </span>
                        )
                      ) : faltaMensal !== null && faltaMensal > 0 ? (
                        <span className="font-semibold text-destructive">
                          {formatCurrency(faltaMensal)}
                        </span>
                      ) : (
                        <span className="font-semibold text-success">OK</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="w-24">
                        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-success transition-all duration-500"
                            style={{ width: `${Math.min(progressoFinal, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(progressoFinal)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <VendedorPanoramaModal
        vendedorId={vendedorSelecionado}
        nomeVendedor={nomeVendedorSelecionado}
        empresaId={empresaId}
        open={panoramaAberto}
        onOpenChange={setPanoramaAberto}
      />
    </>
  )
}
