import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardList,
  MoonStar,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react"
import { ActivationSegment, ActivationSummary } from "@/lib/activation-types"

type SegmentVisual = {
  title: string
  description: string
  eyebrow: string
  icon: typeof Trophy
  accent: string
  accentSoft: string
  iconBg: string
  iconColor: string
  defaults: {
    total: number
    withPhone: number
    withoutPhone: number
  }
}

const SEGMENT_VISUALS: Record<string, SegmentVisual> = {
  campeoes: {
    title: "Campeões",
    description: "Clientes de alto valor que compram frequentemente",
    eyebrow: "Alta recorrência",
    icon: Trophy,
    accent: "#d4a63c",
    accentSoft: "rgba(212,166,60,0.14)",
    iconBg: "rgba(212,166,60,0.16)",
    iconColor: "#f4c95d",
    defaults: { total: 72, withPhone: 72, withoutPhone: 0 },
  },
  fieis: {
    title: "Clientes Fiéis",
    description: "Clientes leais com bom histórico de compras",
    eyebrow: "Relacionamento forte",
    icon: Users,
    accent: "#22c55e",
    accentSoft: "rgba(34,197,94,0.14)",
    iconBg: "rgba(34,197,94,0.16)",
    iconColor: "#4ade80",
    defaults: { total: 606, withPhone: 606, withoutPhone: 0 },
  },
  promissores: {
    title: "Promissores",
    description: "Novos clientes com potencial de crescimento",
    eyebrow: "Potencial em expansão",
    icon: TrendingUp,
    accent: "#f59e0b",
    accentSoft: "rgba(245,158,11,0.14)",
    iconBg: "rgba(245,158,11,0.16)",
    iconColor: "#fbbf24",
    defaults: { total: 573, withPhone: 573, withoutPhone: 0 },
  },
  em_risco: {
    title: "Em Risco",
    description: "Clientes que diminuíram a frequência de compras",
    eyebrow: "Recuperação urgente",
    icon: AlertTriangle,
    accent: "#f97316",
    accentSoft: "rgba(249,115,22,0.14)",
    iconBg: "rgba(249,115,22,0.16)",
    iconColor: "#fb923c",
    defaults: { total: 266, withPhone: 266, withoutPhone: 0 },
  },
  hibernando: {
    title: "Hibernando",
    description: "Clientes inativos há muito tempo",
    eyebrow: "Carteira adormecida",
    icon: MoonStar,
    accent: "#64748b",
    accentSoft: "rgba(100,116,139,0.16)",
    iconBg: "rgba(71,85,105,0.2)",
    iconColor: "#cbd5e1",
    defaults: { total: 0, withPhone: 0, withoutPhone: 0 },
  },
  orcamento: {
    title: "Orçamento em Aberto",
    description: "Clientes com orçamentos nos últimos 30 dias",
    eyebrow: "Janela comercial quente",
    icon: ClipboardList,
    accent: "#14b8a6",
    accentSoft: "rgba(20,184,166,0.14)",
    iconBg: "rgba(20,184,166,0.16)",
    iconColor: "#2dd4bf",
    defaults: { total: 0, withPhone: 0, withoutPhone: 0 },
  },
}

function resolveSegmentVisual(segment: ActivationSegment): SegmentVisual {
  return (
    SEGMENT_VISUALS[segment.id] ?? {
      title: segment.titulo,
      description: segment.descricao,
      eyebrow: segment.audienceType === "orcamento" ? "Oportunidade" : "Segmento estratégico",
      icon: Users,
      accent: "#22c55e",
      accentSoft: "rgba(34,197,94,0.16)",
      iconBg: "rgba(34,197,94,0.16)",
      iconColor: "#86efac",
      defaults: { total: 0, withPhone: 0, withoutPhone: 0 },
    }
  )
}

function statValue(value: number | undefined, fallback: number, isLoading: boolean) {
  if (typeof value === "number") return value
  return isLoading ? "..." : fallback
}

function formatStat(value: number | string) {
  return typeof value === "number" ? value.toLocaleString("pt-BR") : value
}

export function SegmentStep({
  segments,
  segmentSummaries,
  selectedSegment,
  onSelect,
  onContinue,
  onBack,
  isLoading,
}: {
  segments: ActivationSegment[]
  segmentSummaries: Record<string, ActivationSummary>
  selectedSegment: string
  onSelect: (segmentId: string) => void
  onContinue: () => void
  onBack: () => void
  isLoading: boolean
}) {
  const selectedVisual = segments.find((segment) => segment.id === selectedSegment)
  const selectedMeta = selectedVisual ? resolveSegmentVisual(selectedVisual) : null
  const selectedSummary = selectedSegment ? segmentSummaries[selectedSegment] : null

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-[#1d1d1d] bg-[linear-gradient(180deg,#0d0d0d_0%,#090909_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
      <div className="absolute -left-20 top-10 h-44 w-44 rounded-full bg-[#16a34a]/14 blur-3xl" />
      <div className="absolute right-10 top-0 h-52 w-52 rounded-full bg-[#22c55e]/10 blur-3xl" />

      <div className="relative border-b border-[#1d1d1d] px-6 py-7 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22335a] bg-[#0d1526] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8fb4ff]">
              <Sparkles className="h-3.5 w-3.5" />
              Etapa 1 de 4
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-[2.2rem]">
              Selecione o Segmento
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9d9d9d] md:text-base">
              Escolha o grupo de clientes que deseja ativar via WhatsApp. A recomendação visual ajuda a identificar
              mais rápido onde existe melhor oportunidade de resposta.
            </p>
          </div>

          <div className="rounded-[26px] border border-[#232323] bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(10,10,10,0.96))] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8fb4ff]">Segmento atual</p>
            <p className="mt-3 text-xl font-bold text-white">{selectedMeta?.title ?? "Escolha um público"}</p>
            <p className="mt-2 text-sm leading-6 text-[#919191]">
              {selectedMeta?.description ?? "Ao selecionar um card, mostramos um resumo rápido e liberamos o próximo passo."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[#222] bg-[#141414] p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#7f7f7f]">Total</p>
                <p className="mt-2 text-xl font-black text-white">
                  {typeof selectedSummary?.total_clientes === "number"
                    ? selectedSummary.total_clientes.toLocaleString("pt-BR")
                    : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#22335a] bg-[#0d1526] p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#8fb4ff]">Com Tel.</p>
                <p className="mt-2 text-xl font-black text-[#8fb4ff]">
                  {typeof selectedSummary?.total_com_telefone === "number"
                    ? selectedSummary.total_com_telefone.toLocaleString("pt-BR")
                    : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#3b2a10] bg-[#21180d] p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#f59e0b]">Sem Tel.</p>
                <p className="mt-2 text-xl font-black text-[#f59e0b]">
                  {typeof selectedSummary?.total_sem_telefone === "number"
                    ? selectedSummary.total_sem_telefone.toLocaleString("pt-BR")
                    : "--"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative px-6 py-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {segments.map((segment, index) => {
              const isSelected = segment.id === selectedSegment
              const summary = segmentSummaries[segment.id]
              const visual = resolveSegmentVisual(segment)
              const Icon = visual.icon

              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => onSelect(segment.id)}
                  className={`group relative overflow-hidden rounded-[26px] border p-5 text-left transition-all duration-300 animate-fade-in-up ${
                    isSelected
                      ? "scale-[1.01] border-[#22c55e] bg-[#161616] shadow-[0_22px_50px_rgba(34,197,94,0.18)]"
                      : "border-[#2a2a2a] bg-[#111111] hover:-translate-y-1 hover:border-[#3d3d3d] hover:bg-[#161616] hover:shadow-[0_16px_40px_rgba(0,0,0,0.24)]"
                  }`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: `linear-gradient(180deg, ${visual.accentSoft}, transparent)` }}
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/6 shadow-inner"
                      style={{ backgroundColor: visual.iconBg, color: visual.iconColor }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          backgroundColor: visual.accentSoft,
                          color: visual.iconColor,
                        }}
                      >
                        {visual.eyebrow}
                      </span>
                    <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                          isSelected
                            ? "border-[#22c55e] bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] text-white shadow-[0_0_16px_rgba(34,197,94,0.35)]"
                            : "border-[#5a5a5a] bg-transparent text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-5">
                    <h3 className="text-xl font-bold text-white">{visual.title}</h3>
                    <p className="mt-2 min-h-[3rem] text-sm leading-6 text-[#a3a3a3]">{visual.description}</p>
                  </div>

                  <div className="relative mt-6 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.82fr)] gap-2 border-t border-[#242424] pt-4 sm:gap-4">
                    <div className="min-w-0 rounded-2xl border border-[#222222] bg-[#181818] px-2 py-3 sm:px-3">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a5a5a5]">Total</p>
                      <p className="mt-2 text-xl font-black leading-none tabular-nums text-white sm:text-[1.8rem]">
                        {formatStat(statValue(summary?.total_clientes, visual.defaults.total, isLoading))}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-2xl bg-transparent px-1 py-3">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8fb4ff]">Com Tel.</p>
                      <p className="mt-2 text-xl font-black leading-none tabular-nums text-[#8fb4ff] sm:text-[1.8rem]">
                        {formatStat(statValue(summary?.total_com_telefone, visual.defaults.withPhone, isLoading))}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-2xl bg-transparent px-1 py-3">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">Sem Tel.</p>
                      <p className="mt-2 text-xl font-black leading-none tabular-nums text-[#f59e0b] sm:text-[1.8rem]">
                        {formatStat(statValue(summary?.total_sem_telefone, visual.defaults.withoutPhone, isLoading))}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-5 flex items-center justify-between border-t border-[#202020] pt-4">
                    <span className="text-xs font-medium text-[#8b8b8b]">
                      {isSelected ? "Selecionado para a campanha" : "Clique para escolher este grupo"}
                    </span>
                    <ArrowRight
                      className={`h-4 w-4 transition-transform ${
                        isSelected ? "translate-x-1 text-[#8fb4ff]" : "text-[#5f5f5f] group-hover:translate-x-1"
                      }`}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          <aside className="rounded-[28px] border border-[#232323] bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(10,10,10,0.98))] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8fb4ff]">Guia rápido</p>
            <h3 className="mt-3 text-xl font-bold text-white">Como escolher melhor</h3>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[#202020] bg-[#121212] p-4">
                <p className="text-sm font-semibold text-white">1. Priorize intenção</p>
                <p className="mt-2 text-sm leading-6 text-[#929292]">
                  Segmentos com histórico recente ou orçamento aberto tendem a responder mais rápido.
                </p>
              </div>
              <div className="rounded-2xl border border-[#202020] bg-[#121212] p-4">
                <p className="text-sm font-semibold text-white">2. Use volume com contexto</p>
                <p className="mt-2 text-sm leading-6 text-[#929292]">
                  Um grupo maior acelera o alcance, mas a mensagem precisa combinar com o momento do cliente.
                </p>
              </div>
              <div className="rounded-2xl border border-[#202020] bg-[#121212] p-4">
                <p className="text-sm font-semibold text-white">3. Avance com confiança</p>
                <p className="mt-2 text-sm leading-6 text-[#929292]">
                  No próximo passo você poderá personalizar a mensagem antes de revisar os contatos.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-[#22335a] bg-[linear-gradient(180deg,rgba(22,163,74,0.18),rgba(15,23,42,0.28))] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fb4ff]">Destaque</p>
              <p className="mt-2 text-base font-bold text-white">{selectedMeta?.title ?? "Escolha um segmento"}</p>
              <p className="mt-2 text-sm leading-6 text-[#d6e5ff]">
                {selectedMeta
                  ? `Esse público tem ${(selectedSummary?.total_com_telefone ?? 0).toLocaleString("pt-BR")} clientes prontos para contato via WhatsApp.`
                  : "Ao selecionar um segmento, mostramos aqui um resumo comercial rápido para orientar sua decisão."}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-3 border-t border-[#1d1d1d] bg-[#0c0c0c]/90 px-6 py-5 backdrop-blur lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[#2a2a2a] bg-transparent px-5 py-3 text-sm font-semibold text-[#d4d4d4] transition-colors hover:border-[#3a3a3a] hover:bg-[#141414]"
        >
          ← Voltar
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={!selectedSegment}
          className="rounded-full bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-6 py-3 text-sm font-bold text-white transition-all hover:translate-y-[-1px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </section>
  )
}

