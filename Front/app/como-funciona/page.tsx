import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  Crown,
  FileSpreadsheet,
  Gauge,
  LineChart,
  Megaphone,
  PackageSearch,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  Users,
  Zap,
} from "lucide-react"

const features = [
  ["Metas e performance em tempo real", "Acompanhe vendedor por vendedor, equipe por equipe e aja antes do fechamento apertar.", Target, "from-emerald-400/30 via-emerald-500/10 to-transparent"],
  ["Ranking que ativa competicao", "Crie ritmo de entrega com um placar vivo, bonito e facil de interpretar pela lideranca.", Trophy, "from-lime-300/24 via-emerald-400/10 to-transparent"],
  ["Analise RFV da carteira", "Entenda clientes campeoes, fieis, em risco, perdidos e oportunidades de reativacao.", Crown, "from-sky-400/24 via-cyan-400/10 to-transparent"],
  ["Orcamentos e oportunidades", "Mostre negociacoes abertas, follow-ups pendentes e negocios que precisam virar venda.", FileSpreadsheet, "from-fuchsia-400/24 via-violet-400/10 to-transparent"],
] as const

const benefits = [
  "Melhora o desempenho da equipe de vendas com mais foco diario",
  "Aumenta a previsibilidade do fechamento com acompanhamento visual",
  "Ajuda a recuperar clientes, avancar oportunidades e concluir orcamentos",
  "Reduz o tempo entre analise comercial e decisao de lideranca",
] as const

const steps = [
  ["1. Centraliza", "Metas, RFV, orcamentos, oportunidades e ranking ficam em uma leitura unica."],
  ["2. Prioriza", "O sistema mostra onde vender mais, quem precisa de apoio e quais clientes merecem acao agora."],
  ["3. Converte", "A lideranca reage mais rapido e o time atua com mais clareza para gerar resultado."],
] as const

export default function ComoFuncionaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_22%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.08),transparent_20%),linear-gradient(180deg,#06070d_0%,#04050a_100%)]" />
        <div className="absolute inset-0 overflow-hidden opacity-[0.14]">
          <div className="animate-grid-pan absolute -inset-[10%] [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,128,0.16)_1px,transparent_1px)] [background-size:72px_72px]" />
        </div>
        <div className="animate-drift absolute left-[8%] top-28 h-80 w-80 rounded-full bg-emerald-500/18 blur-3xl" />
        <div className="animate-drift absolute right-[8%] top-20 h-96 w-96 rounded-full bg-cyan-400/12 blur-3xl" style={{ animationDelay: "1.2s" }} />
      </div>

      <header className="relative z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo%20sip%202.0.svg" alt="Logo SIP 2.0" width={34} height={34} className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-white">
              SIP <span className="font-normal text-white/68">- Gestao de Metas</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#showcase" className="text-sm text-white/60 transition-colors hover:text-white">Sistema</a>
            <a href="#funcionalidades" className="text-sm text-white/60 transition-colors hover:text-white">Funcionalidades</a>
            <a href="#beneficios" className="text-sm text-white/60 transition-colors hover:text-white">Beneficios</a>
          </div>

          <Link href="/login" className="rounded-xl border border-emerald-500/40 bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(34,197,94,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110">
            Acessar Agora
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-10">
        <section className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-[#08121a]/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma comercial orientada a crescimento
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-black leading-[0.95] sm:text-5xl lg:text-7xl">
                <span className="block bg-[linear-gradient(135deg,#e2fbe8_0%,#86efac_28%,#67e8f9_62%,#bbf7d0_100%)] bg-clip-text text-transparent">
                  Transforme dados em decisões.
                </span>
                <span className="block text-white">E decisões em mais vendas, todos os dias.</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
                O Gestão de Metas ajuda sua empresa a melhorar vendas, elevar a performance da equipe comercial e agir com mais velocidade. Voce acompanha metas, ranking, RFV da carteira, orcamentos abertos e oportunidades de vendas em uma experiencia clara, premium e altamente comercial.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {["RFV da carteira", "Orcamentos em aberto", "Oportunidades comerciais", "Ranking entre vendedores"].map((item) => (
                <div key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/90">{item}</div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Entenda clientes campeoes, fieis, em risco e perdidos com RFV visual.",
                "Descubra quais orcamentos deveriam ser finalizados antes de esfriarem.",
                "Mostre ao time as melhores oportunidades para vender mais no ciclo atual.",
                "Crie um ambiente comercial mais competitivo, previsivel e orientado a resultado.",
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-slate-200">{item}</div>
              ))}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/40 bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-8 py-4 text-lg font-semibold text-white shadow-[0_16px_40px_rgba(34,197,94,0.3)] transition-all hover:-translate-y-0.5 hover:brightness-110">
                Entrar no sistema
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/" className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-8 py-4 text-lg font-semibold text-white/92 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
                Voltar para a home
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_30%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,16,24,0.96),rgba(5,8,14,0.96))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Gestão de Metas</span>
              </div>

              <div className="rounded-[28px] border border-emerald-400/16 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_30%),linear-gradient(180deg,rgba(8,14,24,0.96),rgba(9,13,20,0.94))] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/80">Dashboard</p>
                    <h2 className="mt-2 text-[1.75rem] font-black text-white">Crescimento, carteira e conversao no mesmo painel</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/18 text-emerald-100">
                    <Gauge className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["Meta", "R$ 310K", "objetivo da loja "],
                    ["Realizado", "R$ 269K", "87% do objetivo"],
                    ["Orcamentos abertos", "38", "14 com urgencia"],
                  ].map(([label, value, note], index) => (
                    <div key={label} className={`rounded-2xl border p-4 ${index === 1 ? "border-cyan-400/14 bg-cyan-400/[0.06]" : "border-white/8 bg-white/[0.04]"}`}>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-black text-white">{value}</p>
                      <p className="mt-1 text-xs text-emerald-300">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
                  <div className="rounded-[24px] border border-white/8 bg-[#07111a] p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/16 text-emerald-100">
                        <Radar className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Radar de Vendas</p>
                        <p className="text-xs text-slate-400">leitura tatica dos ultimos movimentos</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["SUCESSO", "GUILHERME DINIZ lidera a equipe com 80% da meta", "bg-emerald-500/16 text-emerald-200 border-emerald-400/20", "text-emerald-300"],
                        ["ALERTA", "MARCOS ALMEIDA esta na ultima posicao com 44% da meta", "bg-amber-500/14 text-amber-100 border-amber-400/20", "text-amber-300"],
                        ["ALERTA", "10.314 clientes fieis estao esfriando", "bg-amber-500/14 text-amber-100 border-amber-400/20", "text-amber-300"],
                        ["QUEDA", "Categoria iluminação caiu 64%", "bg-rose-500/14 text-rose-100 border-rose-400/20", "text-rose-300"],
                        ["QUEDA", "Categoria produtos básicos caiu 40%", "bg-rose-500/14 text-rose-100 border-rose-400/20", "text-rose-300"],
                        ["SUCESSO", "Categoria pisos e revestimentos cresceu 26%", "bg-emerald-500/16 text-emerald-200 border-emerald-400/20", "text-emerald-300"],
                      ].map(([tag, text, classes, badgeText]) => (
                        <div key={text} className={`rounded-[20px] border p-4 ${classes}`}>
                          <div className="mb-3 flex items-center gap-2">
                            <span className={`rounded-full border border-current/20 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] ${badgeText}`}>
                              {tag}
                            </span>
                          </div>
                          <p className="text-sm font-semibold leading-6 text-white">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,33,0.94),rgba(8,13,24,0.94))] p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Status da Equipe</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Equipe</p>
                        <p className="text-xl font-black text-emerald-100">20</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        ["Acima da meta", "4", "20%", "bg-emerald-400"],
                        ["Na media", "12", "60%", "bg-amber-400"],
                        ["Precisa de atencao", "2", "10%", "bg-rose-400"],
                      ].map(([label, total, share, color]) => (
                        <div key={label} className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                              <p className="text-sm font-semibold text-white">{label}</p>
                            </div>
                            <p className="text-2xl font-black text-white">{total}</p>
                          </div>
                          <div className="mt-4 h-2 rounded-full bg-white/8">
                            <div className={`h-full rounded-full ${color}`} style={{ width: share }} />
                          </div>
                          <div className="mt-2 flex justify-between text-xs text-slate-400">
                            <span>Distribuicao</span>
                            <span>{share}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="showcase" className="mt-24 grid gap-5">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Módulos da Plataforma</p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Funcionalidades pensadas para transformar dados em resultado.</h2>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),linear-gradient(180deg,rgba(10,17,31,0.98),rgba(7,10,20,0.98))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.28)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Analise RFV</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Entenda sua carteira e descubra onde esta o proximo crescimento</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Visualize clientes campeoes, fieis, em risco e perdidos para priorizar reativacao, fidelizacao e aumento de ticket.</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/14 text-cyan-100">
                  <PackageSearch className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="space-y-3">
                    {[
                      ["Campeoes", "142", "receita recorrente alta", "from-emerald-400 to-lime-300", "71%"],
                      ["Fieis", "218", "boa frequencia de compra", "from-cyan-400 to-sky-300", "89%"],
                      ["Em risco", "67", "queda de recorrencia", "from-amber-300 to-orange-400", "43%"],
                      ["Perdidos", "31", "reativacao recomendada", "from-rose-400 to-red-400", "28%"],
                    ].map(([label, total, desc, gradient, width]) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{label}</p>
                            <p className="text-xs text-slate-400">{desc}</p>
                          </div>
                          <p className="text-2xl font-black text-white">{total}</p>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-white/8">
                          <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.75),rgba(8,13,23,0.9))] p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/16 text-emerald-100">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Acoes sugeridas</p>
                      <p className="text-xs text-slate-400">de leitura para execucao</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["Campeoes", "Criar abordagem de upsell premium e aumento de mix."],
                      ["Fieis", "Ativar campanhas de recorrencia e antecipar recompra."],
                      ["Em risco", "Gerar contato prioritario com argumento de recuperacao."],
                      ["Perdidos", "Montar ofensiva de reativacao com historico da carteira."],
                    ].map(([title, text]) => (
                      <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4">
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_24%),linear-gradient(180deg,rgba(22,14,8,0.96),rgba(13,10,14,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Orcamentos em aberto</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Feche o que ja esta quente antes de correr atras do zero</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">O sistema destaca orcamentos sem retorno, proximos de perder timing comercial ou prontos para fechamento.</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/14 text-amber-100">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ["ORC-1042", "Construtora Horizonte", "R$ 48.900", "Sem retorno ha 5 dias", "Alta prioridade"],
                  ["ORC-1056", "Farmacia Central", "R$ 18.700", "Aguardando fechamento", "Cliente Campeão"],
                  ["ORC-1068", "Mercado Vanguarda", "R$ 31.240", "Ultima interacao ontem", "Em negociacao"],
                  ["ORC-1079", "Clinica Vital", "R$ 12.980", "Precisa de follow-up", "Cliente esfriando"],
                ].map(([code, client, amount, status, tag]) => (
                  <div key={code} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">{code}</p>
                        <h4 className="mt-1 text-lg font-bold text-white">{client}</h4>
                        <p className="mt-1 text-sm text-slate-300">{status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-white">{amount}</p>
                        <span className="mt-2 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">{tag}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.94fr_1.06fr]">


          <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,rgba(9,14,24,0.96),rgba(7,11,21,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)] xl:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Competicao entre vendedores</p>
                <h3 className="mt-2 text-2xl font-black text-white">Um ranking que incentiva, compara e melhora a entrega do time</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Transforme a operacao em um ambiente mais energizado com visao de colocacao, evolucao e distancia para meta.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/16 text-emerald-100">
                <LineChart className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,16,24,0.92),rgba(8,12,20,0.96))] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">Grand Prix de Vendas</span>
                    <p className="mt-1 text-xs text-slate-400">podio dos campeoes e trilha da disputa</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    <BarChart3 className="h-3.5 w-3.5" />
                    visao da disputa
                  </span>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
                  <div className="mb-4 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      <Trophy className="h-3.5 w-3.5" />
                      Grid principal
                    </div>
                  </div>

                  <div className="flex items-end justify-center gap-3">
                    {[
                      ["2o", "Heloisa Braga", "R$ 51.120", "84%", "from-orange-500 to-orange-700", "border-orange-500/40", "h-16"],
                      ["1o", "Marina Diniz", "R$ 62.400", "96%", "from-amber-400 to-amber-600", "border-amber-400/50", "h-28"],
                      ["3o", "Lucas Prado", "R$ 58.900", "91%", "from-slate-400 to-slate-500", "border-slate-400/40", "h-20"],
                    ].map(([position, name, sales, progress, gradient, border, standHeight], index) => (
                      <div key={name} className="flex flex-1 flex-col items-center">
                        <div className={`relative mb-3 w-full overflow-hidden rounded-[22px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-xl ${border} ${index === 1 ? "shadow-amber-400/20" : "shadow-black/20"}`}>
                          {index === 1 ? (
                            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                              <div className="absolute left-[-100%] top-0 h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
                            </div>
                          ) : null}
                          <div className="relative flex items-center gap-3">
                            <div className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-sm font-bold text-white`}>
                              {index === 1 ? <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-amber-300" /> : null}
                              {position}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">{name}</p>
                              <p className="text-sm font-semibold text-emerald-300">{sales}</p>
                              <p className="text-xs text-slate-400">{progress} da meta</p>
                            </div>
                          </div>
                        </div>
                        <div className={`flex w-14 items-center justify-center rounded-t-xl bg-gradient-to-b ${gradient} ${standHeight} text-lg font-black text-white shadow-lg sm:w-16`}>
                          {position}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Pelotao de perseguicao</span>
                    <span className="text-xs text-slate-400">quem esta encostando no podio</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["4o", "Caio Matos", "79%", "R$ 47.860", "A 5 pontos do podio"],
                      ["5o", "Joao Pedro", "76%", "R$ 44.210", "A 8 pontos do podio"],
                      ["6o", "Ana Ribeiro", "72%", "R$ 41.980", "Em aceleracao"],
                    ].map(([position, name, progress, sales, status]) => (
                      <div key={name} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-black text-white">
                            {position}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">{name}</p>
                              <p className="text-sm font-semibold text-emerald-300">{sales}</p>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/8">
                              <div className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a,#67e8f9)]" style={{ width: progress }} />
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-slate-400">
                              <span>{status}</span>
                              <span>{progress}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Impacto por perfil</p>
                  <span className="text-xs text-slate-400">quem usa, como sente o ganho</span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ["Executivo", "Visao de crescimento", "R$ 269K", "faturado no ciclo"],
                    ["Gestor", "Equipe em movimento", "5", "vendedores acima da meta"],
                    ["Vendedor", "Prioridade do dia", "12", "oportunidades quentes"],
                  ].map(([eyebrow, title, metric, label]) => (
                    <div key={title} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">{eyebrow}</p>
                      <h4 className="mt-2 text-lg font-bold text-white">{title}</h4>
                      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                        <p className="text-2xl font-black text-white">{metric}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-200/80">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section id="funcionalidades" className="mt-24">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-emerald-200/80">Funcionalidades</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Ferramentas pensadas para vender mais e liderar melhor</h2>
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 lg:block">Interface moderna, comercial e orientada a conversao</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map(([title, description, Icon, accent]) => (
              <article key={title} className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.98),rgba(6,9,16,0.98))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/20">
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${accent}`} />
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-emerald-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="beneficios" className="mt-24 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,31,0.94),rgba(7,11,21,0.96))] p-8 shadow-[0_24px_80px_rgba(2,6,23,0.34)]">
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200/80">Beneficios</p>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Mais venda, mais foco do time e mais previsibilidade comercial.</h2>
            <p className="mt-4 text-base leading-7 text-slate-300">A proposta do SIP nao e apenas mostrar numeros. E transformar dados comerciais em prioridade, acao e melhora de performance para a equipe inteira.</p>

            <div className="mt-8 space-y-3">
              {benefits.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-white/92">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["Prioridades comerciais visiveis", "Sua equipe descobre onde concentrar esforco para vender mais sem depender de planilhas dispersas.", Radar],
              ["Resposta mais rapida da lideranca", "Gestores identificam desvios, clientes em risco e orcamentos parados antes que o resultado piore.", TimerReset],
              ["Visao integrada do comercial", "A experiencia conecta estrategia, gestao e execucao individual em um fluxo unico.", Users],
              ["Adocao e uso diario maiores", "Um produto bonito, claro e util aumenta a aderencia do time e melhora a disciplina comercial.", Zap],
            ] as const).map(([title, text, Icon]) => (
              <article key={title} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-24 rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_24%),linear-gradient(180deg,rgba(8,13,22,0.96),rgba(6,10,18,0.98))] p-8 shadow-[0_26px_80px_rgba(0,0,0,0.34)]">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.28em] text-emerald-200/80">Como funciona</p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Um fluxo simples para transformar dados em vendas</h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {steps.map(([label, text]) => (
              <article key={label} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
                <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">{label}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-24">
          <div className="overflow-hidden rounded-[34px] border border-emerald-400/16 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_24%),linear-gradient(135deg,rgba(7,16,13,0.98),rgba(8,15,27,0.94),rgba(8,17,14,0.94))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.32)] sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.28em] text-emerald-100/80">Pronto para explorar</p>
                <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Uma plataforma feita para ajudar sua empresa a vender melhor, gerir melhor e crescer com mais controle.</h2>
                <p className="mt-4 text-base leading-7 text-slate-200/85">Esta landing foi desenhada para mostrar valor comercial de verdade: mais performance do time, mais visibilidade da carteira e mais capacidade de transformar oportunidade em faturamento.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="inline-flex items-center justify-center gap-3 rounded-2xl border border-emerald-400/30 bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-7 py-4 text-base font-semibold text-white shadow-[0_16px_40px_rgba(34,197,94,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-110">
                  Acessar plataforma
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/" className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-7 py-4 text-base font-semibold text-white/92 transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]">
                  Ver home principal
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
