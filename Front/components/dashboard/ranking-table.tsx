"use client"

import { useState } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, History, Loader2, Users } from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"
import { getStatusBadge } from "@/lib/status"
import { VendedorPanoramaModal } from "@/components/dashboard/VendedorPanoramaModal"

interface ComparativoVendedor {
  variacaoMesAnterior: number | null
  variacaoAnoAnterior: number | null
}

interface RankingTableProps {
  vendedores: VendedorProcessado[]
  viewMode: "mensal" | "diario"
  empresaId?: string | number | null
  empresaAcesso?: string | null
  periodo?: "atual" | "anterior"
  periodoLoading?: boolean
  periodoError?: string | null
  onTogglePeriodo?: () => void
  onRetryPeriodo?: () => void
  comparativo?: Record<number, ComparativoVendedor>
}

function VariacaoValor({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="text-muted-foreground">Novo</span>
  }

  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <ArrowUp className="h-3.5 w-3.5" />
        {`+${Math.round(value)}%`}
      </span>
    )
  }

  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <ArrowDown className="h-3.5 w-3.5" />
        {`${Math.round(value)}%`}
      </span>
    )
  }

  return <span className="text-muted-foreground">0%</span>
}

export function RankingTable({
  vendedores,
  viewMode,
  empresaId,
  empresaAcesso,
  periodo = "atual",
  periodoLoading = false,
  periodoError = null,
  onTogglePeriodo,
  onRetryPeriodo,
  comparativo,
}: RankingTableProps) {
  const [panoramaAberto, setPanoramaAberto] = useState(false)
  const [vendedorSelecionado, setVendedorSelecionado] = useState<number | null>(null)
  const [nomeVendedorSelecionado, setNomeVendedorSelecionado] = useState<string | null>(null)
  const sortedVendedores = [...vendedores].sort((a, b) => b.percentual - a.percentual)
  const shouldScroll = sortedVendedores.length > 6
  const periodoAnteriorLabel = viewMode === "diario" ? "Dia anterior" : "Mes anterior"
  const periodoVoltarAtualLabel = viewMode === "diario" ? "Voltar para hoje" : "Voltar para o mes atual"
  const mostrarEstadoCarregando = periodo === "anterior" && periodoLoading
  const mostrarEstadoErro = periodo === "anterior" && !periodoLoading && !!periodoError
  const comparativoValores = comparativo ? Object.values(comparativo) : []
  const mostrarColMesAnterior =
    periodo === "atual" && comparativoValores.some((c) => c.variacaoMesAnterior !== null)
  const mostrarColAnoAnterior =
    periodo === "atual" && comparativoValores.some((c) => c.variacaoAnoAnterior !== null)
  const mostrarComparativo = mostrarColMesAnterior || mostrarColAnoAnterior

  function abrirPanorama(vendedorId: number, nomeVendedor: string) {
    setVendedorSelecionado(vendedorId)
    setNomeVendedorSelecionado(nomeVendedor)
    setPanoramaAberto(true)
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Equipe</h3>
          </div>

          {onTogglePeriodo ? (
            <button
              type="button"
              onClick={onTogglePeriodo}
              disabled={periodoLoading}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {periodoLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <History className="h-3.5 w-3.5" />
              )}
              {periodo === "anterior" ? periodoVoltarAtualLabel : periodoAnteriorLabel}
            </button>
          ) : null}
        </div>

        {mostrarEstadoCarregando ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Carregando {viewMode === "diario" ? "o dia anterior" : "o mes anterior"}...
          </div>
        ) : mostrarEstadoErro ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <span>{periodoError}</span>
            <button
              type="button"
              onClick={() => onRetryPeriodo?.()}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
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
            const comparativoVendedor = comparativo?.[vendedor.id]

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

                    {mostrarComparativo ? (
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        {mostrarColMesAnterior ? (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              vs. mes anterior
                            </div>
                            <div className="mt-1 font-medium">
                              <VariacaoValor value={comparativoVendedor?.variacaoMesAnterior} />
                            </div>
                          </div>
                        ) : null}
                        {mostrarColAnoAnterior ? (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              vs. ano anterior
                            </div>
                            <div className="mt-1 font-medium">
                              <VariacaoValor value={comparativoVendedor?.variacaoAnoAnterior} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vendedor
                </th>

                {viewMode === "mensal" ? (
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meta Mensal
                  </th>
                ) : (
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meta do Dia
                  </th>
                )}

                <th className="w-[145px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receita
                </th>

                {viewMode === "mensal" ? (
                  <th className="w-[140px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Falta p/ Meta
                  </th>
                ) : (
                  <th className="w-[140px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saldo do Dia
                  </th>
                )}

                <th className="w-[105px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Progresso
                </th>

                {mostrarColMesAnterior ? (
                  <th className="w-[95px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vs. Mes Anterior
                  </th>
                ) : null}

                {mostrarColAnoAnterior ? (
                  <th className="w-[95px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vs. Ano Anterior
                  </th>
                ) : null}
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
                const comparativoVendedor = comparativo?.[vendedor.id]

                return (
                    <tr
                      key={vendedor.id}
                      className="cursor-pointer border-b border-border transition-colors hover:bg-secondary/60 last:border-0"
                      onClick={() => abrirPanorama(vendedor.id, vendedor.nome)}
                    >
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {vendedor.iniciais}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">{vendedor.nome}</div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="overflow-hidden whitespace-nowrap px-3 py-4 text-foreground">
                      {formatCurrency(viewMode === "mensal" ? vendedor.meta : vendedor.metaDia ?? 0)}
                    </td>

                    <td className="overflow-hidden whitespace-nowrap px-3 py-4">
                      <span className="font-semibold text-success">
                        {formatCurrency(vendedor.receita)}
                      </span>
                    </td>

                    <td className="overflow-hidden whitespace-nowrap px-3 py-4">
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

                    <td className="px-3 py-4">
                      <div className="w-full max-w-[76px]">
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

                    {mostrarColMesAnterior ? (
                      <td className="overflow-hidden whitespace-nowrap px-3 py-4">
                        <VariacaoValor value={comparativoVendedor?.variacaoMesAnterior} />
                      </td>
                    ) : null}

                    {mostrarColAnoAnterior ? (
                      <td className="overflow-hidden whitespace-nowrap px-3 py-4">
                        <VariacaoValor value={comparativoVendedor?.variacaoAnoAnterior} />
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>

      <VendedorPanoramaModal
        vendedorId={vendedorSelecionado}
        nomeVendedor={nomeVendedorSelecionado}
        empresaId={empresaId}
        empresaAcesso={empresaAcesso}
        open={panoramaAberto}
        onOpenChange={setPanoramaAberto}
      />
    </>
  )
}
