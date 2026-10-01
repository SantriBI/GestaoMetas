"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Calculator, CircleDollarSign, Gauge, Loader2, RotateCcw, Sparkles, Target, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { formatCurrency } from "@/lib/types"
import { fetchMinhaPremiacao, PremiacaoVendedorApiError, type MinhaPremiacao } from "@/lib/premiacao-vendedor"
import {
  fetchContadoresVendaPremiacao,
  fetchGruposSimulador,
  fetchSimuladorPremiacao,
  PremiacaoSimuladorApiError,
  type ContadoresVendaPremiacao,
  type GrupoHistoricoVendedor,
  type SimuladorPremiacaoResultado,
} from "@/lib/premiacao-simulador"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

export default function MinhaPremiacaoPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [premiacao, setPremiacao] = useState<MinhaPremiacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [grupos, setGrupos] = useState<GrupoHistoricoVendedor[]>([])
  const [grupoSelecionado, setGrupoSelecionado] = useState("")
  const [valorSimulado, setValorSimulado] = useState("20000")
  const [resultadoSimulacao, setResultadoSimulacao] = useState<SimuladorPremiacaoResultado | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [erroSimulador, setErroSimulador] = useState<string | null>(null)
  const [contadores, setContadores] = useState<ContadoresVendaPremiacao | null>(null)

  useEffect(() => {
    const user = getStoredUser()

    if (!user || (user.role !== "VENDEDOR" && user.role !== "GERENTE_SISTEMAS")) {
      router.push("/login")
      return
    }

    if (user.role === "GERENTE_SISTEMAS" && (!user.empresa_id || !user.sk_vendedor)) {
      router.push("/gerente-sistemas")
      return
    }

    if (!user.featurePremiacaoHabilitada) {
      router.push("/vendedor")
      return
    }

    setStoredUser(user)
    setAuthUser(user)
  }, [router])

  useEffect(() => {
    if (!authUser) return
    void loadPremiacao()
    void loadDadosSimulador()
  }, [authUser])

  async function loadPremiacao() {
    setLoading(true)

    try {
      const data = await fetchMinhaPremiacao()
      setPremiacao(data)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel carregar sua premiacao agora."
      setError(message)
      setPremiacao(null)
      if (err instanceof PremiacaoVendedorApiError && err.status !== 404) {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadDadosSimulador() {
    try {
      const [listaGrupos, contadoresProntos] = await Promise.all([
        fetchGruposSimulador(),
        fetchContadoresVendaPremiacao(),
      ])
      setGrupos(listaGrupos)
      setGrupoSelecionado((atual) => atual || listaGrupos[0]?.nomeGrupo || "")
      setContadores(contadoresProntos)
    } catch {
      // Simulador e um complemento opcional da tela - falha ao carregar grupos/contadores nao
      // deve impedir o vendedor de ver a premiacao principal (ja tratada em loadPremiacao).
    }
  }

  async function handleSimular() {
    const valorNumerico = Number(valorSimulado.replace(",", "."))
    if (!grupoSelecionado) {
      toast.error("Selecione um grupo de produto para simular.")
      return
    }
    if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
      toast.error("Informe um valor de venda adicional valido.")
      return
    }

    setSimulando(true)
    setErroSimulador(null)
    try {
      const resultado = await fetchSimuladorPremiacao(3, grupoSelecionado, valorNumerico)
      setResultadoSimulacao(resultado)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel simular este cenario agora."
      setErroSimulador(message)
      setResultadoSimulacao(null)
      if (!(err instanceof PremiacaoSimuladorApiError && err.status === 422)) {
        toast.error(message)
      }
    } finally {
      setSimulando(false)
    }
  }

  if (loading && !premiacao) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.16),transparent_22%),linear-gradient(145deg,#071019,#08131f_45%,#0a1522)] pb-mobile-tabbar">
        <AppShellNav user={authUser} />
        <MobileTabBar user={authUser} />
        <main className="mx-auto flex min-h-[70vh] max-w-[1100px] items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-10 text-center text-white">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/12 border-t-emerald-300" />
            <div>
              <p className="text-lg font-semibold">Calculando sua premiacao</p>
              <p className="mt-1 text-sm text-white/64">Estamos conferindo sua comissao e sua margem+frete do mes.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const gatilhoMinimo = premiacao?.gatilhoMinimoMargem ?? 20000
  const margemMaisFrete = premiacao?.margemMaisFrete ?? 0
  const percentualGatilho = Math.min((margemMaisFrete / gatilhoMinimo) * 100, 100)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.16),transparent_22%),linear-gradient(145deg,#071019,#08131f_45%,#0a1522)] pb-mobile-tabbar">
      <AppShellNav user={authUser} />
      <MobileTabBar user={authUser} />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-[24px] border border-amber-300/18 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-50/90">
          Valores parciais do mes em andamento
          {premiacao?.mesReferencia ? ` (${premiacao.mesReferencia})` : ""}, atualizados com as vendas recebidas
          até ontem. Este nao e o fechamento do mes - os numeros ainda podem mudar até o mes terminar.
        </section>

        {error ? (
          <section className="rounded-[24px] border border-rose-300/18 bg-rose-400/10 px-5 py-4 text-sm leading-6 text-rose-50/90">
            {error}
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,17,30,0.94),rgba(10,20,34,0.88),rgba(18,90,70,0.28))] px-6 py-7 shadow-[0_28px_80px_rgba(2,6,23,0.34)] sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/90">
            <Sparkles className="h-3.5 w-3.5" />
            Minha Premiacao
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
            {formatCurrency(premiacao?.valorPremiacaoFinal ?? 0)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
            {premiacao?.elegivel
              ? "Sua premiacao final do mes, ja com o acelerador da sua faixa de margem+frete aplicado."
              : "Voce ainda nao bateu o gatilho minimo de margem+frete para liberar o acelerador este mes."}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                  Margem + Frete no mes
                </p>
                <Gauge className="h-4 w-4 text-cyan-200" />
              </div>
              <p className="mt-3 text-2xl font-black text-white">{formatCurrency(margemMaisFrete)}</p>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#f59e0b)] transition-[width] duration-700 ease-out"
                  style={{ width: `${percentualGatilho}%` }}
                />
              </div>

              <p className="mt-3 text-sm leading-6 text-white/64">
                {premiacao?.elegivel
                  ? `Voce ja passou do gatilho minimo de ${formatCurrency(gatilhoMinimo)}.`
                  : `Faltam ${formatCurrency(premiacao?.faltanteGatilho ?? gatilhoMinimo)} de margem+frete para virar elegivel (gatilho minimo: ${formatCurrency(gatilhoMinimo)}).`}
              </p>

              {premiacao?.faltanteProximaFaixa && premiacao.faltanteProximaFaixa > 0 ? (
                <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                  Faltam {formatCurrency(premiacao.faltanteProximaFaixa)} para subir para a proxima faixa de acelerador.
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                  Sua faixa atual
                </p>
                <TrendingUp className="h-4 w-4 text-emerald-200" />
              </div>
              <p className="mt-3 text-xl font-black text-white">{premiacao?.faixaAcelerador ?? "-"}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/62">
                <MiniInfo label="Acelerador" value={`${((premiacao?.percAcelerador ?? 0) * 100).toFixed(0)}%`} />
                <MiniInfo label="Bonus fixo" value={formatCurrency(premiacao?.bonusFixoAdicional ?? 0)} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Target className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">A conta, passo a passo</h3>
              <p className="text-sm text-white/56">De onde vem o seu valor final</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CalcStep
              icon={<CircleDollarSign className="h-4 w-4 text-cyan-200" />}
              label="Comissao base (ERP)"
              value={formatCurrency(premiacao?.valorComissaoBase ?? 0)}
            />
            <CalcOperator symbol="×" />
            <CalcStep
              icon={<TrendingUp className="h-4 w-4 text-emerald-200" />}
              label="Acelerador da faixa"
              value={`${((premiacao?.percAcelerador ?? 0) * 100).toFixed(0)}%`}
            />
            <CalcOperator symbol="+" />
            <CalcStep
              icon={<Sparkles className="h-4 w-4 text-amber-200" />}
              label="Bonus fixo"
              value={formatCurrency(premiacao?.bonusFixoAdicional ?? 0)}
            />
            <CalcOperator symbol="=" />
            <CalcStep
              icon={<Gauge className="h-4 w-4 text-white" />}
              label="Premiacao final"
              value={formatCurrency(premiacao?.valorPremiacaoFinal ?? 0)}
              highlight
            />
          </div>

          {!premiacao?.elegivel ? (
            <p className="mt-5 rounded-2xl border border-amber-300/16 bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-50/90">
              Como voce ainda nao bateu o gatilho minimo de margem+frete, o acelerador desta faixa e 0% e a
              premiacao final fica zerada.
            </p>
          ) : null}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Calculator className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Simulador</h3>
              <p className="text-sm text-white/56">Se eu vender mais, quanto minha premiacao muda?</p>
            </div>
          </div>

          {contadores?.grupoPreferido && contadores.faltanteGatilhoEmVenda != null && contadores.faltanteGatilhoEmVenda > 0 ? (
            <p className="mt-4 rounded-2xl border border-amber-300/16 bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-50/90">
              No seu ritmo de margem em <strong>{contadores.grupoPreferido.nomeGrupo}</strong>, faltam aproximadamente{" "}
              {formatCurrency(contadores.faltanteGatilhoEmVenda)} de venda para bater o gatilho minimo.
            </p>
          ) : null}
          {contadores?.grupoPreferido && contadores.faltanteProximaFaixaEmVenda != null ? (
            <p className="mt-2 rounded-2xl border border-emerald-300/16 bg-emerald-400/8 px-4 py-3 text-sm leading-6 text-emerald-50/90">
              No seu ritmo de margem em <strong>{contadores.grupoPreferido.nomeGrupo}</strong>, faltam aproximadamente{" "}
              {formatCurrency(contadores.faltanteProximaFaixaEmVenda)} de venda para subir de faixa.
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Grupo de produto
              <select
                value={grupoSelecionado}
                onChange={(event) => setGrupoSelecionado(event.target.value)}
                disabled={grupos.length === 0}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none focus:border-cyan-300/40 disabled:opacity-50"
              >
                {grupos.length === 0 ? (
                  <option value="">Sem historico de vendas por grupo</option>
                ) : (
                  grupos.map((grupo) => (
                    <option key={grupo.nomeGrupo} value={grupo.nomeGrupo} className="bg-[#0a1522] text-white">
                      {grupo.nomeGrupo}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Vender mais (R$)
              <input
                type="number"
                min={0}
                step="100"
                value={valorSimulado}
                onChange={(event) => setValorSimulado(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none focus:border-cyan-300/40"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleSimular()}
              disabled={simulando || grupos.length === 0}
              className="inline-flex items-center justify-center gap-2 self-end rounded-2xl border border-cyan-300/24 bg-cyan-400/12 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20 disabled:opacity-50"
            >
              {simulando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Simular
            </button>
          </div>

          {erroSimulador ? (
            <p className="mt-4 rounded-2xl border border-rose-300/18 bg-rose-400/8 px-4 py-3 text-sm leading-6 text-rose-50/90">
              {erroSimulador}
            </p>
          ) : null}

          {resultadoSimulacao ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/48">Margem + Frete</p>
                <p className="mt-2 text-lg font-black text-white">{formatCurrency(resultadoSimulacao.simulado.margemMaisFrete)}</p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  +{formatCurrency(resultadoSimulacao.diferenca.margemMaisFrete)}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/48">Acelerador resultante</p>
                <p className="mt-2 text-lg font-black text-white">
                  {(resultadoSimulacao.simulado.percAcelerador * 100).toFixed(0)}%
                </p>
                <p className="mt-1 text-xs text-white/56">
                  {resultadoSimulacao.simulado.elegivel ? "Elegivel" : "Ainda nao elegivel"}
                  {resultadoSimulacao.simulado.bonusFixoAdicional > 0
                    ? ` · bonus +${formatCurrency(resultadoSimulacao.simulado.bonusFixoAdicional)}`
                    : ""}
                </p>
              </div>
              <div className="rounded-[24px] border border-emerald-300/30 bg-emerald-400/12 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/56">Premiacao final simulada</p>
                <p className="mt-2 text-lg font-black text-emerald-200">
                  {formatCurrency(resultadoSimulacao.simulado.valorPremiacaoFinal)}
                </p>
                <p className="mt-1 text-xs text-emerald-100/80">
                  +{formatCurrency(resultadoSimulacao.diferenca.valorPremiacaoFinal)}
                </p>
              </div>

              {resultadoSimulacao.simulado.faltanteProximaFaixa && resultadoSimulacao.simulado.faltanteProximaFaixa > 0 ? (
                <p className="sm:col-span-3 text-sm leading-6 text-white/64">
                  Depois dessa venda, ainda faltariam {formatCurrency(resultadoSimulacao.simulado.faltanteProximaFaixa)} de
                  margem+frete para a proxima faixa.
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="mt-5 text-xs leading-5 text-white/40">
            Estimativa baseada na sua margem media historica no grupo escolhido - nao e uma projecao garantida.
          </p>
        </section>

        <button
          type="button"
          onClick={() => void loadPremiacao()}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/78 transition-colors hover:bg-white/10 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Atualizar leitura
        </button>
      </main>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  )
}

function CalcStep({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex-1 rounded-[20px] border p-4 text-center ${
        highlight ? "border-emerald-300/30 bg-emerald-400/12" : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/56">{label}</p>
      </div>
      <p className={`mt-2 text-lg font-black ${highlight ? "text-emerald-200" : "text-white"}`}>{value}</p>
    </div>
  )
}

function CalcOperator({ symbol }: { symbol: string }) {
  return <div className="hidden text-xl font-black text-white/40 sm:block">{symbol}</div>
}
