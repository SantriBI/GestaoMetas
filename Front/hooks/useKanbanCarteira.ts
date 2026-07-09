"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  KanbanBoard,
  KanbanCard,
  KanbanCardDetail,
  KanbanColunaId,
  KanbanTipoInteracao,
  addKanbanInteracao,
  createKanbanCard,
  fetchKanbanArquivados,
  fetchKanbanBoard,
  fetchKanbanCardDetail,
  fetchKanbanColunaPagina,
  moveKanbanCard,
  toggleKanbanArquivar,
} from "@/lib/kanban"

export function useKanbanCarteira(skVendedor: number | string | null) {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [arquivados, setArquivados] = useState<KanbanCard[] | null>(null)
  const [diasAtividadeMax, setDiasAtividadeMax] = useState<number | null>(30)
  const [showArchived, setShowArchived] = useState(false)
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isArchivedLoading, setIsArchivedLoading] = useState(false)
  const [colunasCarregandoMais, setColunasCarregandoMais] = useState<Set<KanbanColunaId>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  async function refresh() {
    if (!skVendedor) return
    try {
      setError(null)
      const data = await fetchKanbanBoard(skVendedor, { diasAtividadeMax })
      setBoard(data)
      setLastSyncedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o kanban de carteira.")
    }
  }

  useEffect(() => {
    if (!skVendedor) return
    const currentSkVendedor = skVendedor
    let active = true

    async function bootstrap() {
      try {
        setIsBootLoading(true)
        setError(null)
        const data = await fetchKanbanBoard(currentSkVendedor, { diasAtividadeMax })
        if (!active) return
        setBoard(data)
        setLastSyncedAt(new Date())
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar o kanban de carteira.")
      } finally {
        if (active) setIsBootLoading(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [skVendedor, diasAtividadeMax])

  useEffect(() => {
    if (!skVendedor || !showArchived) return
    const currentSkVendedor = skVendedor
    let active = true

    async function carregarArquivados() {
      try {
        setIsArchivedLoading(true)
        const cards = await fetchKanbanArquivados(currentSkVendedor)
        if (!active) return
        setArquivados(cards)
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Erro ao carregar cards arquivados.")
      } finally {
        if (active) setIsArchivedLoading(false)
      }
    }

    void carregarArquivados()
    return () => {
      active = false
    }
  }, [skVendedor, showArchived])

  async function carregarMaisDaColuna(coluna: KanbanColunaId) {
    if (!skVendedor || !board) return
    const colunaAtual = board.colunas.find((item) => item.coluna === coluna)
    if (!colunaAtual) return

    setColunasCarregandoMais((prev) => new Set(prev).add(coluna))
    try {
      const proximaPagina = await fetchKanbanColunaPagina(skVendedor, coluna, {
        offset: colunaAtual.cards.length,
        diasAtividadeMax,
      })
      setBoard((prev) => {
        if (!prev) return prev
        return {
          colunas: prev.colunas.map((item) =>
            item.coluna === coluna
              ? {
                  ...item,
                  cards: [...item.cards, ...proximaPagina],
                  temMais: item.total > item.cards.length + proximaPagina.length,
                }
              : item
          ),
        }
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar mais cards.")
    } finally {
      setColunasCarregandoMais((prev) => {
        const next = new Set(prev)
        next.delete(coluna)
        return next
      })
    }
  }

  async function moveCard(cardId: number, novaColuna: KanbanColunaId) {
    if (!skVendedor || !board) return

    const colunaOrigem = board.colunas.find((item) => item.cards.some((card) => card.id === cardId))?.coluna ?? null
    if (!colunaOrigem || colunaOrigem === novaColuna) return

    setBoard((prev) => {
      if (!prev) return prev
      const colunas = prev.colunas.map((item) => ({ ...item, cards: [...item.cards] }))
      const origem = colunas.find((item) => item.coluna === colunaOrigem)
      const destino = colunas.find((item) => item.coluna === novaColuna)
      if (!origem || !destino) return prev

      const index = origem.cards.findIndex((card) => card.id === cardId)
      if (index === -1) return prev

      const [cardMovido] = origem.cards.splice(index, 1)
      origem.total = Math.max(0, origem.total - 1)
      destino.cards = [{ ...cardMovido, coluna_atual: novaColuna, origem_status: "MANUAL" }, ...destino.cards]
      destino.total += 1

      return { colunas }
    })

    try {
      await moveKanbanCard(skVendedor, cardId, novaColuna)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao mover card. Revertendo.")
      await refresh()
    }
  }

  async function addCard(skCliente: number | string, colunaInicial: KanbanColunaId) {
    if (!skVendedor) return
    await createKanbanCard(skVendedor, { sk_cliente: skCliente, coluna_inicial: colunaInicial })
    await refresh()
  }

  async function addInteracao(cardId: number, tipo: Exclude<KanbanTipoInteracao, "MUDANCA_COLUNA">, conteudo: string) {
    if (!skVendedor) return
    await addKanbanInteracao(skVendedor, cardId, { tipo, conteudo })
    await refresh()
  }

  async function toggleArchive(cardId: number, arquivar: boolean) {
    if (!skVendedor) return
    await toggleKanbanArquivar(skVendedor, cardId, arquivar)
    await refresh()
    if (showArchived) {
      const cards = await fetchKanbanArquivados(skVendedor)
      setArquivados(cards)
    }
  }

  async function getCardDetail(cardId: number): Promise<KanbanCardDetail> {
    if (!skVendedor) throw new Error("Vendedor nao informado.")
    return fetchKanbanCardDetail(skVendedor, cardId)
  }

  return {
    board,
    arquivados,
    diasAtividadeMax,
    setDiasAtividadeMax,
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
  }
}
