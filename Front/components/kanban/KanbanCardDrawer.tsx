"use client"

import { useEffect, useState } from "react"
import {
  FileText,
  GitBranch,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  ShoppingBag,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  KANBAN_COLUNAS,
  KANBAN_COLUNA_LABELS,
  KanbanCard,
  KanbanCardDetail,
  KanbanColunaId,
  KanbanTipoInteracao,
  formatCurrencyBRL,
  formatDataChaveNumerica,
  formatDataISO,
  getRfvVisual,
} from "@/lib/kanban"

type TipoInteracaoManual = Exclude<KanbanTipoInteracao, "MUDANCA_COLUNA">

interface KanbanCardDrawerProps {
  card: KanbanCard | null
  onOpenChange: (open: boolean) => void
  getCardDetail: (cardId: number) => Promise<KanbanCardDetail>
  onMoveCard: (cardId: number, coluna: KanbanColunaId) => Promise<void>
  onAddInteracao: (cardId: number, tipo: TipoInteracaoManual, conteudo: string) => Promise<void>
  onToggleArchive: (cardId: number, arquivar: boolean) => Promise<void>
}

const TIPOS_INTERACAO: TipoInteracaoManual[] = ["ANOTACAO", "LIGACAO", "WHATSAPP", "EMAIL", "REUNIAO"]

const TIPO_LABELS: Record<KanbanTipoInteracao, string> = {
  ANOTACAO: "Anotação",
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  MUDANCA_COLUNA: "Mudança de coluna",
}

const ICONE_INTERACAO: Record<KanbanTipoInteracao, LucideIcon> = {
  ANOTACAO: StickyNote,
  LIGACAO: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  REUNIAO: Users,
  MUDANCA_COLUNA: GitBranch,
}

function obterIniciais(nome: string | null | undefined) {
  const partes = String(nome ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!partes.length) return "CL"
  return partes.map((parte) => parte[0]?.toUpperCase() ?? "").join("")
}

export function KanbanCardDrawer({
  card,
  onOpenChange,
  getCardDetail,
  onMoveCard,
  onAddInteracao,
  onToggleArchive,
}: KanbanCardDrawerProps) {
  const [detalhe, setDetalhe] = useState<KanbanCardDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [novoTipo, setNovoTipo] = useState<TipoInteracaoManual>("ANOTACAO")
  const [novoConteudo, setNovoConteudo] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!card) {
      setDetalhe(null)
      return
    }

    let active = true
    setIsLoading(true)

    getCardDetail(card.id)
      .then((data) => {
        if (active) setDetalhe(data)
      })
      .catch((err) => {
        if (active) toast.error(err instanceof Error ? err.message : "Erro ao carregar detalhe do card.")
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [card, getCardDetail])

  async function handleMover(coluna: KanbanColunaId) {
    if (!card) return
    try {
      await onMoveCard(card.id, coluna)
      toast.success("Card movido.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao mover card.")
    }
  }

  async function handleAddInteracao() {
    if (!card || !novoConteudo.trim()) return
    try {
      setIsSubmitting(true)
      await onAddInteracao(card.id, novoTipo, novoConteudo.trim())
      setNovoConteudo("")
      const data = await getCardDetail(card.id)
      setDetalhe(data)
      toast.success("Interação registrada.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar interação.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleArchive() {
    if (!card || !detalhe) return
    try {
      await onToggleArchive(card.id, !detalhe.card.arquivado)
      toast.success(detalhe.card.arquivado ? "Card desarquivado." : "Card arquivado.")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao arquivar/desarquivar card.")
    }
  }

  const rfvVisual = getRfvVisual(detalhe?.cliente.classificacao_rfv)

  return (
    <Sheet open={!!card} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="sr-only">{card?.nome_cliente ?? "Cliente"}</SheetTitle>
          <SheetDescription className="sr-only">Detalhe do card do kanban de carteira</SheetDescription>
        </SheetHeader>

        {isLoading || !detalhe ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 pb-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
                style={{
                  backgroundColor: rfvVisual?.bg ?? "rgba(148,163,184,0.16)",
                  color: rfvVisual?.accent ?? "#94a3b8",
                }}
              >
                {obterIniciais(detalhe.cliente.nome_cliente)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">
                  {detalhe.cliente.nome_cliente ?? "Cliente"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {rfvVisual ? (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ backgroundColor: rfvVisual.bg, color: rfvVisual.accent }}
                    >
                      {rfvVisual.label}
                    </span>
                  ) : null}
                  <Badge variant="outline" className="text-[10px]">
                    {detalhe.card.origem_status === "MANUAL" ? "Movimentação manual" : "Sincronizado automaticamente"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
              <section className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Telefone: </span>
                  {detalhe.cliente.telefone ?? "Não informado"}
                </p>
                <p>
                  <span className="text-muted-foreground">CPF/CNPJ: </span>
                  {detalhe.cliente.cpf ?? detalhe.cliente.cnpj ?? "-"}
                </p>
                {detalhe.cliente.valor_potencial !== null ? (
                  <p>
                    <span className="text-muted-foreground">Valor potencial: </span>
                    {formatCurrencyBRL(detalhe.cliente.valor_potencial)}
                  </p>
                ) : null}
              </section>

              <section className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Coluna</label>
                <Select value={detalhe.card.coluna_atual} onValueChange={(value) => handleMover(value as KanbanColunaId)}>
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
              </section>

              {detalhe.orcamentoAberto ? (
                <section className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-500 dark:text-indigo-400">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{detalhe.orcamentoAberto.descricao_status}</p>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrencyBRL(detalhe.orcamentoAberto.valor_pedido)}
                    </p>
                    {detalhe.orcamentoAberto.data_cadastro ? (
                      <p className="text-xs text-muted-foreground">
                        {formatDataISO(String(detalhe.orcamentoAberto.data_cadastro)) ?? String(detalhe.orcamentoAberto.data_cadastro)}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {detalhe.ultimasVendas.length ? (
                <section className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Últimas vendas</p>
                  <ul className="space-y-2.5">
                    {detalhe.ultimasVendas.map((venda) => (
                      <li
                        key={`${venda.orcamento_id}-${venda.sk_dt_fechamento}`}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <ShoppingBag className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 text-muted-foreground">
                          {formatDataChaveNumerica(venda.sk_dt_fechamento) ?? "-"}
                        </span>
                        <span className="font-medium text-foreground">{formatCurrencyBRL(venda.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="space-y-2 rounded-xl border border-border/70 p-3">
                <p className="text-xs font-medium text-muted-foreground">Nova interação</p>
                <Select value={novoTipo} onValueChange={(value) => setNovoTipo(value as TipoInteracaoManual)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_INTERACAO.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {TIPO_LABELS[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={novoConteudo}
                  onChange={(event) => setNovoConteudo(event.target.value)}
                  placeholder="Descreva a interação..."
                  rows={3}
                />
                <Button size="sm" onClick={handleAddInteracao} disabled={!novoConteudo.trim() || isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
                </Button>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Timeline</p>
                {detalhe.interacoes.length ? (
                  <ul className="relative space-y-4">
                    <div className="absolute bottom-4 left-4 top-4 w-px bg-border" aria-hidden="true" />
                    {detalhe.interacoes.map((interacao) => {
                      const Icone = ICONE_INTERACAO[interacao.tipo] ?? StickyNote
                      return (
                        <li key={interacao.id} className="relative flex gap-3">
                          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                            <Icone className="h-3.5 w-3.5" />
                          </span>
                          <div className="flex-1 rounded-lg border border-border bg-muted/20 p-2.5 text-xs">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="font-medium text-foreground">{TIPO_LABELS[interacao.tipo]}</span>
                              <span>{formatDataISO(interacao.data)}</span>
                            </div>
                            {interacao.conteudo ? <p className="mt-1 text-foreground/90">{interacao.conteudo}</p> : null}
                            <p className="mt-1 text-muted-foreground">{interacao.autor}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem interações ainda.</p>
                )}
              </section>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={handleToggleArchive}>
                {detalhe.card.arquivado ? "Desarquivar" : "Arquivar"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
