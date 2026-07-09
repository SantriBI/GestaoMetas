"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  Crown,
  Gem,
  HeartHandshake,
  LogOut,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserSearch,
} from "lucide-react"
import { formatCurrency } from "@/lib/types"
import { AuthUser, clearStoredUser, getStoredUser } from "@/lib/user-session"

interface ClienteData {
  sk_cliente: number | string | null
  nome_cliente: string | null
  cpf: string | null
  cnpj: string | null
  tipo_cliente: string | null
  cliente_desde: string | Date | null
  nome_grupo: string | null
}

interface RfvData {
  classificacao: string | null
  recencia: number
  frequencia: number
  valor: number
}

interface FinanceiroData {
  total_gasto: number
  total_compras: number
  ticket_medio: number
  ultima_compra: string | number | null
}

interface ProdutoItem {
  nome: string | null
  quantidade: number
  valor: number
}

interface CategoriaItem {
  grupo: string | null
  valor: number
}

interface UltimaCompraItem {
  nome: string | null
  quantidade_item: number
  sk_dt_fechamento: string | number | null
}

interface InvestigacaoClienteData {
  cliente: ClienteData
  rfv: RfvData
  financeiro: FinanceiroData
  ultimo_vendedor: string | null
  data_ultima_compra: string | number | null
  top_produtos: ProdutoItem[]
  top_categorias: CategoriaItem[]
  ultimas_compras: UltimaCompraItem[]
}

function formatarData(value?: string | Date | number | null) {
  if (!value) return "-"

  if (typeof value === "number") {
    const texto = String(value)
    if (texto.length === 8) {
      const ano = Number(texto.slice(0, 4))
      const mes = Number(texto.slice(4, 6)) - 1
      const dia = Number(texto.slice(6, 8))
      const data = new Date(ano, mes, dia)
      return Number.isNaN(data.getTime()) ? texto : data.toLocaleDateString("pt-BR")
    }
  }

  const data = new Date(value)
  return Number.isNaN(data.getTime()) ? String(value) : data.toLocaleDateString("pt-BR")
}

function CardAnalise({
  titulo,
  subtitulo,
  children,
  tonalidade,
  destaque = false,
  icone,
}: {
  titulo: string
  subtitulo: string
  children: React.ReactNode
  tonalidade: "azul" | "violeta" | "esmeralda" | "ambar" | "vermelho"
  destaque?: boolean
  icone?: React.ReactNode
}) {
  const estilo = {
    azul:
      "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(74,222,128,0.1),rgba(9,14,27,0.82))]",
    violeta:
      "border-violet-400/18 bg-[linear-gradient(180deg,rgba(124,58,237,0.1),rgba(15,11,28,0.84))]",
    esmeralda:
      "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(8,20,20,0.86))]",
    ambar:
      "border-amber-400/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.1),rgba(24,18,8,0.84))]",
    vermelho:
      "border-red-400/18 bg-[linear-gradient(180deg,rgba(239,68,68,0.1),rgba(28,10,14,0.84))]",
  }[tonalidade]

  return (
    <section
      className={`rounded-[28px] border p-6 ${estilo} ${
        destaque
          ? "shadow-[0_28px_80px_rgba(0,0,0,0.16)] ring-1 ring-[color:var(--shell-border)]"
          : "shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] theme-shell-subtle">{titulo}</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight theme-shell-text">{subtitulo}</h2>
        </div>
        {icone ? (
          <div className="theme-shell-panel flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border theme-shell-text shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
            {icone}
          </div>
        ) : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function obterTonalidadeRfv(classificacao?: string | null): "azul" | "violeta" | "esmeralda" | "ambar" | "vermelho" {
  const texto = String(classificacao ?? "").toUpperCase()

  if (texto.includes("CAMPE")) return "esmeralda"
  if (texto.includes("RISCO") || texto.includes("PERD")) return "vermelho"
  if (texto.includes("FIÉ") || texto.includes("FIEI")) return "azul"
  if (texto.includes("RECUP") || texto.includes("PROMISS")) return "violeta"

  return "azul"
}

function obterIconeRfv(classificacao?: string | null) {
  const texto = String(classificacao ?? "").toUpperCase()

  if (texto.includes("CAMPE")) return <Crown className="h-6 w-6" />
  if (texto.includes("RISCO") || texto.includes("PERD")) return <ShieldAlert className="h-6 w-6" />
  if (texto.includes("FIÉ") || texto.includes("FIEI")) return <HeartHandshake className="h-6 w-6" />
  if (texto.includes("RECUP")) return <Gem className="h-6 w-6" />
  if (texto.includes("PROMISS")) return <TrendingUp className="h-6 w-6" />

  return <Sparkles className="h-6 w-6" />
}

function getHomeRoute(user: AuthUser | null) {
  if (user?.role === "GERENTE_SISTEMAS") {
    if (user.gerente_sistemas_view === "VENDEDOR") return "/vendedor"
    if (user.gerente_sistemas_view === "GERENTE") return "/dashboard"
    return "/gerente-sistemas"
  }
  if (user?.role === "GERENTE") return "/dashboard"
  if (user?.role === "VENDEDOR") return "/vendedor"
  return "/login"
}

export default function InvestigarClientePage() {
  const router = useRouter()
  const [busca, setBusca] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<InvestigacaoClienteData | null>(null)
  const tonalidadeRfv = obterTonalidadeRfv(dados?.rfv.classificacao)
  const iconeRfv = obterIconeRfv(dados?.rfv.classificacao)
  const user = getStoredUser()

  function normalizarDocumento(valor: string) {
    return valor.replace(/\D/g, "").slice(0, 14)
  }

  function formatarDocumento(valor: string) {
    const numeros = normalizarDocumento(valor)

    if (numeros.length <= 11) {
      return numeros
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2")
    }

    return numeros
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }

  function deveFormatarComoDocumento(valor: string) {
    const texto = valor.replace(/[.\-\/\s]/g, "")
    return texto.length > 0 && /^\d+$/.test(texto)
  }

  async function investigarCliente(event?: FormEvent) {
    event?.preventDefault()

    const buscaNormalizada = busca.trim()
    const ehDocumento = deveFormatarComoDocumento(buscaNormalizada)
    const termo = ehDocumento ? normalizarDocumento(buscaNormalizada) : buscaNormalizada

    if (!termo) {
      setErro("Informe um CPF, CNPJ ou nome do cliente para pesquisar.")
      setDados(null)
      return
    }

    if (ehDocumento && termo.length !== 11 && termo.length !== 14) {
      setErro("Digite um CPF com 11 números, um CNPJ com 14 números ou pesquise pelo nome do cliente.")
      setDados(null)
      return
    }

    try {
      setCarregando(true)
      setErro(null)

      const params = new URLSearchParams({ q: termo })
      const empresaId = user?.empresa_id ?? user?.sk_empresa
      if (empresaId !== null && empresaId !== undefined && String(empresaId).trim()) {
        params.set("empresa_id", String(empresaId))
      }

      const response = await fetch(
        `/api/investigar-cliente?${params.toString()}`,
        { cache: "no-store", credentials: "include" }
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(json.error ?? "Não foi possível investigar o cliente.")
      }

      setDados(json)
    } catch (error) {
      console.error("Erro ao investigar cliente:", error)
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível investigar o cliente."
      )
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="theme-shell min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.16),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.08),transparent_18%)]" />
        <div className="absolute inset-0 bg-[var(--shell-bg)]" />
      </div>

      <header className="theme-shell-surface sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(getHomeRoute(user))}
              className="theme-shell-panel inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm theme-shell-muted transition-colors hover:bg-[var(--shell-panel-strong)] hover:text-[var(--shell-text)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao painel
            </button>
            <Image
              src="/Logo%20Santri%20White.png"
              alt="Logo"
              width={110}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearStoredUser()
                router.push("/login")
              }}
              className="theme-shell-panel inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm theme-shell-muted transition-colors hover:bg-[var(--shell-panel-strong)] hover:text-[var(--shell-text)]"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10">
        <section className="theme-shell-surface overflow-hidden rounded-[32px] border border-emerald-400/14 p-8 shadow-[0_24px_64px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="theme-shell-panel inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-500/8 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-emerald-100/72">
                <UserSearch className="h-3.5 w-3.5" />
                Panorama analítico do cliente
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight theme-shell-text md:text-6xl">
                Investigar Cliente
              </h1>
              <p className="mt-4 max-w-2xl text-lg theme-shell-muted">
                Pesquise qualquer cliente da base e entenda o comportamento de compra antes de ofertar.
              </p>
            </div>

            <div className="rounded-[26px] border border-emerald-400/16 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(15,23,42,0.78),rgba(74,222,128,0.08))] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
                Leitura rápida
              </p>
              <p className="mt-2 text-sm font-medium text-emerald-50">
                Histórico, RFV, categorias favoritas e sinais claros do que oferecer em seguida.
              </p>
            </div>
          </div>

          <form onSubmit={investigarCliente} className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="theme-shell-card rounded-[28px] border p-2">
              <div className="theme-shell-panel flex items-center gap-3 rounded-2xl px-4 py-3">
                <Search className="h-5 w-5 text-emerald-200" />
                <input
                  value={busca}
                  onChange={(event) => {
                    const valor = event.target.value
                    setBusca(deveFormatarComoDocumento(valor) ? formatarDocumento(valor) : valor)
                  }}
                  placeholder="CPF, CNPJ ou nome do cliente"
                  className="w-full bg-transparent text-base theme-shell-text outline-none placeholder:text-[color:var(--shell-subtle)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="inline-flex items-center justify-center gap-2 rounded-[28px] border border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.26),rgba(34,197,94,0.24),rgba(74,222,128,0.18))] px-6 py-4 text-base font-semibold text-white shadow-[0_18px_45px_rgba(34,197,94,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(74,222,128,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {carregando ? "Investigando..." : "Investigar"}
            </button>
          </form>
          <p className="mt-3 text-sm theme-shell-subtle">
            Você pode pesquisar por CPF, CNPJ ou nome do cliente.
          </p>
        </section>

        {erro ? (
          <section className="mt-8 rounded-[28px] border border-red-500/20 bg-red-500/8 p-6 text-red-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Investigação indisponível</p>
                <p className="mt-1 text-sm text-red-100/80">{erro}</p>
              </div>
            </div>
          </section>
        ) : null}

        {dados ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <CardAnalise
              titulo="Cliente"
              subtitulo={dados.cliente.nome_cliente ?? "Cliente localizado"}
              tonalidade="azul"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">CPF / CNPJ</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {dados.cliente.cpf || dados.cliente.cnpj || "-"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Cliente desde</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatarData(dados.cliente.cliente_desde)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Grupo</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {dados.cliente.nome_grupo || "-"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Tipo</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {dados.cliente.tipo_cliente || "-"}
                  </p>
                </div>
              </div>
            </CardAnalise>

            <CardAnalise
              titulo="Classificação RFV"
              subtitulo={dados.rfv.classificacao || "Sem classificação"}
              tonalidade={tonalidadeRfv}
              destaque
              icone={iconeRfv}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Dias desde a última compra
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{dados.rfv.recencia}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Quantidade de compras
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{dados.rfv.frequencia}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Valor acumulado
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(dados.rfv.valor)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Ticket médio do cliente
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {formatCurrency(dados.financeiro.ticket_medio)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4 sm:col-span-2 xl:col-span-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Data da última compra
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {formatarData(dados.data_ultima_compra ?? dados.financeiro.ultima_compra)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-4 sm:col-span-2 xl:col-span-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Último vendedor que atendeu
                  </p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {dados.ultimo_vendedor || "-"}
                  </p>
                </div>
              </div>
            </CardAnalise>

            <CardAnalise
              titulo="Top produtos"
              subtitulo="Itens com maior aderência"
              tonalidade="azul"
            >
              {dados.top_produtos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                  Cliente ainda não possui histórico de compras.
                </div>
              ) : (
                <div className="space-y-3">
                  {dados.top_produtos.map((item, index) => (
                    <div key={`${item.nome}-${index}`} className="rounded-2xl bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{item.nome || "Produto sem nome"}</p>
                          <p className="mt-1 text-sm text-white/55">Quantidade: {item.quantidade}</p>
                        </div>
                        <p className="text-lg font-bold text-white">{formatCurrency(item.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardAnalise>

            <CardAnalise
              titulo="Categorias favoritas"
              subtitulo="Top 5 grupos de produto"
              tonalidade="ambar"
            >
              {dados.top_categorias.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                  Cliente ainda não possui histórico de compras.
                </div>
              ) : (
                <div className="space-y-3">
                  {dados.top_categorias.map((item, index) => (
                    <div key={`${item.grupo}-${index}`} className="rounded-2xl bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-white">{item.grupo || "Sem grupo"}</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(item.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardAnalise>

            <CardAnalise
              titulo="Últimas compras"
              subtitulo="Últimos produtos comprados"
              tonalidade="violeta"
            >
              {dados.ultimas_compras.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                  Cliente ainda não possui histórico de compras.
                </div>
              ) : (
                <div className="space-y-3">
                  {dados.ultimas_compras.map((item, index) => (
                    <div key={`${item.nome}-${index}`} className="rounded-2xl bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{item.nome || "Produto sem nome"}</p>
                          <p className="mt-1 text-sm text-white/55">Quantidade: {item.quantidade_item}</p>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {formatarData(item.sk_dt_fechamento)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardAnalise>
          </div>
        ) : (
          <section className="mt-8 rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center">
            <div className="mx-auto max-w-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-white">
                Panorama completo do cliente
              </h2>
              <p className="mt-3 text-sm text-white/62">
                Pesquise um cliente para ver classificação RFV, total gasto, ticket médio,
                categorias favoritas, produtos mais comprados e compras recentes.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

