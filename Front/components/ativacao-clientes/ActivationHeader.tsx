import { BarChart3, MessageSquareShare, Send, UsersRound } from "lucide-react"

const STEPS = [
  { id: "audiencia", label: "Escolher pÃºblico", icon: UsersRound },
  { id: "mensagem", label: "Criar mensagem", icon: MessageSquareShare },
  { id: "preview", label: "Revisar", icon: BarChart3 },
  { id: "envio", label: "Enviar", icon: Send },
]

export function ActivationHeader({
  activeStep,
  selectedCount,
}: {
  activeStep: number
  selectedCount: number
}) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_32%),linear-gradient(135deg,rgba(10,14,25,0.98),rgba(12,22,35,0.92),rgba(17,24,39,0.92))] p-8 shadow-[0_28px_90px_rgba(2,6,23,0.38)]">
      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
            Central de AtivaÃ§Ã£o
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Reative clientes com campanhas mais vivas e comerciais
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/64">
            Escolha o pÃºblico certo, ajuste sua abordagem e saia com uma campanha pronta para
            contato pelo WhatsApp em poucos minutos.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-4 transition-transform duration-300 hover:-translate-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Ritmo da campanha</p>
            <p className="mt-2 text-sm font-medium text-cyan-50">
              Escolha, personalize e avance com rapidez.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-400/15 bg-violet-400/8 px-4 py-4 transition-transform duration-300 hover:-translate-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-violet-100/70">Clientes na mira</p>
            <p className="mt-2 text-sm font-medium text-violet-50">
              {selectedCount} selecionados no momento.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-400/8 px-4 py-4 transition-transform duration-300 hover:-translate-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Momento ideal</p>
            <p className="mt-2 text-sm font-medium text-amber-50">
              Aproveite a base para recuperar vendas agora.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isActive = index <= activeStep

          return (
            <div
              key={step.id}
              className={`rounded-2xl border px-4 py-4 transition-all duration-300 ${
                isActive
                  ? "border-emerald-400/25 bg-emerald-400/10 text-white shadow-[0_18px_40px_rgba(16,185,129,0.12)]"
                  : "border-white/8 bg-white/[0.03] text-white/52"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                    isActive
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.03] text-white/45"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Etapa {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold">{step.label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

