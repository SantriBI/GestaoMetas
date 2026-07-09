"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { KANBAN_RFV_OPCOES, getRfvVisual } from "@/lib/kanban"

interface KanbanFiltrosProps {
  rfvFiltro: string
  onRfvFiltroChange: (value: string) => void
  diasSemContatoMin: number
  onDiasSemContatoMinChange: (value: number) => void
}

const OPCOES_CONTATO = [
  { label: "Qualquer contato", value: "0" },
  { label: "7+ dias sem contato", value: "7" },
  { label: "15+ dias sem contato", value: "15" },
  { label: "30+ dias sem contato", value: "30" },
]

export function KanbanFiltros({ rfvFiltro, onRfvFiltroChange, diasSemContatoMin, onDiasSemContatoMinChange }: KanbanFiltrosProps) {
  return (
    <>
      <Select value={rfvFiltro} onValueChange={onRfvFiltroChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Todas classificações" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Classificações</SelectItem>
          {KANBAN_RFV_OPCOES.map((opcao) => (
            <SelectItem key={opcao} value={opcao}>
              {getRfvVisual(opcao)?.label ?? opcao}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(diasSemContatoMin)} onValueChange={(value) => onDiasSemContatoMinChange(Number(value))}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Qualquer contato" />
        </SelectTrigger>
        <SelectContent>
          {OPCOES_CONTATO.map((opcao) => (
            <SelectItem key={opcao.value} value={opcao.value}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
