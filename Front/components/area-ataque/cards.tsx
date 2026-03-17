"use client"

import { useState } from "react"
import { Bot, MessageCircle, Phone, Sparkles, TrendingUp, ChevronDown, ChevronUp } from "lucide-react"
import { formatCurrency } from "@/lib/types"

export interface ClienteAtaque {
  skCliente: number | string | null
  nome: string | null
  telefone: string | null
  whatsapp: string | null
  ultimaCompra: string | Date | null
  recencia: number
  frequencia: number
  valor: number
  classificacao?: string | null
  orcamentosAbertos?: number
}

export interface ProdutoAtaque {
  nome: string | null
  totalVendido: number
}

export interface InsightAcao {
  acao: string
  impacto: "alto" | "medio" | "rapido"
}

export interface RecommendationContact {
  nome: string
  telefone: string | null
  whatsapp: string | null
}

const mensagemVazia = "Nenhum cliente encontrado nessa categoria para o vendedor atual."

const estilosPorVariante = {
  campeoes: {
    card: "border-emerald-500/25 bg-[linear-gradient(180deg,rgba(9,18,30,0.94),rgba(8,12,20,0.92))]",
    badge: "border border-emerald-400/20 bg-emerald-500/12 text-emerald-200",
    numero: "text-emerald-300",
    halo: "bg-emerald-500/10",
  },
  fieis: {
    card: "border-emerald-500/25 bg-[linear-gradient(180deg,rgba(9,18,28,0.94),rgba(8,12,20,0.92))]",
    badge: "border border-emerald-400/20 bg-emerald-500/12 text-emerald-200",
    numero: "text-emerald-300",
    halo: "bg-emerald-500/10",
  },
  risco: {
    card: "border-amber-500/25 bg-[linear-gradient(180deg,rgba(28,18,9,0.94),rgba(22,13,7,0.92))]",
    badge: "border border-amber-400/20 bg-amber-500/12 text-amber-200",
    numero: "text-amber-300",
    halo: "bg-amber-500/10",
  },
} as const

function formatarData(data?: string | Date | null) {
  if (!data) return "Sem histórico"

  const parsed = new Date(data)
  if (Number.isNaN(parsed.getTime())) {
    return String(data)
  }

  return parsed.toLocaleDateString("pt-BR")
}

function normalizarNome(nome?: string | null) {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function encontrarContato(acao: string, contatos: RecommendationContact[]) {
  const texto = normalizarNome(acao)

  return contatos.find((contato) => {
    const nome = normalizarNome(contato.nome)
    return nome.length >= 4 && texto.includes(nome)
  })
}

export function CardResumoAtaque({
  titulo,
  valor,
  descricao,
  cor,
}: {
  titulo: string
  valor: string
  descricao: string
  cor: "emerald" | "sky" | "amber" | "violet"
}) {
  const estilos = {
    emerald: "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(8,18,15,0.74))] text-emerald-200",
    sky: "border-emerald-500/18 bg-[linear-gradient(180deg,rgba(52,211,153,0.08),rgba(9,16,14,0.8))] text-emerald-200",
    amber: "border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(25,18,8,0.76))] text-amber-200",
    violet: "border-violet-500/20 bg-[linear-gradient(180deg,rgba(139,92,246,0.12),rgba(18,12,29,0.78))] text-violet-200",
  }[cor]

  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-sm ${estilos}`}>
      <p className="text-[11px] uppercase tracking-[0.22em] theme-shell-subtle">{titulo}</p>
      <p className="mt-3 text-3xl font-black tracking-tight theme-shell-text">{valor}</p>
      <p className="mt-2 text-sm theme-shell-muted">{descricao}</p>
    </div>
  )
}

export function CardClientesRFV({
  emoji,
  titulo,
  mensagem,
  total,
  orcamentosAbertos = 0,
  clientes,
  variante,
}: {
  emoji: string
  titulo: string
  mensagem: string
  total: number
  orcamentosAbertos?: number
  clientes: ClienteAtaque[]
  variante: "campeoes" | "fieis" | "risco"
}) {
  const estilo = estilosPorVariante[variante]
  const [aberto, setAberto] = useState(false)

  return (
    <section className={`relative overflow-hidden rounded-[28px] border p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] ${estilo.card}`}>
      <div aria-hidden="true" className={`absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl ${estilo.halo}`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] theme-shell-subtle">
              {emoji} {titulo}
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight theme-shell-text">{total}</h2>
            <p className="mt-1 text-sm theme-shell-muted">{mensagem}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] theme-shell-subtle">
               {orcamentosAbertos} orçamento{orcamentosAbertos === 1 ? "" : "s"} em aberto nessa carteira
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estilo.badge}`}>
            Carteira em foco
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAberto((valorAtual) => !valorAtual)}
          className="theme-shell-panel mt-6 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-[var(--shell-panel-strong)]"
        >
          <div>
            <p className="text-sm font-semibold theme-shell-text">
              {clientes.length === 0 ? "Nenhum cliente nesta categoria" : "Ver clientes"}
            </p>
            <p className="mt-1 text-xs theme-shell-subtle">
              {clientes.length === 0
                 ? mensagemVazia
                  : `${clientes.length} cliente${clientes.length > 1 ? "s" : ""} prontos para análise`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm theme-shell-muted">
            <span>{aberto ? "Ocultar" : "Ver clientes"}</span>
            {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        <div className={`grid transition-all duration-300 ${aberto ? "mt-6 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <div className="space-y-3">
              {clientes.length === 0 ? (
                <div className="theme-shell-panel rounded-2xl border border-dashed px-4 py-5 text-sm theme-shell-subtle">
                  {mensagemVazia}
                </div>
              ) : (
                clientes.map((cliente) => (
                  <div key={`${cliente.skCliente}-${cliente.nome}`} className="theme-shell-card rounded-2xl border px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold theme-shell-text">{cliente.nome ?? "Cliente sem nome"}</p>
                        <p className="mt-1 text-sm theme-shell-subtle">Última compra: {formatarData(cliente.ultimaCompra)}</p>
                        {cliente.classificacao ? (
                          <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${estilo.badge}`}>
                            RFV {cliente.classificacao}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {cliente.telefone ? (
                            <span className="theme-shell-panel rounded-full border px-3 py-1 text-xs theme-shell-muted">
                            <Phone className="mr-1 inline h-3.5 w-3.5" />
                            {cliente.telefone}
                          </span>
                        ) : null}
                        {cliente.whatsapp ? (
                          <a
                            href={cliente.whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="theme-shell-panel rounded-full border p-2 theme-shell-muted transition-colors hover:bg-[var(--shell-panel-strong)] hover:text-[var(--shell-text)]"
                            aria-label={`Falar com ${cliente.nome ?? "cliente"} no WhatsApp`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="theme-shell-panel rounded-2xl px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] theme-shell-subtle">Recência</p>
                        <p className={`mt-2 text-xl font-bold ${estilo.numero}`}>{cliente.recencia} dias</p>
                      </div>
                      <div className="theme-shell-panel rounded-2xl px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] theme-shell-subtle">Frequência</p>
                        <p className="mt-2 text-xl font-bold theme-shell-text">{cliente.frequencia}</p>
                      </div>
                      <div className="theme-shell-panel rounded-2xl px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] theme-shell-subtle">Total gasto</p>
                        <p className="mt-2 text-xl font-bold theme-shell-text">{formatCurrency(cliente.valor)}</p>
                      </div>
                      <div className="theme-shell-panel rounded-2xl px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] theme-shell-subtle">Orçamentos</p>
                        <p className="mt-2 text-xl font-bold theme-shell-text">{cliente.orcamentosAbertos ?? 0}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function CardProdutosAlta({
  produtos,
}: {
  produtos: ProdutoAtaque[]
}) {
  const maiorValor = Math.max(...produtos.map((produto) => produto.totalVendido), 0)

  return (
    <section className="rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(12,18,27,0.96),rgba(9,14,22,0.96))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Produtos que estão puxando vendas</p>
          <h2 className="mt-2 text-[1.65rem] font-black tracking-tight text-white">Top 5 da carteira</h2>
          <p className="mt-1 text-sm text-white/68">Priorize esses produtos nas próximas negociações.</p>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          Receita em foco
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {produtos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
            Nenhum produto encontrado para o vendedor atual.
          </div>
        ) : (
          produtos.map((produto, index) => {
            const percentual = maiorValor > 0 ? (produto.totalVendido / maiorValor) * 100 : 0

            return (
              <div key={`${produto.nome}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-sm font-bold text-emerald-200">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{produto.nome ?? "Produto sem nome"}</p>
                      <p className="text-xs text-white/55">Produto com maior capacidade de puxar novas vendas.</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-white">{formatCurrency(produto.totalVendido)}</p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500"
                    style={{ width: `${Math.max(percentual, 8)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export function CardAlertasEstrategicos({
  itens,
}: {
  itens: string[]
}) {
  return (
    <section className="rounded-[28px] border border-violet-500/20 bg-[linear-gradient(180deg,rgba(19,16,31,0.96),rgba(13,11,24,0.96))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Alertas estratégicos</p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Leituras prontas para agir</h2>
      <p className="mt-1 text-sm text-white/72">Frases curtas, claras e acionaveis para guiar seu dia.</p>

      <div className="mt-6 space-y-3">
        {itens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
            Ainda nao ha alertas suficientes para esta carteira.
          </div>
        ) : (
          itens.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white/78">
              {item}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function CardRecomendacoes({
  itens,
  carregando = false,
  origem,
  contatos = [],
}: {
  itens: InsightAcao[]
  carregando?: boolean
  origem?: string | null
  contatos?: RecommendationContact[]
}) {
  const labelOrigem =
    origem === "openai" || origem === "cache"
      ? "IA estrategica"
      : origem === "fallback-openai"
        ? "IA com fallback"
        : origem === "fallback-sem-chave"
          ? "Leitura automatica"
          : "Prioridade do dia"

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-fuchsia-500/25 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(10,12,24,0.98))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:22px_22px] opacity-[0.14]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 top-0 h-56 w-56 rounded-full bg-emerald-500/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute left-8 top-8 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
              <Sparkles className="h-3.5 w-3.5" />
              Recomendações por IA
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/12 text-emerald-100">
                <Bot className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">O que fazer agora?</h2>
            </div>
            <p className="mt-1 text-sm text-white/72">
              Leituras geradas por modelo estratégico para acelerar receita, agenda e prioridade comercial.
            </p>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            {labelOrigem}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
        {carregando ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`loading-${index}`}
              className="rounded-2xl border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.18))] px-4 py-4 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 animate-pulse rounded-full bg-fuchsia-400/15" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-11/12 animate-pulse rounded bg-white/10" />
                  <div className="mt-3 h-4 w-9/12 animate-pulse rounded bg-white/10" />
                  <div className="mt-4 h-3 w-7/12 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))
        ) : itens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55 md:col-span-3">
            Sem recomendacoes suficientes neste momento.
          </div>
        ) : (
          itens.map((item, index) => {
            const contato = encontrarContato(item.acao, contatos)

            return (
              <div
                key={`${index}-${item.acao}`}
                className="rounded-2xl border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.2))] px-4 py-4 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/12 text-fuchsia-100">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                        Acao {index + 1}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          item.impacto === "alto"
                            ? "bg-emerald-500/12 text-emerald-200"
                            : item.impacto === "rapido"
                              ? "bg-amber-400/12 text-amber-200"
                              : "bg-emerald-400/12 text-emerald-200"
                        }`}
                      >
                        {item.impacto}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-white/92">{item.acao}</p>
                    {contato?.telefone ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/82">
                          <Phone className="mr-1 inline h-3.5 w-3.5" />
                          {contato.telefone}
                        </span>
                        {contato.whatsapp ? (
                          <a
                            href={contato.whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Ligar no WhatsApp
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-white/48">
                      <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                      Insight acionavel gerado a partir dos sinais reais da carteira.
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        </div>
      </div>
    </section>
  )
}

