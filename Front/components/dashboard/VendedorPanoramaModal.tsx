"use client"

import { useEffect, useRef, useState } from "react"
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Crown,
  Package,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { formatCurrency, VendedorPanorama } from "@/lib/types"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface VendedorPanoramaModalProps {
  vendedorId: number | null
  nomeVendedor?: string | null
  empresaId?: string | number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface IndicadorPanorama {
  titulo: string
  valor: string
  descricao: string
  icone: typeof Target
  destaque?: "ciano" | "verde" | "ambar"
}

function formatarPercentual(value: number) {
  return `${Math.round(value)}%`
}

function formatarNumeroInteiro(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR")
}

function formatarDataBR(value: string | number | null) {
  if (!value) return "-"

  const raw = String(value).trim()
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return raw
  }

  return date.toLocaleDateString("pt-BR")
}

function formatarMesAnoBR(value: string | number | null) {
  if (!value) return null

  const raw = String(value).trim()
  let date: Date

  if (/^\d{8}$/.test(raw)) {
    const ano = Number(raw.slice(0, 4))
    const mes = Number(raw.slice(4, 6)) - 1
    date = new Date(ano, mes, 1)
  } else {
    date = new Date(raw)
  }

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const texto = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
  return texto.replace(".", "")
}

function diasDesdeData(value: string | number | null) {
  if (!value) return null

  const raw = String(value).trim()
  let date: Date

  if (/^\d{8}$/.test(raw)) {
    const ano = Number(raw.slice(0, 4))
    const mes = Number(raw.slice(4, 6)) - 1
    const dia = Number(raw.slice(6, 8))
    date = new Date(ano, mes, dia)
  } else {
    date = new Date(raw)
  }

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  return Math.max(Math.round((hoje.getTime() - date.getTime()) / 86400000), 0)
}

function obterStatusMeta(percentual: number) {
  if (percentual >= 100) {
    return {
      titulo: "Meta batida",
      classe: "border-emerald-400/30 bg-emerald-400/12 text-emerald-200",
    }
  }

  if (percentual >= 55) {
    return {
      titulo: "Em progresso",
      classe: "border-emerald-400/30 bg-emerald-400/12 text-emerald-200",
    }
  }

  return {
      titulo: "Pede atenção",
    classe: "border-amber-400/30 bg-amber-400/12 text-amber-100",
  }
}

function obterPerfilCarteira(data: VendedorPanorama) {
  const totalRfv = data.rfv.campeoes + data.rfv.fieis + data.rfv.emRisco + data.rfv.novos

  if (totalRfv === 0) return "Carteira em formação"
  if (data.rfv.emRisco > data.rfv.campeoes + data.rfv.fieis) return "Carteira sensível"
  if (data.rfv.campeoes + data.rfv.fieis >= data.rfv.emRisco + data.rfv.novos) return "Carteira ativa"
  return "Carteira em expansão"
}

function classeDestaqueIndicador(destaque: IndicadorPanorama["destaque"]) {
  switch (destaque) {
    case "verde":
      return "from-emerald-500/18 via-emerald-400/8 to-transparent"
    case "ambar":
      return "from-amber-500/18 via-amber-400/8 to-transparent"
    case "ciano":
    default:
      return "from-emerald-500/18 via-emerald-400/8 to-transparent"
  }
}

function PainelSecao({
  titulo,
  subtitulo,
  icone: Icon,
  badge,
  children,
}: {
  titulo: string
  subtitulo: string
  icone: typeof Target
  badge?: string | null
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,8,23,0.96))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.36)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">{titulo}</h3>
            <p className="mt-1 text-sm text-slate-400">{subtitulo}</p>
          </div>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function CardIndicador({
  titulo,
  valor,
  descricao,
  icone: Icon,
  destaque = "ciano",
}: IndicadorPanorama) {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(9,14,28,0.94))] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.3)]">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${classeDestaqueIndicador(destaque)}`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{titulo}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">{valor}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{descricao}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-slate-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  )
}

function PanoramaHeader({ data }: { data: VendedorPanorama }) {
  const percentual = data.indicadores.percentual_meta
  const status = obterStatusMeta(percentual)
  const perfilCarteira = obterPerfilCarteira(data)

  return (
    <DialogHeader className="sticky top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(2,8,23,0.98),rgba(2,8,23,0.9))] px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3 pr-8 sm:pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
              Panorama do Vendedor
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${status.classe}`}
            >
              {status.titulo}
            </span>
          </div>

          <div>
            <h2 className="text-left text-2xl font-semibold tracking-tight text-slate-50 sm:text-[2rem]">
              {data.indicadores.nome ?? "Vendedor sem identificação"}
            </h2>
            <p className="mt-2 text-left text-sm leading-6 text-slate-400 sm:text-[15px]">
              {formatarPercentual(percentual)} da meta | {status.titulo} | {perfilCarteira}
            </p>
          </div>
        </div>

        <DialogClose className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-400/40 sm:top-5 sm:right-5">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar panorama</span>
        </DialogClose>
      </div>
    </DialogHeader>
  )
}

function PanoramaIndicadores({ data }: { data: VendedorPanorama }) {
  const indicadores: IndicadorPanorama[] = [
    {
      titulo: "Receita do mês",
      valor: formatCurrency(data.indicadores.receita_mes),
      descricao: "Volume acumulado no período atual.",
      icone: Wallet,
      destaque: "ciano",
    },
    {
      titulo: "Meta mensal",
      valor: formatCurrency(data.indicadores.meta_mensal),
      descricao: "Referência principal de faturamento.",
      icone: Target,
      destaque: "verde",
    },
    {
      titulo: "Falta para meta",
      valor: formatCurrency(data.indicadores.falta_meta),
      descricao: "Quanto ainda precisa converter para fechar o mês.",
      icone: TrendingUp,
      destaque: "ambar",
    },
    {
      titulo: "Percentual da meta",
      valor: formatarPercentual(data.indicadores.percentual_meta),
      descricao: "Nível atual de atingimento da meta.",
      icone: Crown,
      destaque: "ciano",
    },
    {
      titulo: "Clientes atendidos",
      valor: formatarNumeroInteiro(data.performance.clientes_atendidos_mes),
      descricao: "Quantidade de clientes com atendimento no mês.",
      icone: Users,
      destaque: "verde",
    },
    {
      titulo: "Ticket médio",
      valor: formatCurrency(data.performance.ticket_medio),
      descricao: "Receita média por venda realizada.",
      icone: BarChart3,
      destaque: "ciano",
    },
    {
      titulo: "Quantidade de vendas",
      valor: formatarNumeroInteiro(data.performance.quantidade_vendas),
      descricao: "Número total de vendas convertidas.",
      icone: ShoppingBag,
      destaque: "verde",
    },
    {
      titulo: "Última venda",
      valor: formatarDataBR(data.performance.ultima_venda),
      descricao: "Data mais recente de venda registrada.",
      icone: CalendarDays,
      destaque: "ciano",
    },
    {
      titulo: "Orçamentos em aberto",
      valor: formatarNumeroInteiro(data.performance.orcamentos_abertos),
      descricao: "Oportunidades que ainda podem virar venda.",
      icone: BriefcaseBusiness,
      destaque: "ambar",
    },
    {
      titulo: "Valor em orçamentos",
      valor: formatCurrency(data.performance.valor_orcamentos),
      descricao: "Potencial financeiro ainda em negociação.",
      icone: Wallet,
      destaque: "ambar",
    },
  ]

  return (
    <PainelSecao
      titulo="Performance"
      subtitulo="Visão consolidada da performance comercial do vendedor no período."
      icone={Target}
    >
      {/* Layout responsivo dos indicadores principais.
          Em telas menores, o grid reduz automaticamente para evitar cards espremidos. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {indicadores.map((indicador) => (
          <CardIndicador key={indicador.titulo} {...indicador} />
        ))}
      </div>
    </PainelSecao>
  )
}

function PanoramaProdutos({
  produtos,
  desde,
}: {
  produtos: VendedorPanorama["top_produtos"]
  desde: VendedorPanorama["top_produtos_desde"]
}) {
  const desdeFormatado = formatarMesAnoBR(desde)

  return (
    <PainelSecao
      titulo="O que o vendedor mais vendeu?"
      subtitulo="Tudo que este vendedor já vendeu por grupo, desde o início dos dados. Não é o mês atual."
      icone={Package}
      badge={desdeFormatado ? `Desde ${desdeFormatado}` : null}
    >
      <div className="space-y-3">
        {produtos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-5 text-sm text-slate-400">
            Nenhum grupo de produto encontrado para este vendedor.
          </div>
        ) : (
          produtos.slice(0, 5).map((item, index) => (
            <article
              key={`${item.grupo}-${index}`}
              className="rounded-[22px] border border-white/10 bg-white/4 p-4 shadow-[0_16px_40px_rgba(2,6,23,0.22)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Grupo #{index + 1}
                  </p>
                  <h4 className="mt-2 text-base font-semibold leading-6 text-slate-100">{item.grupo}</h4>
                </div>
                <div className="sm:text-right">
                  <p className="text-lg font-semibold text-emerald-300">{formatCurrency(item.receita)}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatarPercentual(item.participacao)} do total histórico vendido
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(34,197,94,0.85))]"
                    style={{ width: `${Math.min(item.participacao, 100)}%` }}
                  />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </PainelSecao>
  )
}

function PanoramaClientes({ clientes }: { clientes: VendedorPanorama["top_clientes"] }) {
  function getBadgeClassificacao(classificacao?: string | null) {
    const texto = String(classificacao ?? "").toUpperCase()

    if (texto.includes("CAMPE")) {
      return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
    }
    if (texto.includes("FIE")) {
      return "border-emerald-400/25 bg-emerald-400/12 text-emerald-100"
    }
    if (texto.includes("RISCO")) {
      return "border-amber-400/25 bg-amber-400/12 text-amber-100"
    }
    if (texto.includes("NOV")) {
      return "border-violet-400/25 bg-violet-400/12 text-violet-100"
    }

    return "border-slate-400/25 bg-slate-400/12 text-slate-100"
  }

  return (
    <PainelSecao
      titulo="Principais clientes"
      subtitulo="Clientes mais relevantes dos últimos 90 dias para leitura da carteira ativa."
      icone={Users}
    >
      {/* Lista dos principais clientes do vendedor.
          Formato em cards para priorizar leitura rapida. */}
      <div className="space-y-3">
        {clientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-5 text-sm text-slate-400">
            Nenhum cliente relevante encontrado para este vendedor.
          </div>
        ) : (
          clientes.map((item, index) => {
            const diasSemCompra = diasDesdeData(item.ultima_compra)
            const clienteEsfriando = diasSemCompra !== null && diasSemCompra > 30

            return (
              <article
                key={`${item.nome_cliente}-${item.ultima_compra}-${index}`}
                className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(9,14,28,0.8))] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Cliente estratégico
                    </p>
                    <h4 className="mt-2 text-base font-semibold leading-6 text-slate-100">
                      {item.nome_cliente ?? "-"}
                    </h4>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.classificacao ? (
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${getBadgeClassificacao(item.classificacao)}`}>
                          🏷️ {item.classificacao}
                        </span>
                      ) : null}
                    {clienteEsfriando ? (
                      <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-amber-100">
                        {diasSemCompra} dias sem compra
                      </span>
                    ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:min-w-[20rem]">
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Receita</p>
                      <p className="mt-1 font-semibold text-emerald-300">{formatCurrency(item.receita)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Última compra</p>
                      <p className="mt-1 font-semibold text-slate-100">{formatarDataBR(item.ultima_compra)}</p>
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </PainelSecao>
  )
}

function PanoramaRFV({ rfv }: { rfv: VendedorPanorama["rfv"] }) {
  const cartoes = [
    {
      titulo: "Campeões",
      valor: rfv.campeoes,
      classe: "text-emerald-200 border-emerald-400/20 bg-emerald-500/10",
    },
    { titulo: "Fiéis", valor: rfv.fieis, classe: "text-emerald-200 border-emerald-400/20 bg-emerald-400/10" },
    {
      titulo: "Em risco",
      valor: rfv.emRisco,
      classe: "text-amber-100 border-amber-400/20 bg-amber-400/10",
    },
    { titulo: "Novos", valor: rfv.novos, classe: "text-violet-200 border-violet-400/20 bg-violet-400/10" },
  ]

  return (
    <PainelSecao
      titulo="Perfil da carteira"
      subtitulo="Distribuição da carteira entre clientes ativos, fiéis, novos e em risco."
      icone={Crown}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cartoes.map((item) => (
          <article key={item.titulo} className={`rounded-[22px] border p-4 ${item.classe}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">{item.titulo}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{formatarNumeroInteiro(item.valor)}</p>
          </article>
        ))}
      </div>
    </PainelSecao>
  )
}

function PanoramaUltimasVendas({ vendas }: { vendas: VendedorPanorama["ultimas_vendas"] }) {
  return (
    <PainelSecao
      titulo="Últimas vendas"
      subtitulo="Vendas mais recentes agrupadas por pedido para destacar valor, mix e data."
      icone={ShoppingBag}
    >
      {vendas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 px-4 py-5 text-sm text-slate-400">
          Nenhuma venda recente encontrada para este vendedor.
        </div>
      ) : (
        <>
          {/* No mobile, ultimas vendas sao exibidas como cards em vez de tabela
              para melhorar a leitura e evitar scroll horizontal. */}
          <div className="space-y-3 md:hidden">
            {vendas.map((item, index) => (
              <article
                key={`${item.cliente}-${item.data}-${index}`}
                className="rounded-[22px] border border-white/10 bg-white/4 p-4"
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cliente</p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">{item.cliente ?? "-"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Valor</p>
                      <p className="mt-1 font-semibold text-emerald-300">{formatCurrency(item.valor)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Produtos</p>
                      <p className="mt-1 font-semibold text-slate-100">{formatarNumeroInteiro(item.qtd_produtos)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Data</p>
                      <p className="mt-1 font-semibold text-slate-100">{formatarDataBR(item.data)}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[24px] border border-white/10 md:block">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[36%]" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead className="bg-white/6">
                <tr>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Cliente
                  </th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Valor
                  </th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Produtos
                  </th>
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((item, index) => (
                  <tr key={`${item.cliente}-${item.data}-${index}`} className="border-t border-white/8">
                    <td className="px-5 py-4 align-top text-sm leading-6 text-slate-100">{item.cliente ?? "-"}</td>
                    <td className="px-5 py-4 align-top text-sm font-semibold text-emerald-300">
                      {formatCurrency(item.valor)}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-200">
                      {formatarNumeroInteiro(item.qtd_produtos)}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-slate-200">{formatarDataBR(item.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PainelSecao>
  )
}

function EstadoCarregando() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-[24px] border border-white/10 bg-white/5"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.05fr]">
        <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/4 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[22px] bg-white/5" />
          ))}
        </div>
        <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/4 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[22px] bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function VendedorPanoramaModal({
  vendedorId,
  nomeVendedor,
  empresaId,
  open,
  onOpenChange,
}: VendedorPanoramaModalProps) {
  const [data, setData] = useState<VendedorPanorama | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const areaRolagemRef = useRef<HTMLDivElement | null>(null)
  const tituloAcessivel =
    data?.indicadores.nome ?? (nomeVendedor?.trim() ? nomeVendedor : "Panorama do vendedor")
  const descricaoAcessivel = data
    ? `${formatarPercentual(data.indicadores.percentual_meta)} da meta.`
    : "Painel executivo com indicadores, clientes, produtos e últimas vendas do vendedor."

  useEffect(() => {
    if (!open) return

    // Sempre reinicia o scroll ao abrir ou trocar de vendedor.
    // Isso evita reaproveitar a posicao de rolagem da selecao anterior.
    areaRolagemRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [open, vendedorId])

  useEffect(() => {
    if (!open || !vendedorId) {
      return
    }

    const controller = new AbortController()
    let ativo = true

    // O modal abre primeiro e mostra skeleton imediatamente.
    // A busca do panorama acontece em background para reduzir a percepcao de lentidao.
    setData(null)
    setError(null)
    setIsLoading(true)

    async function carregarPanorama() {
      try {
        const params = new URLSearchParams()
        if (empresaId !== null && empresaId !== undefined && String(empresaId).trim()) {
          params.set("empresa_id", String(empresaId))
        }
        const query = params.toString()
        const response = await fetch(`/api/vendedor-panorama/${vendedorId}${query ? `?${query}` : ""}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Falha ao carregar panorama do vendedor")
        }

        const json = (await response.json()) as VendedorPanorama

        if (ativo) {
          setData(json)
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }

        if (ativo) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar panorama do vendedor"
          )
        }
      } finally {
        if (ativo) {
          setIsLoading(false)
        }
      }
    }

    carregarPanorama()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [open, vendedorId, empresaId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="panorama-modal top-0 left-0 grid h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-[#020817] p-0 text-slate-50 sm:top-[50%] sm:left-[50%] sm:h-[92vh] sm:max-h-[92vh] sm:w-[96%] sm:max-w-[1400px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[32px] sm:border sm:border-white/10 sm:shadow-[0_36px_120px_rgba(2,6,23,0.52)]"
      >
        <DialogTitle className="sr-only">{tituloAcessivel}</DialogTitle>
        <DialogDescription className="sr-only">{descricaoAcessivel}</DialogDescription>
        <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.10),transparent_24%),linear-gradient(180deg,#020817_0%,#030712_100%)]">
          {data ? (
            <PanoramaHeader data={data} />
          ) : (
            <div className="sticky top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(2,8,23,0.98),rgba(2,8,23,0.9))] px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 pr-8 sm:pr-14">
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    Panorama do Vendedor
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[2rem]">
                      {nomeVendedor?.trim() ? nomeVendedor : "Carregando vendedor..."}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Aguarde enquanto montamos o painel executivo deste vendedor.
                    </p>
                  </div>
                </div>
                <DialogClose className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-400/40 sm:top-5 sm:right-5">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fechar panorama</span>
                </DialogClose>
              </div>
            </div>
          )}

          <div
            ref={areaRolagemRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
          >
            <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:space-y-7">
              {isLoading ? (
                <EstadoCarregando />
              ) : error ? (
                <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
                  {error}
                </div>
              ) : data ? (
                <>
                  <PanoramaIndicadores data={data} />

                  {/* Blocos estrategicos empilhados para preservar leitura no mobile
                      e distribuicao premium em telas maiores. */}
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.05fr]">
                    <PanoramaProdutos produtos={data.top_produtos} desde={data.top_produtos_desde} />
                    <PanoramaClientes clientes={data.top_clientes} />
                  </div>

                  <PanoramaRFV rfv={data.rfv} />
                  <PanoramaUltimasVendas vendas={data.ultimas_vendas} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


