"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Inbox, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  KANBAN_COLUNA_CORES,
  KANBAN_COLUNA_ICONES,
  KANBAN_COLUNA_LABELS,
  KANBAN_COLUNA_MENSAGEM_VAZIA,
  KanbanCard,
  KanbanColunaData,
  KanbanColunaId,
  formatCurrencyBRL,
} from "@/lib/kanban"
import { KanbanCardItem } from "./KanbanCardItem"

interface KanbanColunaProps {
  coluna: KanbanColunaData
  onCardClick: (card: KanbanCard) => void
  onCarregarMais: (coluna: KanbanColunaId) => void
  onAdicionarCliente: () => void
  carregandoMais: boolean
}

export function KanbanColuna({ coluna, onCardClick, onCarregarMais, onAdicionarCliente, carregandoMais }: KanbanColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.coluna })
  const visual = KANBAN_COLUNA_CORES[coluna.coluna]
  const Icon = KANBAN_COLUNA_ICONES[coluna.coluna]

  const cardsExibidos = coluna.coluna === "A_CONTATAR" ? ordenarPorPrioridade(coluna.cards) : coluna.cards

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-muted/30 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
      <div className="flex shrink-0 flex-col gap-2 rounded-t-xl border-t-4 p-3" style={{ borderTopColor: visual.accent }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: visual.iconBg, color: visual.iconColor }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide text-foreground">
              {KANBAN_COLUNA_LABELS[coluna.coluna]}
            </span>
          </div>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold"
            style={{ backgroundColor: visual.iconBg, color: visual.iconColor }}
          >
            {coluna.total}
          </span>
        </div>
        {coluna.valorAberto > 0 ? (
          <span className="text-xs font-medium" style={{ color: visual.accent }}>
            {formatCurrencyBRL(coluna.valorAberto)}
          </span>
        ) : null}
      </div>

      <div ref={setNodeRef} className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2", isOver && "bg-foreground/5")}>
        <SortableContext items={cardsExibidos.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cardsExibidos.map((card) => (
            <KanbanCardItem key={card.id} card={card} accentColor={visual.accent} onClick={() => onCardClick(card)} />
          ))}
        </SortableContext>

        {!cardsExibidos.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground/40" />
            <p className="max-w-[10rem] text-xs text-muted-foreground/80">{KANBAN_COLUNA_MENSAGEM_VAZIA[coluna.coluna]}</p>
            {coluna.coluna === "A_CONTATAR" ? (
              <Button size="sm" onClick={onAdicionarCliente}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar cliente
              </Button>
            ) : null}
          </div>
        ) : null}

        {coluna.temMais ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full text-xs"
            onClick={() => onCarregarMais(coluna.coluna)}
            disabled={carregandoMais}
          >
            {carregandoMais ? <Loader2 className="h-3 w-3 animate-spin" /> : "Carregar mais"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function ordenarPorPrioridade(cards: KanbanCard[]) {
  return [...cards].sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0))
}
