"use client"

import { useEffect, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  KANBAN_COLUNAS,
  KANBAN_COLUNA_LABELS,
  KanbanClienteBusca,
  KanbanColunaId,
  searchKanbanClientes,
} from "@/lib/kanban"

interface KanbanAddClienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skVendedor: number | string
  onAdd: (skCliente: number | string, colunaInicial: KanbanColunaId) => Promise<void>
}

export function KanbanAddClienteDialog({ open, onOpenChange, skVendedor, onAdd }: KanbanAddClienteDialogProps) {
  const [termo, setTermo] = useState("")
  const [resultados, setResultados] = useState<KanbanClienteBusca[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<KanbanClienteBusca | null>(null)
  const [colunaInicial, setColunaInicial] = useState<KanbanColunaId>("A_CONTATAR")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTermo("")
      setResultados([])
      setClienteSelecionado(null)
      setColunaInicial("A_CONTATAR")
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const termoLimpo = termo.trim()
    if (termoLimpo.length < 2) {
      setResultados([])
      return
    }

    let active = true
    const timeout = window.setTimeout(async () => {
      try {
        setIsSearching(true)
        const data = await searchKanbanClientes(skVendedor, termoLimpo)
        if (active) setResultados(data)
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Erro ao buscar clientes.")
      } finally {
        if (active) setIsSearching(false)
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [termo, open, skVendedor])

  async function handleSubmit() {
    if (!clienteSelecionado) return
    try {
      setIsSubmitting(true)
      await onAdd(clienteSelecionado.sk_cliente, colunaInicial)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar cliente ao kanban</DialogTitle>
          <DialogDescription>Busque por nome, CPF ou CNPJ dentro da sua carteira.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder="Nome, CPF ou CNPJ..."
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {isSearching ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /> : null}
            {!isSearching && termo.trim().length >= 2 && !resultados.length ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : null}
            {resultados.map((cliente) => (
              <button
                key={cliente.sk_cliente}
                type="button"
                disabled={cliente.jaNoKanban}
                onClick={() => setClienteSelecionado(cliente)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  clienteSelecionado?.sk_cliente === cliente.sk_cliente
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted",
                  cliente.jaNoKanban && "cursor-not-allowed opacity-50"
                )}
              >
                <span>{cliente.nome_cliente ?? "Sem nome"}</span>
                {cliente.jaNoKanban ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Já no kanban
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>

          {clienteSelecionado ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Coluna inicial</label>
              <Select value={colunaInicial} onValueChange={(value) => setColunaInicial(value as KanbanColunaId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_COLUNAS.map((coluna) => (
                    <SelectItem key={coluna} value={coluna}>
                      {KANBAN_COLUNA_LABELS[coluna]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!clienteSelecionado || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
