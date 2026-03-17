import { Check, Sparkles } from "lucide-react"

const STEPS = [
  {
    label: "Segmento",
    subtitle: "Escolha o segmento de clientes",
  },
  {
    label: "Mensagem",
    subtitle: "Defina a abordagem da campanha",
  },
  {
    label: "Preview",
    subtitle: "Revise os clientes selecionados",
  },
  {
    label: "Enviar",
    subtitle: "Dispare os links do WhatsApp",
  },
]

export function ActivationStepper({
  currentStep,
}: {
  currentStep: number
}) {
  const progressWidth = `${((currentStep + 1) / STEPS.length) * 100}%`

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#1f1f1f] bg-[radial-gradient(circle_at_top_left,rgba(22,163,74,0.22),transparent_26%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_24%),linear-gradient(180deg,#111111_0%,#0b0b0b_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] lg:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#22335a] bg-[#0d1526] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8fb4ff]">
            <Sparkles className="h-3.5 w-3.5" />
            Campanha de reativaÃ§Ã£o
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
            Ative clientes pelo WhatsApp com uma jornada simples e elegante
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#a1a1a1] md:text-base">
            Escolha um segmento, personalize a mensagem e revise tudo antes do envio. O fluxo foi desenhado para
            ser rÃ¡pido, claro e comercial.
          </p>
        </div>

        <div className="min-w-[220px] rounded-[24px] border border-[#232323] bg-black/20 p-4 backdrop-blur">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8fb4ff]">Progresso</p>
          <div className="mt-3 h-2 rounded-full bg-[#1b1b1b]">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[#0b3b2e] via-[#16a34a] to-[#4ade80] shadow-[0_0_18px_rgba(34,197,94,0.45)]"
              style={{ width: progressWidth }}
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            Etapa {currentStep + 1} de {STEPS.length}
          </p>
          <p className="mt-1 text-xs text-[#8a8a8a]">{STEPS[currentStep]?.subtitle}</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-[repeat(4,minmax(0,1fr))] md:gap-0">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep
          const isDone = index < currentStep
          const indicatorClass = isDone
            ? "border-[#22c55e] bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] text-white shadow-[0_0_20px_rgba(34,197,94,0.35)]"
            : isActive
              ? "border-[#22c55e] bg-[#0d1526] text-[#8fb4ff] shadow-[0_0_0_6px_rgba(34,197,94,0.12)]"
              : "border-[#3a3a3a] bg-[#181818] text-[#8a8a8a]"

          return (
            <div key={step.label} className="relative">
              <div className="flex items-start gap-3 md:flex-col md:items-center md:text-center">
                <div className="flex items-center md:w-full md:justify-center">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-200 ${indicatorClass}`}
                  >
                    {isDone ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
                  </div>

                  {index < STEPS.length - 1 ? (
                    <div className="ml-3 h-px flex-1 bg-gradient-to-r from-[#2f2f2f] to-[#252525] md:absolute md:left-[calc(50%+3rem)] md:right-[-50%] md:top-[1.55rem] md:ml-0" />
                  ) : null}
                </div>

                <div className="min-w-0 md:mt-4">
                  <p className={`text-sm font-semibold ${isActive || isDone ? "text-white" : "text-[#bababa]"}`}>
                    {step.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#7b7b7b]">{step.subtitle}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

