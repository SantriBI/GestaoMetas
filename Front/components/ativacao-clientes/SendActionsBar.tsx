export function SendActionsBar({
  selectedCount,
  isBusy,
  lastCampaignId,
  lastSendStatus,
  onSave,
  onSend,
}: {
  selectedCount: number
  isBusy: boolean
  lastCampaignId: number | string | null
  lastSendStatus: string | null
  onSave: () => void
  onSend: () => void
}) {
  return (
    <section className="sticky bottom-4 z-20 rounded-[28px] border border-emerald-400/15 bg-[radial-gradient(circle_at_left,rgba(34,197,94,0.16),transparent_20%),radial-gradient(circle_at_right,rgba(11,59,46,0.22),transparent_24%),linear-gradient(90deg,rgba(4,8,16,0.96),rgba(8,18,31,0.96),rgba(7,13,23,0.96))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/64">Campanha pronta</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {selectedCount} cliente{selectedCount === 1 ? "" : "s"} selecionado{selectedCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-sm text-white/58">
            {lastCampaignId
              ? `Rascunho #${lastCampaignId} salvo.`
              : "VocÃª pode guardar o rascunho ou seguir para os envios agora."}
            {lastSendStatus ? ` Ãšltima aÃ§Ã£o: ${lastSendStatus}.` : ""}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onSave}
            disabled={isBusy || selectedCount === 0}
            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar rascunho
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={isBusy || selectedCount === 0}
            className="rounded-full border border-emerald-400/25 bg-emerald-500/14 px-5 py-3 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? "Salvando..." : "Preparar envio"}
          </button>
        </div>
      </div>
    </section>
  )
}

