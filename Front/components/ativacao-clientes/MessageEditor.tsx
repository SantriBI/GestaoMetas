import { ActivationClient } from "@/lib/activation-types"
import { replaceActivationVariables } from "@/lib/activation-service"

export function MessageEditor({
  message,
  onChange,
  sampleClient,
}: {
  message: string
  onChange: (value: string) => void
  sampleClient: ActivationClient | null
}) {
  const preview = sampleClient ? replaceActivationVariables(message, sampleClient) : message

  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_24%),linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">2. Mensagem</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Editor comercial</h2>
        <p className="mt-2 text-sm text-white/60">
          Ajuste o texto no seu tom. A prÃ©via ao lado mostra como a abordagem vai chegar para o cliente.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <label className="text-xs uppercase tracking-[0.16em] text-white/45">Mensagem</label>
          <textarea
            value={message}
            onChange={(event) => onChange(event.target.value)}
            className="mt-3 min-h-[240px] w-full rounded-[24px] border border-white/10 bg-[#09101b] px-4 py-4 text-sm leading-7 text-white outline-none transition-colors placeholder:text-white/28 focus:border-emerald-400/30"
            placeholder="Escreva a abordagem comercial da campanha."
          />
        </div>

        <div className="rounded-[24px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(8,13,24,0.96),rgba(5,12,21,0.94))] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/70">Como o cliente vai ler</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            {sampleClient?.nome_cliente ?? "Selecione um cliente"}
          </h3>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/74">
            {preview || "A mensagem aparecerÃ¡ aqui assim que vocÃª comeÃ§ar a editar."}
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Dica de conversÃ£o</p>
            <p className="mt-2 text-sm leading-6 text-white/66">
              Mensagens curtas, pessoais e com uma aÃ§Ã£o clara tendem a performar melhor no WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

