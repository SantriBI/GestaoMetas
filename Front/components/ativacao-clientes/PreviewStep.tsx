import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ActivationClient, ActivationSummary } from "@/lib/activation-types"
import { formatActivationCurrency, formatActivationDate } from "@/lib/activation-service"

export function PreviewStep({
  summary,
  clients,
  selectedIds,
  search,
  isLoading,
  onSearchChange,
  onToggle,
  onToggleAll,
  onRemove,
  onBack,
  onContinue,
}: {
  summary: ActivationSummary | null
  clients: ActivationClient[]
  selectedIds: string[]
  search: string
  isLoading: boolean
  onSearchChange: (value: string) => void
  onToggle: (clientId: string) => void
  onToggleAll: (checked: boolean) => void
  onRemove: (clientId: string) => void
  onBack: () => void
  onContinue: () => void
}) {
  const [isListOpen, setIsListOpen] = useState(clients.length <= 50)
  const selectableIds = clients.filter((client) => client.possui_telefone).map((client) => client.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))

  useEffect(() => {
    setIsListOpen(clients.length <= 50)
  }, [clients.length])

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">3. Preview</p>
          <h2 className="text-3xl font-black tracking-tight text-white">Revise quem vai entrar na campanha</h2>
          <p className="text-sm text-white/60">
            Ajuste a seleção final antes de gerar os links do WhatsApp.
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
            onClick={onContinue}
            disabled={selectedIds.length === 0 || isLoading}
            className="rounded-full border border-emerald-400/25 bg-emerald-500/14 px-6 py-3 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <PreviewCard label="Total de clientes" value={summary?.total_clientes ?? 0} />
        <PreviewCard label="Com telefone válido" value={summary?.total_com_telefone ?? 0} tone="blue" />
        <PreviewCard label="Sem telefone" value={summary?.total_sem_telefone ?? 0} tone="amber" />
        <PreviewCard label="Prontos para envio" value={selectedIds.length} tone="sky" />
      </div>

      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Lista de clientes</p>
            <p className="mt-1 text-sm text-white/58">
              {clients.length} clientes carregados. Em listas maiores, você pode abrir só quando precisar.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar cliente"
              className="w-full min-w-[220px] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
            />

            <label className="flex items-center gap-3 text-sm text-white/70">
              <input type="checkbox" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
              Selecionar todos válidos
            </label>

            <button
              type="button"
              onClick={() => setIsListOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/16"
            >
              {isListOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {isListOpen ? "Fechar lista" : "Abrir lista"}
            </button>
          </div>
        </div>
      </div>

      {isListOpen ? (
        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-[#101826] text-left text-white/48">
                <tr>
                  <th className="px-4 py-4">Selecionar</th>
                  <th className="px-4 py-4">Cliente</th>
                  <th className="px-4 py-4">Telefone</th>
                  <th className="px-4 py-4">Última compra</th>
                  <th className="px-4 py-4">Total compras</th>
                  <th className="px-4 py-4">Ação</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const disabled = !client.possui_telefone
                  const isSelected = selectedIds.includes(client.id)

                  return (
                    <tr
                      key={client.id}
                      className={`border-t border-white/8 align-top ${
                        disabled ? "opacity-45" : isSelected ? "bg-emerald-500/[0.06]" : "bg-transparent"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => onToggle(client.id)}
                        />
                      </td>
                      <td className="px-4 py-4 text-white">
                        <p className="font-semibold">{client.nome_cliente ?? "-"}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {disabled ? "Sem telefone válido" : "Pronto para contato"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-white/72">{client.telefone ?? "Sem telefone"}</td>
                      <td className="px-4 py-4 text-white/72">{formatActivationDate(client.ultima_compra)}</td>
                      <td className="px-4 py-4 text-white/72">
                        {formatActivationCurrency((client.valor_potencial ?? 0) + (client.valor_orcamento ?? 0))}
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
      ) : null}
    </section>
  )
}

function PreviewCard({
  label,
  value,
  tone = "white",
}: {
  label: string
  value: number
  tone?: "white" | "blue" | "amber" | "sky"
}) {
  const toneClass =
    tone === "blue"
      ? "border-emerald-400/15 bg-emerald-500/8 text-emerald-50"
      : tone === "amber"
        ? "border-amber-400/15 bg-amber-400/8 text-amber-50"
        : tone === "sky"
          ? "border-emerald-400/15 bg-emerald-400/8 text-emerald-50"
          : "border-white/10 bg-white/[0.03] text-white"

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-white/55">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}

