"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Flame, GripVertical, Hand, RefreshCw } from "lucide-react"
import { KanbanCard, formatCurrencyBRL, getRfvVisual } from "@/lib/kanban"

interface KanbanCardItemProps {
  card: KanbanCard
  accentColor: string
  onClick: () => void
}

const PRIORIDADE_QUENTE_LIMIAR = 0.66

export function KanbanCardItem({ card, accentColor, onClick }: KanbanCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: accentColor,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className="relative cursor-pointer rounded-lg border border-l-4 border-border bg-card p-3 pr-8 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        aria-label="Arrastar card para outra coluna"
        className="absolute right-1 top-1 flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-foreground/5 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <KanbanCardBody card={card} />
    </div>
  )
}

export function KanbanCardItemOverlay({ card, accentColor }: { card: KanbanCard; accentColor: string }) {
  return (
    <div
      style={{ borderLeftColor: accentColor }}
      className="scale-105 rotate-1 rounded-lg border border-l-4 border-border bg-card p-3 text-sm shadow-[0_20px_45px_rgba(0,0,0,0.45)]"
    >
      <KanbanCardBody card={card} />
    </div>
  )
}

function KanbanCardBody({ card }: { card: KanbanCard }) {
  const rfvVisual = getRfvVisual(card.classificacao_rfv)
  const isQuente = card.prioridade !== null && card.prioridade >= PRIORIDADE_QUENTE_LIMIAR

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold uppercase leading-tight text-foreground">
          {card.nome_cliente ?? "Cliente sem nome"}
        </span>
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground"
          title={card.origem_status === "MANUAL" ? "Movimentação manual" : "Sincronizado automaticamente"}
        >
          {card.origem_status === "MANUAL" ? <Hand className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
        </span>
      </div>

      {card.valor_orcamento !== null && card.valor_orcamento !== undefined ? (
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrencyBRL(card.valor_orcamento)}
        </span>
      ) : (
        <span className="text-xs italic text-muted-foreground/60">Valor não informado</span>
      )}

      {isQuente || rfvVisual ? (
        <div className="flex flex-wrap gap-1.5">
          {isQuente ? (
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 dark:text-amber-400" style={{ backgroundColor: "rgba(245,158,11,0.16)" }}>
              <Flame className="h-3 w-3" /> QUENTE
            </span>
          ) : null}
          {rfvVisual ? (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{ backgroundColor: rfvVisual.bg, color: rfvVisual.accent }}
            >
              {rfvVisual.label}
            </span>
          ) : null}
        </div>
      ) : null}

      {card.prioridade !== null ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(card.prioridade * 100)}%`, backgroundColor: "#f59e0b" }}
          />
        </div>
      ) : null}
    </div>
  )
}
