import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Clock3, Eye, MessageCircleReply, MousePointerClick, Send } from "lucide-react"
import {
  ActivationCampaignDashboard,
  ActivationCampaignDashboardClient,
  ActivationClient,
} from "@/lib/activation-types"
import {
  formatActivationCurrency,
  formatActivationDate,
} from "@/lib/activation-service"

function statusBadgeClass(status: string) {
  const normalized = String(status ?? "").toUpperCase()

  if (normalized === "RESPONDIDO") return "border-sky-400/25 bg-sky-500/12 text-sky-100"
  if (normalized === "LIDO") return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
  if (normalized === "ENTREGUE") return "border-cyan-400/25 bg-cyan-500/12 text-cyan-100"
  if (normalized === "ENVIADO") return "border-lime-400/25 bg-lime-500/12 text-lime-100"
  if (normalized === "FALHA") return "border-rose-400/25 bg-rose-500/12 text-rose-100"
  return "border-white/10 bg-white/[0.05] text-white/75"
}

function DashboardKpi({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string
  helper?: string
  icon: typeof Send
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-white">{value}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f1725] p-3 text-white/72">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {helper ? <p className="mt-3 text-xs text-white/52">{helper}</p> : null}
    </div>
  )
}

function FunnelStage({
  label,
  value,
  maxValue,
}: {
  label: string
  value: number
  maxValue: number
}) {
  const width = maxValue > 0 ? `${Math.max((value / maxValue) * 100, value > 0 ? 10 : 0)}%` : "0%"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-white/72">
        <span>{label}</span>
        <span className="font-semibold text-white">{value.toLocaleString("pt-BR")}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#67e8f9)] transition-all duration-500"
          style={{ width }}
        />
      </div>
    </div>
  )
}

function renderClientStatus(
  dashboardClient: ActivationCampaignDashboardClient | undefined,
  fallbackClient: ActivationClient
) {
  return (
    <>
      <span
        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusBadgeClass(dashboardClient?.status_envio ?? "PENDENTE")}`}
      >
        {dashboardClient?.status_envio ?? "PENDENTE"}
      </span>
      <p className="mt-1 text-xs text-white/50">
        Cliques: {(dashboardClient?.total_cliques ?? fallbackClient.total_cliques ?? 0).toLocaleString("pt-BR")}
        {dashboardClient?.converteu || fallbackClient.converteu
          ? ` • Conversao ${formatActivationCurrency(
              dashboardClient?.valor_conversao ?? fallbackClient.valor_conversao ?? 0
            )}`
          : ""}
      </p>
      {dashboardClient?.erro_envio ? <p className="mt-2 text-xs text-rose-200">{dashboardClient.erro_envio}</p> : null}
    </>
  )
}

export function SendStep({
  segmentLabel,
  selectedCount,
  message,
  clients,
  dashboard,
  sendStatus,
  warning,
  onBack,
  onOpenAll,
  onConfirm,
  onTestLink,
  isBusy,
  isDashboardLoading,
  lastCampaignId,
}: {
  segmentLabel: string
  selectedCount: number
  message: string
  clients: ActivationClient[]
  dashboard: ActivationCampaignDashboard | null
  sendStatus: string | null
  warning: string | null
  onBack: () => void
  onOpenAll: () => void
  onConfirm: () => void
  onTestLink: (link: string) => void
  isBusy: boolean
  isDashboardLoading: boolean
  lastCampaignId: number | string | null
}) {
  const [isListOpen, setIsListOpen] = useState(clients.length <= 50)

  useEffect(() => {
    setIsListOpen(clients.length <= 50)
  }, [clients.length])

  const dashboardClientsMap = useMemo(
    () => new Map((dashboard?.clientes ?? []).map((client) => [String(client.id), client])),
    [dashboard]
  )

  const funnelMax = Math.max(...(dashboard?.funil ?? []).map((item) => item.value), 1)

  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,31,0.96),rgba(8,11,20,0.92))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">4. Enviar</p>
          <h2 className="text-3xl font-black tracking-tight text-white">Confirme a campanha</h2>
          <p className="text-sm text-white/60">
            Ao confirmar, o SIP cria os links individuais, inicia a fila automatica na Z-API e atualiza o funil da campanha em tempo real.
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
            Abrir links de teste
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

      {warning ? (
        <div className="mt-6 rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-semibold">Atenção com o volume desta campanha</p>
              <p className="mt-1 text-amber-50/80">{warning}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Resumo</p>
            <div className="mt-4 space-y-3 text-sm text-white/72">
              <p><span className="text-white">Segmento:</span> {segmentLabel}</p>
              <p><span className="text-white">Clientes selecionados:</span> {selectedCount}</p>
              <p><span className="text-white">Caracteres da mensagem:</span> {message.length}</p>
              <p><span className="text-white">Campanha:</span> {lastCampaignId ? `#${lastCampaignId}` : "Ainda não confirmada"}</p>
              <p><span className="text-white">Fila atual:</span> {sendStatus ?? "Aguardando confirmação"}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Mensagem final</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/74">{message}</p>
          </div>

          <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/8 p-5 text-sm text-cyan-50">
            Cada mensagem sai com atraso aleatorio entre 3 e 8 segundos. A cada 50 disparos o sistema pausa por 2 minutos para reduzir risco operacional.
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-[#08101b] p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">Dashboard da campanha</p>
                <p className="mt-1 text-sm text-white/60">
                  {isDashboardLoading && !dashboard
                    ? "Carregando os primeiros indicadores..."
                    : "O painel atualiza automaticamente enquanto a fila da Z-API processa os envios."}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                <Clock3 className="h-4 w-4" />
                {dashboard?.campanha.pendentes ?? selectedCount} pendentes
              </div>
            </div>

            {dashboard ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DashboardKpi
                    label="Enviados"
                    value={dashboard.kpis.enviados.toLocaleString("pt-BR")}
                    helper="Mensagens aceitas pela Z-API"
                    icon={Send}
                  />
                  <DashboardKpi
                    label="Lidos"
                    value={dashboard.kpis.lidos.toLocaleString("pt-BR")}
                    helper="Clientes que abriram a mensagem"
                    icon={Eye}
                  />
                  <DashboardKpi
                    label="Responderam"
                    value={dashboard.kpis.responderam.toLocaleString("pt-BR")}
                    helper="Retornos recebidos pelo webhook"
                    icon={MessageCircleReply}
                    />
                  <DashboardKpi
                    label="Clicaram"
                    value={dashboard.kpis.abriram_link.toLocaleString("pt-BR")}
                    helper={`${dashboard.kpis.total_cliques.toLocaleString("pt-BR")} acessos totais`}
                    icon={MousePointerClick}
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Negociacao</p>
                    <p className="mt-3 text-2xl font-black tracking-tight text-white">
                      {dashboard.kpis.iniciaram_negociacao.toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-2 text-xs text-white/52">
                      {dashboard.kpis.solicitaram_orcamento.toLocaleString("pt-BR")} solicitaram orçamento.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Receita gerada</p>
                    <p className="mt-3 text-2xl font-black tracking-tight text-white">
                      {formatActivationCurrency(dashboard.kpis.receita_gerada)}
                    </p>
                    <p className="mt-2 text-xs text-white/52">
                      {dashboard.kpis.converteram.toLocaleString("pt-BR")} clientes converteram em venda.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Funil visual</p>
                  <div className="mt-4 space-y-4">
                    {dashboard.funil.map((stage) => (
                      <FunnelStage key={stage.id} label={stage.label} value={stage.value} maxValue={funnelMax} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-white/12 bg-white/[0.02] p-6 text-sm text-white/58">
                Confirme a campanha para iniciar o dashboard operacional.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#08101b] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">Clientes da fila</p>
                <p className="mt-1 text-sm text-white/60">
                  {clients.length} clientes prontos para revisão manual e acompanhamento do status.
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
                {clients.map((client) => {
                  const dashboardClient = dashboardClientsMap.get(String(client.campanha_cliente_id ?? client.id))

                  return (
                    <div
                      key={client.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{client.nome_cliente ?? "-"}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {client.telefone ?? "Sem telefone"} • Última compra {formatActivationDate(client.ultima_compra)}
                        </p>
                        <div className="mt-3">{renderClientStatus(dashboardClient, client)}</div>
                      </div>
                      <div className="flex flex-col items-stretch gap-2 md:w-[180px]">
                        <button
                          type="button"
                          onClick={() => client.whatsapp_link && onTestLink(client.whatsapp_link)}
                          disabled={!client.whatsapp_link}
                          className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Testar mensagem
                        </button>
                        {dashboardClient?.link_url || client.link_url ? (
                          <p className="truncate text-[11px] text-white/42">{dashboardClient?.link_url ?? client.link_url}</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
