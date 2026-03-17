import { ActivationClient } from "@/lib/activation-types"
import { formatActivationCurrency, formatActivationDate } from "@/lib/activation-service"

export function ClientPreviewTable({
  clients,
  selectedIds,
  onToggle,
  onToggleAll,
  onRemove,
  search,
  onSearchChange,
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirChange,
}: {
  clients: ActivationClient[]
  selectedIds: string[]
  onToggle: (clientId: string) => void
  onToggleAll: (checked: boolean) => void
  onRemove: (clientId: string) => void
  search: string
  onSearchChange: (value: string) => void
  sortBy: string
  sortDir: "asc" | "desc"
  onSortByChange: (value: string) => void
  onSortDirChange: (value: "asc" | "desc") => void
}) {
  const allSelected = clients.length > 0 && selectedIds.length === clients.length

  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_22%),linear-gradient(180deg,rgba(10,16,28,0.96),rgba(7,10,18,0.92))] p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">3. Preview</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Lista de clientes da campanha</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar cliente"
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />
          <select
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="valor_potencial">Maior valor</option>
            <option value="valor_orcamento">Valor orçamento</option>
            <option value="ultima_compra">Última compra</option>
            <option value="cliente">Cliente</option>
          </select>
          <select
            value={sortDir}
            onChange={(event) => onSortDirChange(event.target.value as "asc" | "desc")}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-white/48">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => onToggleAll(event.target.checked)}
                  />
                </th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Telefone</th>
                <th className="px-4 py-4">Classificação</th>
                <th className="px-4 py-4">Última compra</th>
                <th className="px-4 py-4">Valor</th>
                <th className="px-4 py-4">Preview da mensagem</th>
                <th className="px-4 py-4">Ação</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const isSelected = selectedIds.includes(client.id)
                return (
                  <tr
                    key={client.id}
                    className={`border-t border-white/8 align-top transition-colors ${
                      isSelected ? "bg-cyan-400/[0.06]" : "bg-transparent"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(client.id)}
                      />
                    </td>
                    <td className="px-4 py-4 text-white">
                      <p className="font-semibold">{client.nome_cliente ?? "-"}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {client.origem === "orcamento"
                          ? "Cliente com orçamento recente"
                          : "Cliente do relacionamento"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-white/72">{client.telefone ?? "Sem telefone"}</td>
                    <td className="px-4 py-4 text-white/72">{client.classificacao_rfv ?? "-"}</td>
                    <td className="px-4 py-4 text-white/72">{formatActivationDate(client.ultima_compra)}</td>
                    <td className="px-4 py-4 text-white/72">
                      {formatActivationCurrency((client.valor_potencial ?? 0) + (client.valor_orcamento ?? 0))}
                    </td>
                    <td className="max-w-[320px] px-4 py-4 text-white/62">
                      <p className="line-clamp-3 whitespace-pre-wrap">{client.mensagem_final}</p>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onRemove(client.id)}
                        className="rounded-full border border-red-400/20 bg-red-400/8 px-3 py-1 text-xs font-semibold text-red-200"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
