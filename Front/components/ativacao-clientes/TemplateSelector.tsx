import { MessageTemplate } from "@/lib/activation-types"

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
}: {
  templates: MessageTemplate[]
  selectedTemplateId: string
  onSelect: (templateId: string) => void
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.1),transparent_25%),linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">2. Base</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Escolha um ponto de partida</h2>
      </div>

      <div className="space-y-3">
        {templates.map((template) => {
          const templateId = String(template.id ?? "")
          const isSelected = templateId === selectedTemplateId

          return (
            <button
              key={`${template.origem}-${templateId}-${template.classificacao_rfv}`}
              type="button"
              onClick={() => onSelect(templateId)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
                isSelected
                  ? "border-emerald-400/30 bg-emerald-500/10 shadow-[0_18px_40px_rgba(34,197,94,0.12)]"
                  : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-emerald-400/20"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{template.nome_template ?? "Template"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                    {template.classificacao_rfv ?? "Geral"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    isSelected ? "bg-emerald-500/15 text-emerald-200" : "bg-white/[0.04] text-white/60"
                  }`}
                >
                  {isSelected ? "Ativo" : "Usar"}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

