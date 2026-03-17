"use client"

import { useRankingVendedores } from "@/hooks/useRankingVendedores"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Target,
  Trophy,
  ArrowRight,
  Sparkles,
  BarChart3,
  Zap,
  Shield,
  ChevronRight,
  TrendingUp,
  Radar,
  Activity,
  Cpu,
} from "lucide-react"
import Image from "next/image"

const WEEK_BARS = [42, 68, 49, 82, 58, 91, 76]
const SELLERS = [
  { name: "Miguel Arcanjo", progress: 95, color: "from-[#4ade80] to-[#22c55e]" },
  { name: "Heloísa Braga ", progress: 88, color: "from-[#94a3b8] to-[#475569]" },
  { name: "Lara Arcanjo", progress: 82, color: "from-[#86efac] to-[#16a34a]" },
]

export default function LandingPage() {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)

  const { data: ranking, loading, error } = useRankingVendedores()
  const topSeller = ranking?.[0]
  const topSellerName = "Marina Diniz"
  const topSellerProgress = topSeller?.percentual ?? 95
  const rankingCount = ranking?.length ?? 24

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070a] text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.88),transparent_30%),linear-gradient(180deg,#090b10_0%,#05060a_100%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(74,222,128,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,128,0.18)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(6,7,10,0.15)_45%,rgba(6,7,10,0.88)_100%)]" />
        <div className="absolute left-[8%] top-24 h-80 w-80 rounded-full bg-[#16a34a]/18 blur-3xl" />
        <div className="absolute right-[10%] top-32 h-96 w-96 rounded-full bg-[#4ade80]/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#166534]/20 blur-3xl" />
      </div>

      <header className="relative z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo%20sip%202.0.svg"
              alt="Logo SIP 2.0"
              width={34}
              height={34}
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight text-white">
              SIP <span className="font-normal text-white/68">- Gestão de Metas</span>
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#recursos" className="text-sm text-white/60 transition-colors hover:text-white">
              Recursos
            </a>
            <a href="#como-funciona" className="text-sm text-white/60 transition-colors hover:text-white">
              Como Funciona
            </a>
            <a href="#ranking" className="text-sm text-white/60 transition-colors hover:text-white">
              Ranking
            </a>
            <a href="#ajuda" className="text-sm text-white/60 transition-colors hover:text-white">
              Ajuda
            </a>
          </div>

          <button
            onClick={() => router.push("/login")}
            className="rounded-xl border border-[#166534] bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(34,197,94,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            Acessar Agora
          </button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#14532d] bg-[#0b1220]/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#bbf7d0] shadow-[0_0_0_1px_rgba(74,222,128,0.06)]">
                <Cpu className="h-3.5 w-3.5" />
                Plataforma de inteligência comercial
              </div>

              <h1 className="text-4xl font-black leading-[0.95] sm:text-5xl lg:text-7xl">
                <span className="block bg-[linear-gradient(135deg,#dcfce7_0%,#86efac_34%,#22c55e_68%,#bbf7d0_100%)] bg-clip-text text-transparent">
                  Transforme metas
                </span>
                <span className="block text-white">em conquistas</span>
              </h1>

              <p className="max-w-xl text-lg leading-relaxed text-[#94a3b8]">
                Gerencie a performance da sua equipe com dashboards precisos, rankings ao vivo e insights operacionais
                em uma interface moderna, rápida e pensada para decisão.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[#1d2a44] bg-[#0b111b]/90 px-4 py-2 text-sm text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Target className="h-4 w-4 text-[#4ade80]" />
                <span>Metas em Tempo Real</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#1d2a44] bg-[#0b111b]/90 px-4 py-2 text-sm text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Trophy className="h-4 w-4 text-[#86efac]" />
                <span>Ranking Dinâmico</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#1d2a44] bg-[#0b111b]/90 px-4 py-2 text-sm text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <BarChart3 className="h-4 w-4 text-[#86efac]" />
                <span>Insights Automáticos</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#1d2a44] bg-[#0b111b]/90 px-4 py-2 text-sm text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Shield className="h-4 w-4 text-[#86efac]" />
                <span>Dados Seguros</span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <button
                onClick={() => router.push("/login")}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group flex items-center gap-3 rounded-2xl border border-[#166534] bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-8 py-4 text-lg font-semibold text-white shadow-[0_16px_40px_rgba(34,197,94,0.3)] transition-all hover:-translate-y-0.5 hover:brightness-110"
              >
                Acessar Dashboard
                <ArrowRight className={`h-5 w-5 transition-transform ${isHovered ? "translate-x-1" : ""}`} />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex items-center -space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#06070a] bg-gradient-to-br from-[#4ade80] to-[#22c55e] text-[10px] font-bold text-white">
                    JP
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#06070a] bg-gradient-to-br from-[#818cf8] to-[#3730a3] text-[10px] font-bold text-white">
                    MS
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#06070a] bg-gradient-to-br from-[#86efac] to-[#16a34a] text-[10px] font-bold text-white">
                    AR
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#06070a] bg-[#131821] text-[10px] font-medium text-white/60">
                    +50
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-white">Utilizado por 50+ vendedores</p>
                  <p className="text-xs text-[#94a3b8]">Em toda a empresa</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative lg:pl-8">
            <div className="absolute inset-6 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.2),transparent_48%)] blur-2xl" />

            <div
              className="relative rounded-[28px] border border-[#1d2941] bg-[linear-gradient(180deg,rgba(12,16,24,0.98),rgba(8,10,16,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
              style={{ transform: "perspective(1000px) rotateY(-5deg) rotateX(2deg)" }}
            >
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#4ade80]/40 to-transparent" />

              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-[#ef4444]" />
                  <div className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                  <div className="h-3 w-3 rounded-full bg-[#22c55e]" />
                </div>
                <span className="text-xs text-[#7c8aa5]">Dashboard SIP</span>
              </div>

              <div className="mb-5 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#1c2537] bg-[#10151f] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <p className="mb-1 text-xs text-[#75839d]">Meta Mensal</p>
                  <p className="text-xl font-black text-white">R$ 150K</p>
                  <p className="mt-1 text-xs text-[#86efac]">+12% vs anterior</p>
                </div>
                <div className="rounded-2xl border border-[#1e315a] bg-[linear-gradient(180deg,rgba(13,22,38,0.98),rgba(10,17,28,0.98))] p-4 shadow-[0_0_24px_rgba(34,197,94,0.12)]">
                  <p className="mb-1 text-xs text-[#75839d]">Realizado</p>
                  <p className="text-xl font-black text-[#dcfce7]">R$ 127K</p>
                  <p className="mt-1 text-xs text-[#86efac]">85% da meta</p>
                </div>
                <div className="rounded-2xl border border-[#1c2537] bg-[#10151f] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <p className="mb-1 text-xs text-[#75839d]">Vendedores</p>
                  <p className="text-xl font-black text-white">{rankingCount}</p>
                  <p className="mt-1 text-xs text-[#86efac]">18 na meta</p>
                </div>
              </div>

              <div className="mb-6 rounded-[22px] border border-[#162237] bg-[linear-gradient(180deg,rgba(11,16,24,0.92),rgba(11,16,24,0.74))] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Performance Semanal</span>
                  <span className="flex items-center gap-1 text-xs text-[#86efac]">
                    <Sparkles className="h-3 w-3" />
                    Tendência positiva
                  </span>
                </div>
                <div className="flex h-16 items-end gap-2">
                  {WEEK_BARS.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-[linear-gradient(180deg,#4ade80_0%,#22c55e_55%,#0b3b2e_100%)] shadow-[0_0_12px_rgba(34,197,94,0.18)] transition-all hover:brightness-110"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((day) => (
                    <span key={day} className="text-[10px] text-[#71809b]">
                      {day}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Top Vendedores</span>
                  <button className="flex items-center gap-1 text-xs text-[#86efac] transition-colors hover:text-white">
                    Ver ranking <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {SELLERS.map((seller, i) => (
                    <div key={seller.name} className="flex items-center gap-3">
                      <span className="w-4 text-xs text-[#75839d]">{i + 1}.</span>
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${seller.color} text-[10px] font-bold text-white`}
                      >
                        {seller.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-white">{seller.name}</span>
                          <span className="text-xs font-semibold text-[#86efac]">{seller.progress}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#1c2433]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a_0%,#22c55e_55%,#86efac_100%)]"
                            style={{ width: `${seller.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -left-4 top-1/4 hidden animate-float lg:block">
              <div className="w-52 rounded-2xl border border-[#1d2b45] bg-[linear-gradient(180deg,rgba(13,18,28,0.98),rgba(10,12,18,0.98))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f1d38] text-[#86efac]">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-white">Análise</span>
                </div>
                <p className="mb-1 text-3xl font-black text-white">+23%</p>
                <p className="text-xs text-[#8a99b5]">Crescimento este mês</p>
              </div>
            </div>

            <div
              className="absolute -right-4 bottom-1/4 hidden animate-float lg:block"
              style={{ animationDelay: "1s" }}
            >
              <div className="w-56 rounded-2xl border border-[#1d2b45] bg-[linear-gradient(180deg,rgba(13,18,28,0.98),rgba(10,12,18,0.98))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] text-white">
                    <Zap className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-white">Insight</span>
                </div>
                <p className="text-xs leading-relaxed text-[#8a99b5]">
                  <span className="font-semibold text-[#dcfce7]">{topSellerName}</span> está a apenas 5% de bater a
                  meta mensal.
                </p>
              </div>
            </div>

            <div className="absolute right-14 top-8 hidden animate-float lg:block" style={{ animationDelay: "1.6s" }}>
              <div className="w-44 rounded-2xl border border-[#1d2b45] bg-[linear-gradient(180deg,rgba(13,18,28,0.94),rgba(10,12,18,0.98))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f1d38] text-[#86efac]">
                    <Radar className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-white">Radar</span>
                </div>
                <p className="text-xl font-black text-white">{topSellerProgress}%</p>
                <p className="mt-1 text-xs text-[#8a99b5]">Precisão da previsão comercial</p>
              </div>
            </div>
          </div>
        </div>

        <section id="recursos" className="mt-20 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-[#182235] bg-[linear-gradient(180deg,rgba(11,16,24,0.95),rgba(10,13,18,0.95))] p-5">
            <Activity className="h-5 w-5 text-[#4ade80]" />
            <h3 className="mt-4 text-lg font-bold text-white">Painel vivo</h3>
            <p className="mt-2 text-sm leading-6 text-[#8fa1be]">
              Indicadores atualizados e leitura rápida para acompanhar metas, ritmo e tendência.
            </p>
          </div>
          <div className="rounded-[24px] border border-[#182235] bg-[linear-gradient(180deg,rgba(11,16,24,0.95),rgba(10,13,18,0.95))] p-5">
            <TrendingUp className="h-5 w-5 text-[#86efac]" />
            <h3 className="mt-4 text-lg font-bold text-white">Performance previsível</h3>
            <p className="mt-2 text-sm leading-6 text-[#8fa1be]">
              Veja quem está acelerando, quem precisa de atenção e onde existe maior chance de resultado.
            </p>
          </div>
          <div className="rounded-[24px] border border-[#182235] bg-[linear-gradient(180deg,rgba(11,16,24,0.95),rgba(10,13,18,0.95))] p-5">
            <Sparkles className="h-5 w-5 text-[#86efac]" />
            <h3 className="mt-4 text-lg font-bold text-white">Interface executiva</h3>
            <p className="mt-2 text-sm leading-6 text-[#8fa1be]">
              Um visual mais tecnológico, escuro e elegante para transformar análise em ação com prazer de uso.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mt-12 border-t border-white/6">
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <Image
              src="/Logo%20Santri%20White.png"
              alt="Logo da Empresa"
              width={80}
              height={28}
              className="h-10 w-auto object-contain"
            />
          </div>

          <span className="max-w-[240px] text-center text-xs leading-5 tracking-[0.24em] text-[#7b8aa6] sm:max-w-none sm:text-sm md:absolute md:left-1/2 md:max-w-none md:-translate-x-1/2">
            SIP • SANTRI INTELIGÊNCIA & PERFORMANCE
          </span>

          <p className="text-center text-xs text-[#7b8aa6] md:text-right">2026 Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  )
}

