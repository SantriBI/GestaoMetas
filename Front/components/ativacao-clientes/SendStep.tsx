import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ActivationClient } from "@/lib/activation-types"
import { formatActivationDate } from "@/lib/activation-service"

export function SendStep({
  segmentLabel,
  selectedCount,
  message,
  clients,
  onBack,
  onOpenAll,
  onConfirm,
  onTestLink,
  isBusy,
  lastCampaignId,
}: {
  segmentLabel: string
  selectedCount: number
  message: string
  clients: ActivationClient[]
  onBack: () => void
  onOpenAll: () => void
  onConfirm: () => void
  onTestLink: (link: string) => void
  isBusy: boolean
  lastCampaignId: number | string | null
}) {
  const [isListOpen, setIsListOpen] = useState(clients.length <= 50)

  useEffect(() => {
    setIsListOpen(clients.length <= 50)
  }, [clients.length])

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">4. Enviar</p>
          <h2 className="text-3xl font-black tracking-tight text-white">Confirme a campanha</h2>
          <p className="text-sm text-white/60">
            Revise o resumo final e gere os links de contato pelo WhatsApp.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onOpenAll}
            disabled={clients.length === 0}
            className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Abrir todos os links
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy || clients.length === 0}
            className="rounded-full border border-emerald-400/25 bg-emerald-500/14 px-6 py-3 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? "Confirmando..." : "Confirmar campanha"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Resumo</p>
            <div className="mt-4 space-y-3 text-sm text-white/72">
              <p><span className="text-white">Segmento:</span> {segmentLabel}</p>
              <p><span className="text-white">Clientes selecionados:</span> {selectedCount}</p>
              <p><span className="text-white">Caracteres da mensagem:</span> {message.length}</p>
              <p><span className="text-white">Campanha:</span> {lastCampaignId ? `#${lastCampaignId}` : "Ainda nÃ£o confirmada"}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-amber-400/15 bg-amber-400/8 p-5 text-sm text-amber-50">
            MÃ©todo de envio atual: os links do WhatsApp serÃ£o abertos manualmente em nova aba.
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Mensagem final</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/74">{message}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#08101b] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Links para teste</p>
              <p className="mt-1 text-sm text-white/60">
                {clients.length} clientes prontos. Abra a lista sÃ³ quando precisar revisar.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsListOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/16"
            >
              {isListOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {isListOpen ? "Fechar lista" : "Abrir lista"}
            </button>
          </div>

          {isListOpen ? (
            <div className="mt-5 max-h-[560px] space-y-3 overflow-auto">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{client.nome_cliente ?? "-"}</p>
                    <p className="mt-1 text-sm text-white/60">
                      {client.telefone ?? "Sem telefone"} â€¢ Ãšltima compra {formatActivationDate(client.ultima_compra)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => client.whatsapp_link && onTestLink(client.whatsapp_link)}
                    disabled={!client.whatsapp_link}
                    className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Testar
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

