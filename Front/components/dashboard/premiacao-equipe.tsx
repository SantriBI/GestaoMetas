"use client"

import { AlertTriangle, Loader2, Sparkles, Trophy } from "lucide-react"
import { formatCurrency } from "@/lib/types"
import type { PremiacaoEquipe, PremiacaoEquipeVendedor } from "@/lib/premiacao-vendedor"

interface PremiacaoEquipeSectionProps {
  premiacao: PremiacaoEquipe | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/35 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? "text-success" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

function ElegibilidadeBadge({ vendedor }: { vendedor: PremiacaoEquipeVendedor }) {
  const className = vendedor.elegivel ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
  const label = vendedor.elegivel ? "Elegível" : "Não elegível"

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  )
}

export function PremiacaoEquipeSection({ premiacao, loading, error, onRetry }: PremiacaoEquipeSectionProps) {
  const resumo = premiacao?.resumo ?? null
  const vendedores = premiacao?.vendedores ?? []
  const shouldScroll = vendedores.length > 6

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Premiação da equipe</h3>
        </div>
        {resumo?.mesReferencia ? (
          <span className="text-xs text-muted-foreground">Referente a {resumo.mesReferencia}</span>
        ) : null}
      </div>

      <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/30 dark:text-amber-200">
        Valores parciais do mês em andamento, atualizados com as vendas recebidas até ontem. Não é o fechamento
        do mês - os números ainda podem mudar até o mês terminar.
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          Carregando a premiação da equipe...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Tentar novamente
          </button>
        </div>
      ) : vendedores.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          Nenhum vendedor com comissão do ERP encontrada para o mês corrente nesta loja.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Elegíveis" value={String(resumo?.totalElegiveis ?? 0)} highlight />
            <StatTile label="Não elegíveis" value={String(resumo?.totalNaoElegiveis ?? 0)} />
            <StatTile label="Premiação a pagar" value={formatCurrency(resumo?.somaValorPremiacaoFinal ?? 0)} highlight />
            <StatTile
              label={`Perto do gatilho (< ${formatCurrency(resumo?.limiarProximoDoGatilho ?? 5000)})`}
              value={String(resumo?.totalProximosDoGatilho ?? 0)}
            />
          </div>

          <div
            className={`space-y-3 md:hidden ${shouldScroll ? "max-h-[29rem] overflow-y-auto pr-1" : ""}`}
          >
            {vendedores.map((vendedor) => (
              <div
                key={vendedor.skVendedor ?? vendedor.vendedorId}
                className="rounded-xl border border-border bg-secondary/35 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{vendedor.nomeVendedor}</div>
                    <div className="mt-1">
                      <ElegibilidadeBadge vendedor={vendedor} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-success">
                    {formatCurrency(vendedor.valorPremiacaoFinal)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Margem + Frete</div>
                    <div className="mt-1 font-medium text-foreground">{formatCurrency(vendedor.margemMaisFrete)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Faixa</div>
                    <div className="mt-1 font-medium text-foreground">{vendedor.faixaAcelerador ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Comissão base (ERP)</div>
                    <div className="mt-1 font-medium text-foreground">{formatCurrency(vendedor.valorComissaoBase)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Bônus fixo</div>
                    <div className="mt-1 font-medium text-foreground">{formatCurrency(vendedor.bonusFixoAdicional)}</div>
                  </div>
                </div>
              </div>
            ))}
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
                  <th className="w-[100px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Margem + Frete
                  </th>
                  <th className="w-[170px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Faixa / Acelerador
                  </th>
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Comissão base (ERP)
                  </th>
                  <th className="w-[110px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bônus fixo
                  </th>
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Premiação final
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((vendedor) => (
                  <tr
                    key={vendedor.skVendedor ?? vendedor.vendedorId}
                    className="border-b border-border transition-colors hover:bg-secondary/60 last:border-0"
                  >
                    <td className="overflow-hidden px-3 py-4">
                      <span className="truncate font-medium text-foreground">{vendedor.nomeVendedor}</span>
                    </td>
                    <td className="overflow-hidden whitespace-nowrap px-3 py-4">
                      <ElegibilidadeBadge vendedor={vendedor} />
                    </td>
                    <td className="overflow-hidden whitespace-nowrap px-3 py-4 text-foreground">
                      {formatCurrency(vendedor.margemMaisFrete)}
                    </td>
                    <td className="overflow-hidden px-3 py-4">
                      <div className="flex flex-col">
                        <span className="truncate text-foreground">{vendedor.faixaAcelerador ?? "-"}</span>
                        <span className="text-xs text-muted-foreground">
                          {(vendedor.percAcelerador * 100).toFixed(0)}% de acelerador
                        </span>
                      </div>
                    </td>
                    <td className="overflow-hidden whitespace-nowrap px-3 py-4 text-foreground">
                      {formatCurrency(vendedor.valorComissaoBase)}
                    </td>
                    <td className="overflow-hidden whitespace-nowrap px-3 py-4 text-foreground">
                      {formatCurrency(vendedor.bonusFixoAdicional)}
                    </td>
                    <td className="overflow-hidden whitespace-nowrap px-3 py-4">
                      <span className="font-semibold text-success">{formatCurrency(vendedor.valorPremiacaoFinal)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
