import { useRef } from "react"
import { ActivationClient, MessageTemplate } from "@/lib/activation-types"
import { replaceActivationVariables } from "@/lib/activation-service"

const VARIABLES = ["{nome_cliente}", "{valor_orcamento}", "{data_orcamento}", "{ultima_compra}"]

export function MessageStep({
  templates,
  selectedTemplateId,
  message,
  sampleClient,
  onTemplateSelect,
  onMessageChange,
  onBack,
  onContinue,
}: {
  templates: MessageTemplate[]
  selectedTemplateId: string
  message: string
  sampleClient: ActivationClient | null
  onTemplateSelect: (templateId: string) => void
  onMessageChange: (value: string) => void
  onBack: () => void
  onContinue: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const preview = sampleClient ? replaceActivationVariables(message, sampleClient) : message

  function insertVariable(token: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      onMessageChange(`${message}${token}`)
      return
    }

    const start = textarea.selectionStart ?? message.length
    const end = textarea.selectionEnd ?? message.length
    const nextMessage = `${message.slice(0, start)}${token}${message.slice(end)}`

    onMessageChange(nextMessage)

    requestAnimationFrame(() => {
      textarea.focus()
      const nextPosition = start + token.length
      textarea.setSelectionRange(nextPosition, nextPosition)
    })
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">2. Mensagem</p>
        <h2 className="text-3xl font-black tracking-tight text-white">Ajuste o texto da campanha</h2>
        <p className="text-sm text-white/60">
          Escolha uma base pronta, personalize a escrita e acompanhe como a mensagem aparece no WhatsApp.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-white/45">Template</label>
            <select
              value={selectedTemplateId}
              onChange={(event) => onTemplateSelect(event.target.value)}
              className="mt-3 w-full rounded-[20px] border border-white/10 bg-[#09101b] px-4 py-3 text-sm text-white outline-none"
            >
              {templates.map((template) => (
                <option key={String(template.id ?? "")} value={String(template.id ?? "")}>
                  {template.nome_template ?? "Template"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.16em] text-white/45">Mensagem</label>
              <span className="text-xs text-white/45">{message.length} caracteres</span>
            </div>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              className="mt-3 min-h-[260px] w-full rounded-[24px] border border-white/10 bg-[#09101b] px-4 py-4 text-sm leading-7 text-white outline-none transition-colors placeholder:text-white/28 focus:border-emerald-400/30"
              placeholder="Escreva a abordagem comercial da campanha."
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Variáveis rápidas</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {VARIABLES.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertVariable(token)}
                  className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/16"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_35%),linear-gradient(180deg,#0b111b,#08111c)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-100/70">Preview estilo WhatsApp</p>
          <div className="mt-5 rounded-[28px] border border-white/10 bg-[#0e1726] p-4 shadow-inner shadow-black/20">
            <div className="rounded-[24px] bg-[#111b21] p-4">
              <div className="rounded-[22px] rounded-tl-md bg-[linear-gradient(135deg,#16305f,#16a34a)] px-4 py-3 text-sm leading-7 text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                <p className="font-semibold text-emerald-50">{sampleClient?.nome_cliente ?? "João Silva"}</p>
                <p className="mt-3 whitespace-pre-wrap">
                  {preview || "A mensagem aparecerá aqui assim que você começar a escrever."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!message.trim()}
          className="rounded-full border border-emerald-400/25 bg-emerald-500/14 px-6 py-3 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </section>
  )
}

