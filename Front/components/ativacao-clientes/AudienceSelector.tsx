import { ActivationSegment } from "@/lib/activation-types"

export function AudienceSelector({
  segments,
  selectedSegment,
  onSelect,
}: {
  segments: ActivationSegment[]
  selectedSegment: string
  onSelect: (segmentId: string) => void
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.1),transparent_28%),linear-gradient(180deg,rgba(9,14,25,0.96),rgba(9,12,21,0.9))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.34)]">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">1. Público</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Quem você quer ativar agora?</h2>
        <p className="mt-2 text-sm text-white/62">
          Cada grupo já vem com um contexto comercial pensado para facilitar sua abordagem.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {segments.map((segment) => {
          const isSelected = segment.id === selectedSegment

          return (
            <button
              key={segment.id}
              type="button"
              onClick={() => onSelect(segment.id)}
              className={`rounded-[24px] border p-5 text-left transition-all duration-300 ${
                isSelected
                  ? "border-emerald-400/30 bg-emerald-400/10 shadow-[0_18px_45px_rgba(16,185,129,0.12)]"
                  : "border-white/10 bg-white/[0.03] hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-cyan-400/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {segment.audienceType === "orcamento" ? "Oportunidade quente" : "Relacionamento"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{segment.titulo}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    isSelected ? "bg-emerald-400/15 text-emerald-200" : "bg-white/[0.04] text-white/60"
                  }`}
                >
                  {isSelected ? "Selecionado" : "Escolher"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/62">{segment.descricao}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

