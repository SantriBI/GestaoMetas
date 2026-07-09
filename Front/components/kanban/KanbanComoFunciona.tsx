import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { KANBAN_COLUNA_LABELS, KANBAN_COLUNAS, KanbanColunaId } from "@/lib/kanban"

interface KanbanComoFuncionaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DESCRICOES: Record<KanbanColunaId, string> = {
  A_CONTATAR: "Cliente com sinal recente (orçamento ou campanha) que ainda não teve contato registrado.",
  EM_CONTATO: "Contato em andamento, aguardando avançar para um orçamento.",
  ORCAMENTO_ENVIADO: "Orçamento enviado e aguardando retorno do cliente.",
  CONVERTIDO: "Venda confirmada.",
  NAO_CONVERTIDO: "Oportunidade perdida ou parada há muito tempo sem retorno.",
}

export function KanbanComoFunciona({ open, onOpenChange }: KanbanComoFuncionaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como funciona o Kanban de Carteira</DialogTitle>
          <DialogDescription>Entenda as colunas e a sincronização automática.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1.5 pl-4">
            {KANBAN_COLUNAS.map((coluna) => (
              <li key={coluna}>
                <span className="font-medium text-foreground">{KANBAN_COLUNA_LABELS[coluna]}</span>
                {" — "}
                {DESCRICOES[coluna]}
              </li>
            ))}
          </ol>
          <p>
            Cards <span className="font-medium text-foreground">automáticos</span> são criados e movidos sozinhos a
            partir de orçamentos e campanhas de ativação. Ao arrastar um card manualmente, ele passa a ser{" "}
            <span className="font-medium text-foreground">manual</span> e a sincronização automática para de mexer
            nele (exceto quando uma venda é confirmada, que sempre move o card para Convertido).
          </p>
          <p>
            Cards parados por muito tempo em Orçamento Enviado viram Não Convertido automaticamente, e os que ficam
            parados em Não Convertido são arquivados.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
