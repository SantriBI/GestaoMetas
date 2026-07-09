"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { useCountUp } from "@/hooks/useCountUp"
import { KANBAN_COLUNA_CORES, KANBAN_COLUNA_ICONES, KANBAN_COLUNA_LABELS, KanbanColunaData, KanbanColunaId } from "@/lib/kanban"

interface KanbanFunilResumoProps {
  colunas: KanbanColunaData[]
}

const ETAPAS_FUNIL: KanbanColunaId[] = ["A_CONTATAR", "EM_CONTATO", "ORCAMENTO_ENVIADO", "CONVERTIDO"]

export function KanbanFunilResumo({ colunas }: KanbanFunilResumoProps) {
  const porColuna = new Map(colunas.map((coluna) => [coluna.coluna, coluna]))
  const totais = ETAPAS_FUNIL.map((coluna) => porColuna.get(coluna)?.total ?? 0)

  return (
    <div className="flex items-center gap-4 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 shadow-sm">
      {ETAPAS_FUNIL.map((coluna, index) => {
        const total = totais[index]
        const totalAnterior = index > 0 ? totais[index - 1] : null
        const taxaConversao = totalAnterior && totalAnterior > 0 ? Math.round((total / totalAnterior) * 100) : null

        return (
          <div key={coluna} className="flex shrink-0 items-center gap-4">
            <KanbanFunilEtapa coluna={coluna} total={total} Icon={KANBAN_COLUNA_ICONES[coluna]} />
            {index < ETAPAS_FUNIL.length - 1 ? (
              <div className="flex items-center gap-1 text-muted-foreground/60">
                <ChevronRight className="h-4 w-4" />
                {taxaConversao !== null ? <span className="text-xs font-semibold">{taxaConversao}%</span> : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

interface KanbanFunilEtapaProps {
  coluna: KanbanColunaId
  total: number
  Icon: LucideIcon
}

function KanbanFunilEtapa({ coluna, total, Icon }: KanbanFunilEtapaProps) {
  const visual = KANBAN_COLUNA_CORES[coluna]
  const totalAnimado = useCountUp(total)

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: visual.iconBg, color: visual.iconColor }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-base font-bold leading-none tabular-nums text-foreground">{totalAnimado}</span>
      <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
        {KANBAN_COLUNA_LABELS[coluna]}
      </span>
    </div>
  )
}
