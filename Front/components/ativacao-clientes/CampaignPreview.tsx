export function CampaignPreview({
  selectedCount,
  totalCount,
  phoneReadyCount,
}: {
  selectedCount: number
  totalCount: number
  phoneReadyCount: number
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_24%),linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-white/42">4. Visão geral</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Como a campanha está ficando</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">Selecionados</p>
          <p className="mt-2 text-3xl font-black text-white">{selectedCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">No público escolhido</p>
          <p className="mt-2 text-3xl font-black text-white">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">Prontos para WhatsApp</p>
          <p className="mt-2 text-3xl font-black text-white">{phoneReadyCount}</p>
        </div>
      </div>
    </section>
  )
}
