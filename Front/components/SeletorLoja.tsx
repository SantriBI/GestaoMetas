"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LojaAcesso, TODAS_LOJAS_VALUE } from "@/lib/loja-acesso"

interface SeletorLojaProps {
  lojas: LojaAcesso[]
  value: string
  onValueChange: (value: string) => void
  permiteTodasLojas?: boolean
  className?: string
}

export default function SeletorLoja({ lojas, value, onValueChange, permiteTodasLojas, className }: SeletorLojaProps) {
  if (lojas.length === 0) {
    return null
  }

  // Com 1 loja so, nao ha o que trocar, mas o seletor continua visivel (desabilitado) para
  // deixar claro qual loja esta sendo exibida.
  const somenteUmaLoja = lojas.length === 1

  return (
    <Select value={value} onValueChange={onValueChange} disabled={somenteUmaLoja}>
      <SelectTrigger className={className ?? "w-56"}>
        <SelectValue placeholder="Selecione a loja" />
      </SelectTrigger>
      <SelectContent>
        {permiteTodasLojas && (
          <SelectItem value={TODAS_LOJAS_VALUE}>Todas as minhas lojas</SelectItem>
        )}
        {lojas.map((loja) => (
          <SelectItem key={loja.empresaAcesso} value={loja.empresaAcesso}>
            {loja.nomeResumido}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
