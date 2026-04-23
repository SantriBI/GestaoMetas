"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  LogOut,
  ShieldCheck,
  Swords,
} from "lucide-react"
import { formatCurrency } from "@/lib/types"
import { MotivationSpotlight } from "@/components/layout/MotivationSpotlight"
import {
  CardClientesRFV,
  CardProdutosAlta,
  CardRecomendacoes,
  CardResumoAtaque,
  type ClienteAtaque,
  type InsightAcao,
  type ProdutoAtaque,
  type RecommendationContact,
} from "@/components/area-ataque/cards"
import { useSellerMotivation } from "@/hooks/useSellerMotivation"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

interface AreaAtaqueData {
  resumo: {
    campeoes: number
    fieis: number
    emRisco: number
    valorHistoricoClientes: number
    periodoHistoricoInicio: string | Date | null
    periodoHistoricoFim: string | Date | null
    orcamentosAbertosCampeoes: number
    orcamentosAbertosFieis: number
    orcamentosAbertosRisco: number
  }
  campeoes: ClienteAtaque[]
  fieis: ClienteAtaque[]
  emRisco: ClienteAtaque[]
  produtosEmAlta: ProdutoAtaque[]
  alertasEstrategicos: string[]
  recomendacoes: string[]
}

interface AssistenteVendasResponse {
  insights?: Array<
    | string
    | {
        acao?: string
        impacto?: string
      }
  >
  source?: string
  payload?: {
    clientes_prioritarios?: {
      clientes_campeoes_sem_compra?: Array<{
        nome?: string
        telefone?: string | null
      }>
    }
    orcamentos_estrategicos?: {
      top_orcamentos?: Array<{
        cliente?: string
        telefone?: string | null
      }>
    }
  }
}

const estadoInicial: AreaAtaqueData = {
  resumo: {
    campeoes: 0,
    fieis: 0,
    emRisco: 0,
    valorHistoricoClientes: 0,
    periodoHistoricoInicio: null,
    periodoHistoricoFim: null,
    orcamentosAbertosCampeoes: 0,
    orcamentosAbertosFieis: 0,
    orcamentosAbertosRisco: 0,
  },
  campeoes: [],
  fieis: [],
  emRisco: [],
  produtosEmAlta: [],
  alertasEstrategicos: [],
  recomendacoes: [],
}

function SkeletonCard() {
  return (
    <div className="theme-shell-panel rounded-[28px] border p-6">
      <div className="h-3 w-28 animate-pulse rounded bg-[var(--shell-panel-strong)]" />
      <div className="mt-5 h-9 w-36 animate-pulse rounded bg-[var(--shell-panel-strong)]" />
      <div className="mt-3 h-4 w-60 animate-pulse rounded bg-[var(--shell-panel-strong)]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="theme-shell-panel rounded-2xl border p-4">
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--shell-panel-strong)]" />
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-[var(--shell-panel-strong)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AreaAtaquePage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [dados, setDados] = useState<AreaAtaqueData>(estadoInicial)
  const [carregando, setCarregando] = useState(true)
  const [carregandoInsights, setCarregandoInsights] = useState(true)
  const [insightsIa, setInsightsIa] = useState<InsightAcao[]>([])
  const [origemInsights, setOrigemInsights] = useState<string | null>(null)
  const [contatosInsights, setContatosInsights] = useState<RecommendationContact[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const { getMessage } = useSellerMotivation(authUser)

  function formatarPeriodo(inicio?: string | Date | null, fim?: string | Date | null) {
    if (!inicio && !fim) return "Período histórico da carteira priorizada"

    const inicioFormatado = inicio ? new Date(inicio).toLocaleDateString("pt-BR") : null
    const fimFormatado = fim ? new Date(fim).toLocaleDateString("pt-BR") : null

    if (inicioFormatado && fimFormatado) {
      return `Período analisado: ${inicioFormatado} até ${fimFormatado}`
    }

    return `Período analisado até ${fimFormatado ?? inicioFormatado}`
  }

  function normalizarInsights(
    itens: AssistenteVendasResponse["insights"] | string[]
  ): InsightAcao[] {
    if (!Array.isArray(itens)) {
      return []
    }

    return itens
      .map((item) => {
        if (typeof item === "string") {
          const acao = item.trim()
          return acao ? { acao, impacto: "medio" as const } : null
        }

        if (!item || typeof item !== "object") {
          return null
        }

        const acao = String(item.acao ?? "").trim()
        const impacto = String(item.impacto ?? "medio").trim().toLowerCase()
        const impactoNormalizado =
          impacto === "alto" || impacto === "rapido" || impacto === "medio"
            ? impacto
            : "medio"

        return acao
          ? { acao, impacto: impactoNormalizado as InsightAcao["impacto"] }
          : null
      })
      .filter((item): item is InsightAcao => Boolean(item))
      .slice(0, 4)
  }

  useEffect(() => {
    const user = getStoredUser()

    if (!user) {
      router.push("/login")
      return
    }

    if (user.role !== "VENDEDOR") {
      router.push("/login")
      return
    }

    setStoredUser(user)
    setAuthUser(user)
    const legacySellerId = (user as AuthUser & { vendedor_id?: number | string | null }).vendedor_id ?? null
    const identificador = legacySellerId ?? user.sk_vendedor ?? null

    async function carregarAreaAtaque() {
      try {
        setCarregando(true)
        setErro(null)

        const response = await fetch(`/api/area-ataque/${identificador}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          const mensagemErro =
            response.status === 404
              ? "A rota da Área de Ataque não está disponível no backend atual. Reinicie o Back para carregar a rota nova."
              : `Não foi possível carregar a Área de Ataque. HTTP ${response.status}.`

          throw new Error(mensagemErro)
        }

        const json = await response.json()
        setDados({
          ...estadoInicial,
          ...json,
        })
      } catch (error) {
        console.error("Erro ao carregar area de ataque:", error)
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a inteligência da sua carteira agora."
        )
      } finally {
        setCarregando(false)
      }
    }

    async function carregarAssistenteVendas() {
      try {
        setCarregandoInsights(true)
        setOrigemInsights(null)

        const response = await fetch("/api/assistente-vendas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vendedor_id: identificador }),
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(`Falha ao carregar insights: HTTP ${response.status}`)
        }

        const json = (await response.json()) as AssistenteVendasResponse
        const insights = normalizarInsights(json.insights)
        const contatos = [
          ...(json.payload?.clientes_prioritarios?.clientes_campeoes_sem_compra ?? []).map((item) => ({
            nome: String(item.nome ?? "").trim(),
            telefone: item.telefone ?? null,
            whatsapp: item.telefone ? `https://wa.me/55${String(item.telefone).replace(/\D/g, "")}` : null,
          })),
          ...(json.payload?.orcamentos_estrategicos?.top_orcamentos ?? []).map((item) => ({
            nome: String(item.cliente ?? "").trim(),
            telefone: item.telefone ?? null,
            whatsapp: item.telefone ? `https://wa.me/55${String(item.telefone).replace(/\D/g, "")}` : null,
          })),
        ].filter((item) => item.nome)

        setInsightsIa(insights)
        setOrigemInsights(json.source ?? null)
        setContatosInsights(contatos)
      } catch (error) {
        console.error("Erro ao carregar assistente de vendas:", error)
        setInsightsIa([])
        setOrigemInsights("fallback")
        setContatosInsights([])
      } finally {
        setCarregandoInsights(false)
      }
    }

    carregarAreaAtaque()
    carregarAssistenteVendas()
  }, [router])

  const totalClientesMapeados = useMemo(
    () => dados.resumo.campeoes + dados.resumo.fieis + dados.resumo.emRisco,
    [dados.resumo.campeoes, dados.resumo.emRisco, dados.resumo.fieis]
  )
  const recomendacoesAtivas = insightsIa.length
    ? insightsIa
    : normalizarInsights(dados.recomendacoes)
  const prioridades = recomendacoesAtivas.slice(0, 3)
  const totalOrcamentosEmAberto =
    dados.resumo.orcamentosAbertosCampeoes +
    dados.resumo.orcamentosAbertosFieis +
    dados.resumo.orcamentosAbertosRisco
  const valorCarteiraCampeoes = dados.campeoes.reduce((total, cliente) => total + Number(cliente.valor ?? 0), 0)
  const attackMotivation = getMessage({
    context: "attack",
    openQuotes: totalOrcamentosEmAberto,
    championValue: valorCarteiraCampeoes,
  })

  return (
    <div className="theme-shell min-h-screen">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.14),transparent_20%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.08),transparent_18%)]" />
        <div className="absolute inset-0 bg-[var(--shell-bg)]" />
      </div>

      <header className="theme-shell-surface sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/vendedor")}
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
                sessionStorage.removeItem("user")
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
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="theme-shell-panel inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-500/8 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-emerald-100/72">
                <Swords className="h-3.5 w-3.5" />
                Assistente estratégico de vendas
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 shadow-[0_16px_30px_rgba(34,197,94,0.14)]">
                  <Swords className="h-6 w-6" />
                </div>
                <h1 className="text-4xl font-black tracking-tight theme-shell-text md:text-6xl">
                  Área de Ataque
                </h1>
              </div>
              <p className="mt-4 max-w-2xl text-lg theme-shell-muted">
                Uma visão clara da sua carteira para saber quem acionar, o que oferecer e onde recuperar oportunidades.
              </p>
              <p className="mt-3 text-sm theme-shell-subtle">
                {carregando
                    ? "Montando prioridades, sinais e rotas de ação para sua carteira."
                    : "Comece pelos riscos, aproveite os fiéis e consolide os campeões para sustentar o ritmo."}
              </p>
            </div>

          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CardResumoAtaque
              titulo="Clientes campeões"
              valor={String(dados.resumo.campeoes)}
              descricao="Base premium que sustenta recorrência."
              cor="emerald"
            />
            <CardResumoAtaque
              titulo="Clientes fiéis"
              valor={String(dados.resumo.fieis)}
              descricao="Melhor frente para ampliar ticket rápido."
              cor="emerald"
            />
            <CardResumoAtaque
              titulo="Clientes em risco"
              valor={String(dados.resumo.emRisco)}
              descricao="Ponto de atenção para recuperar receita."
              cor="amber"
            />
            <CardResumoAtaque
              titulo="Quanto esses clientes já gastaram"
              valor={formatCurrency(dados.resumo.valorHistoricoClientes)}
              descricao={formatarPeriodo(dados.resumo.periodoHistoricoInicio, dados.resumo.periodoHistoricoFim)}
              cor="violet"
            />
          </div>
        </section>

        <section className="mt-8">
          <MotivationSpotlight message={attackMotivation} compact />
        </section>

        {erro ? (
          <section className="mt-8 rounded-[28px] border border-red-500/20 bg-red-500/8 p-6 text-red-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Falha ao montar a Área de Ataque</p>
                <p className="mt-1 text-sm text-red-100/80">{erro}</p>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          {carregando ? (
            <>
              <div className="space-y-6">
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <div className="space-y-6">
                <SkeletonCard />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-6">
                <CardClientesRFV
                  emoji="R"
                  titulo="Clientes em Risco"
                  mensagem="Comece por aqui para recuperar relacionamento e proteger faturamento."
                  total={dados.resumo.emRisco}
                  orcamentosAbertos={dados.resumo.orcamentosAbertosRisco}
                  clientes={dados.emRisco}
                  variante="risco"
                />
                <CardClientesRFV
                  emoji="F"
                  titulo="Clientes Fiéis"
                  mensagem="Base quente para aumentar ticket e acelerar novas vendas."
                  total={dados.resumo.fieis}
                  orcamentosAbertos={dados.resumo.orcamentosAbertosFieis}
                  clientes={dados.fieis}
                  variante="fieis"
                />
                <CardClientesRFV
                  emoji="C"
                  titulo="Clientes Campeões"
                  mensagem="Carteira premium para proteger recorrência e sustentar faturamento."
                  total={dados.resumo.campeoes}
                  orcamentosAbertos={dados.resumo.orcamentosAbertosCampeoes}
                  clientes={dados.campeoes}
                  variante="campeoes"
                />
              </div>

              <div className="space-y-6">
                <CardProdutosAlta produtos={dados.produtosEmAlta} />
              </div>
            </>
          )}
        </div>

        <section className="mt-8">
          <CardRecomendacoes
            itens={recomendacoesAtivas}
            carregando={carregandoInsights}
            origem={origemInsights}
            contatos={[
              ...contatosInsights,
              ...dados.emRisco,
              ...dados.fieis,
              ...dados.campeoes,
            ].map((item) => ({
              nome: String(item.nome ?? "").trim(),
              telefone: item.telefone ?? null,
              whatsapp: item.whatsapp ?? null,
            }))}
          />
        </section>
      </main>
    </div>
  )
}

