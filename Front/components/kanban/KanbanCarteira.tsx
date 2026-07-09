"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { Archive, HelpCircle, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useKanbanCarteira } from "@/hooks/useKanbanCarteira"
import { KANBAN_COLUNA_CORES, KANBAN_COLUNAS, KanbanCard, KanbanColunaId, normalizarClassificacao } from "@/lib/kanban"
import { KanbanColuna } from "./KanbanColuna"
import { KanbanCardItemOverlay } from "./KanbanCardItem"
import { KanbanFiltros } from "./KanbanFiltros"
import { KanbanFunilResumo } from "./KanbanFunilResumo"
import { KanbanAddClienteDialog } from "./KanbanAddClienteDialog"
import { KanbanCardDrawer } from "./KanbanCardDrawer"
import { KanbanComoFunciona } from "./KanbanComoFunciona"

interface KanbanCarteiraProps {
  skVendedor: number | string
}

export function KanbanCarteira({ skVendedor }: KanbanCarteiraProps) {
  const {
    board,
    arquivados,
    showArchived,
    setShowArchived,
    isBootLoading,
    isArchivedLoading,
    colunasCarregandoMais,
    error,
    lastSyncedAt,
    refresh,
    carregarMaisDaColuna,
    moveCard,
    addCard,
    addInteracao,
    toggleArchive,
    getCardDetail,
  } = useKanbanCarteira(skVendedor)

  const [busca, setBusca] = useState("")
  const [rfvFiltro, setRfvFiltro] = useState("TODAS")
  const [diasSemContatoMin, setDiasSemContatoMin] = useState(0)
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null)
  const [cardSelecionado, setCardSelecionado] = useState<KanbanCard | null>(null)
  const [addDialogAberto, setAddDialogAberto] = useState(false)
  const [comoFuncionaAberto, setComoFuncionaAberto] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const intervalId = window.setInterval(() => setAgora(Date.now()), 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  const rotuloSincronizacao = useMemo(() => {
    if (!lastSyncedAt) return null
    const diffSegundos = Math.floor((agora - lastSyncedAt.getTime()) / 1000)
    if (diffSegundos < 45) return "Atualizado agora"
    const diffMinutos = Math.round(diffSegundos / 60)
    if (diffMinutos < 60) return `Sincronizado há ${diffMinutos} min`
    const diffHoras = Math.round(diffMinutos / 60)
    return `Sincronizado há ${diffHoras}h`
  }, [lastSyncedAt, agora])

  const colunasFiltradas = useMemo(() => {
    if (!board) return []
    const termo = busca.trim().toLowerCase()

    return board.colunas.map((coluna) => ({
      ...coluna,
      cards: coluna.cards.filter((card) => {
        const combinaBusca = !termo || (card.nome_cliente ?? "").toLowerCase().includes(termo)
        const combinaContato = (card.dias_desde_ultimo_sinal ?? 0) >= diasSemContatoMin
        const combinaRfv = rfvFiltro === "TODAS" || normalizarClassificacao(card.classificacao_rfv ?? "").includes(rfvFiltro)
        return combinaBusca && combinaContato && combinaRfv
      }),
    }))
  }, [board, busca, diasSemContatoMin, rfvFiltro])

  function handleDragStart(event: DragStartEvent) {
    const id = Number(event.active.id)
    const card = board?.colunas.flatMap((coluna) => coluna.cards).find((item) => item.id === id) ?? null
    setActiveCard(card)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)
    if (!over || !board) return

    const activeCardId = Number(active.id)
    const overId = String(over.id)

    let colunaDestino: KanbanColunaId | null = null
    if ((KANBAN_COLUNAS as string[]).includes(overId)) {
      colunaDestino = overId as KanbanColunaId
    } else {
      const coluna = board.colunas.find((item) => item.cards.some((card) => String(card.id) === overId))
      colunaDestino = coluna?.coluna ?? null
    }

    if (!colunaDestino) return
    void moveCard(activeCardId, colunaDestino)
  }

  async function handleAddCard(skCliente: number | string, colunaInicial: KanbanColunaId) {
    try {
      await addCard(skCliente, colunaInicial)
      toast.success("Cliente adicionado ao kanban.")
      setAddDialogAberto(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar cliente.")
    }
  }

  if (isBootLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => void refresh()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!board) return null

  const totalClientes = board.colunas.reduce((acc, coluna) => acc + coluna.total, 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Kanban de Carteira</h1>
            <button
              type="button"
              onClick={() => setComoFuncionaAberto(true)}
              className="text-muted-foreground/70 transition-colors hover:text-foreground"
              title="Como funciona"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/60">
            <span>{totalClientes} clientes na esteira</span>
            {rotuloSincronizacao ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {rotuloSincronizacao}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome"
              className="w-48 pl-8"
            />
          </div>
          <KanbanFiltros
            rfvFiltro={rfvFiltro}
            onRfvFiltroChange={setRfvFiltro}
            diasSemContatoMin={diasSemContatoMin}
            onDiasSemContatoMinChange={setDiasSemContatoMin}
          />
          <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
            <Archive className="mr-1 h-4 w-4" /> Arquivados
          </Button>
          <Button onClick={() => setAddDialogAberto(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar cliente
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        <KanbanFunilResumo colunas={board.colunas} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {colunasFiltradas.map((coluna) => (
              <KanbanColuna
                key={coluna.coluna}
                coluna={coluna}
                onCardClick={setCardSelecionado}
                onCarregarMais={carregarMaisDaColuna}
                onAdicionarCliente={() => setAddDialogAberto(true)}
                carregandoMais={colunasCarregandoMais.has(coluna.coluna)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <KanbanCardItemOverlay card={activeCard} accentColor={KANBAN_COLUNA_CORES[activeCard.coluna_atual].accent} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {showArchived ? (
          <div className="max-h-40 shrink-0 overflow-y-auto rounded-xl border border-border p-3">
            <h2 className="mb-2 text-sm font-semibold">Arquivados</h2>
            {isArchivedLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className={cn("flex flex-wrap gap-2", !arquivados?.length && "justify-center")}>
                {(arquivados ?? []).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setCardSelecionado(card)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {card.nome_cliente ?? "Cliente sem nome"}
                  </button>
                ))}
                {!arquivados?.length ? <p className="text-xs text-muted-foreground">Nenhum card arquivado.</p> : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <KanbanAddClienteDialog
        open={addDialogAberto}
        onOpenChange={setAddDialogAberto}
        skVendedor={skVendedor}
        onAdd={handleAddCard}
      />

      <KanbanCardDrawer
        card={cardSelecionado}
        onOpenChange={(open) => !open && setCardSelecionado(null)}
        getCardDetail={getCardDetail}
        onMoveCard={moveCard}
        onAddInteracao={addInteracao}
        onToggleArchive={toggleArchive}
      />

      <KanbanComoFunciona open={comoFuncionaAberto} onOpenChange={setComoFuncionaAberto} />
    </div>
  )
}
