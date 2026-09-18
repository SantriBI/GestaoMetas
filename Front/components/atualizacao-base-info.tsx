"use client"

import { useEffect, useState } from "react"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface AtualizacaoBaseData {
  vendas: { data: string | null; hora: string | null } | null
  margem: { data: string | null } | null
}

interface AtualizacaoBaseInfoProps {
  empresaId?: string | number | null
  empresaAcesso?: string | number | null
  className?: string
}

function buildQuery(empresaId?: string | number | null, empresaAcesso?: string | number | null) {
  const params = new URLSearchParams()
  if (empresaId !== null && empresaId !== undefined && String(empresaId).trim()) {
    params.set("empresa_id", String(empresaId))
  }
  if (empresaAcesso !== null && empresaAcesso !== undefined && String(empresaAcesso).trim()) {
    params.set("empresa_acesso", String(empresaAcesso))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

export function AtualizacaoBaseInfo({ empresaId, empresaAcesso, className }: AtualizacaoBaseInfoProps) {
  const [dados, setDados] = useState<AtualizacaoBaseData | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const response = await fetch(`/api/atualizacao-base${buildQuery(empresaId, empresaAcesso)}`, {
          cache: "no-store",
          credentials: "include",
        })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelado) setDados(data)
      } catch {
        // Indicador discreto: falha ao buscar nao deve quebrar a tela.
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [empresaId, empresaAcesso])

  if (!dados?.vendas?.data && !dados?.margem?.data) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-white/80 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground dark:border-white/10 dark:bg-white/5"
          }
        >
          <Info className="h-3 w-3" />
          Sobre estes dados
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm">
        <p className="mb-3 font-medium text-foreground">De onde vem cada numero</p>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground">Vendas de hoje</p>
            <p className="text-muted-foreground">
              Atualizadas ao longo do dia.
              {dados?.vendas?.data ? ` Ultimo pedido registrado: ${dados.vendas.data}` : ""}
              {dados?.vendas?.hora ? ` as ${dados.vendas.hora}` : ""}.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Margem, lucratividade e comissao</p>
            <p className="text-muted-foreground">
              Fecham apenas no dia seguinte, depois do processamento do ERP.
              {dados?.margem?.data ? ` Ultima base fechada: ${dados.margem.data}.` : ""}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
