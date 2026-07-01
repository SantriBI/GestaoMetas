"use client"

import type { ReactNode } from "react"
import { Download, Receipt, TrendingUp, Wallet } from "lucide-react"
import { ChallengeStatusBadge } from "@/components/challenges/ChallengeStatusBadge"
import { Button } from "@/components/ui/button"
import {
  formatCurrencyBRL,
  formatDateBR,
  formatMetaProgressValue,
  formatMetaValue,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  getChallengeLifecycleStatus,
  getChallengeMetaFocusLabel,
  getMetaTypeLabel,
  getParticipantStatusLabel,
  isClosedChallengeStatus,
  isEndedChallengeStatus,
  type Challenge,
  type ChallengeMeta,
  type ChallengeParticipant,
} from "@/lib/challenges"

type ReportRow = {
  participant: ChallengeParticipant
  payout: number
  progress: number
  soldValueLabel: string
  metasConcluidas: number
  totalMetas: number
  summary: string
  metaLines: string[]
}

export function ChallengePayoutReport({
  challenge,
  compact = false,
}: {
  challenge: Challenge
  compact?: boolean
}) {
  const participants = Array.isArray(challenge.participants) ? challenge.participants : []
  if (!participants.length) return null

  const kind = getChallengeCampaignKind(challenge)
  const rows = participants
    .map((participant) => buildReportRow(challenge, participant))
    .sort(
      (left, right) =>
        right.payout - left.payout ||
        right.progress - left.progress ||
        left.participant.nomeVendedor?.localeCompare(right.participant.nomeVendedor ?? "", "pt-BR") ||
        0
    )

  const totalPayout = rows.reduce((sum, row) => sum + row.payout, 0)
  const rewardedCount = rows.filter((row) => row.payout > 0).length
  const maxPayout = rows.reduce((highest, row) => Math.max(highest, row.payout), 0)
  const reportTone = getReportTone(challenge)
  const reportFileName = buildReportFileName(challenge, kind)

  function handleExportCsv() {
    if (typeof window === "undefined") return

    const csv = buildReportCsv(challenge, kind, rows)
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = reportFileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 1000)
  }

  return (
    <section className={`rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.06),rgba(15,23,42,0.78))] shadow-[0_18px_60px_rgba(2,6,23,0.2)] ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">{reportTone.eyebrow}</p>
          <h3 className={`font-black tracking-tight text-white ${compact ? "mt-1 text-xl" : "mt-2 text-2xl"}`}>{reportTone.title}</h3>
          {!compact ? <p className="mt-3 text-sm leading-7 text-white/68">{reportTone.description}</p> : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Button
            type="button"
            onClick={handleExportCsv}
            className="h-11 rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] text-black hover:opacity-95"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${compact ? "mt-4" : "mt-5"}`}>
        <ReportMetric label="Total a pagar" value={formatCurrencyBRL(totalPayout)} icon={<Wallet className="h-4 w-4 text-emerald-200" />} />
        <ReportMetric label="Vendedores premiados" value={`${rewardedCount}/${rows.length}`} icon={<Receipt className="h-4 w-4 text-cyan-200" />} />
        <ReportMetric label="Maior pagamento" value={formatCurrencyBRL(maxPayout)} icon={<Wallet className="h-4 w-4 text-amber-200" />} />
        <ReportMetric
          label="Bônus restante"
          value={formatCurrencyBRL(challenge.impact.bonusRemainingPotential ?? 0)}
          icon={<TrendingUp className="h-4 w-4 text-sky-200" />}
        />
      </div>

      {compact ? (
        <div className={`overflow-hidden rounded-[26px] border border-white/10 bg-black/20 ${compact ? "mt-4" : "mt-5"}`}>
          <div className="hidden gap-4 border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(130px,0.85fr)_minmax(132px,0.8fr)_minmax(150px,0.9fr)]">
            <span>Vendedor</span>
            <span className="text-right">Progresso</span>
            <span className="text-right">Atingimento</span>
            <span className="text-right">Premiação</span>
          </div>

          <div className="divide-y divide-white/6">
            {rows.map((row) => (
              <div
                key={`${challenge.id}-${row.participant.skVendedor}-${row.participant.id ?? "report"}`}
                className="px-4 py-4 text-sm text-white/80"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(130px,0.85fr)_minmax(132px,0.8fr)_minmax(150px,0.9fr)] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{row.participant.nomeVendedor ?? `Vendedor ${row.participant.skVendedor}`}</p>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/45">
                      <span className="whitespace-nowrap">SK {row.participant.skVendedor}</span>
                      <span className="whitespace-nowrap">{getCompactParticipantStatus(challenge, row.participant)}</span>
                      <span className="whitespace-nowrap">{row.metasConcluidas}/{row.totalMetas} metas</span>
                    </div>
                  </div>

                  <CompactReportValue label="Progresso" value={row.soldValueLabel} align="right" />

                  <div className="min-w-0 md:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36 md:hidden">Atingimento</p>
                    <p className="whitespace-nowrap font-semibold text-white">{Math.round(row.progress)}%</p>
                    <div className="mt-2 h-2 rounded-full bg-white/10 md:ml-auto md:max-w-[124px]">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"
                        style={{ width: `${Math.min(Math.max(row.progress, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  <CompactReportValue
                    label="Premiação"
                    value={formatCurrencyBRL(row.payout)}
                    helper={row.payout > 0 ? "Liberado" : "Sem premio"}
                    align="right"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-[26px] border border-white/10 bg-black/20 ${compact ? "mt-4" : "mt-5"}`}>
          <div className="grid min-w-[1080px] grid-cols-[minmax(0,1.2fr)_minmax(160px,0.7fr)_minmax(120px,0.5fr)_minmax(150px,0.6fr)_minmax(170px,0.7fr)_minmax(0,1.7fr)] gap-4 border-b border-white/8 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            <span>Vendedor</span>
            <span>Situação</span>
            <span>Metas</span>
            <span>Atingimento</span>
            <span>Valor a pagar</span>
            <span>Resultado</span>
          </div>

          <div className="divide-y divide-white/6">
            {rows.map((row) => (
              <div
                key={`${challenge.id}-${row.participant.skVendedor}-${row.participant.id ?? "report"}`}
                className="grid min-w-[1080px] grid-cols-[minmax(0,1.2fr)_minmax(160px,0.7fr)_minmax(120px,0.5fr)_minmax(150px,0.6fr)_minmax(170px,0.7fr)_minmax(0,1.7fr)] gap-4 px-4 py-4 text-sm text-white/80"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{row.participant.nomeVendedor ?? `Vendedor ${row.participant.skVendedor}`}</p>
                  <p className="mt-1 text-xs text-white/45">SK {row.participant.skVendedor}</p>
                </div>

                <div className="flex items-start">
                  {challenge.exigeAceite ? (
                    <ChallengeStatusBadge status={row.participant.statusParticipacao} scope="participant" />
                  ) : (
                    <span className="inline-flex rounded-full border border-cyan-300/18 bg-cyan-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                      Participação automática
                    </span>
                  )}
                </div>

                <div>
                  <p className="font-semibold text-white">{row.metasConcluidas}/{row.totalMetas}</p>
                  <p className="mt-1 text-xs text-white/45">metas concluídas</p>
                </div>

                <div>
                  <p className="font-semibold text-white">{Math.round(row.progress)}%</p>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#34d399)]"
                      style={{ width: `${Math.min(Math.max(row.progress, 0), 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-white">{formatCurrencyBRL(row.payout)}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {row.payout > 0 ? "pronto para pagamento" : "sem valor liberado"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-white">{row.summary}</p>
                  <div className="mt-2 space-y-1 text-xs leading-5 text-white/58">
                    {row.metaLines.slice(0, 2).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {row.metaLines.length > 2 ? <p>+ {row.metaLines.length - 2} meta(s) detalhada(s) no CSV.</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function buildReportRow(challenge: Challenge, participant: ChallengeParticipant): ReportRow {
  const metas = Array.isArray(participant.metas) && participant.metas.length
    ? participant.metas
    : challenge.metas
  const payout = Number(participant.premioTotalLiberado ?? 0)
  const progress = Number(participant.resumo?.percentualGeral ?? 0)
  const totalMetas = Number(participant.resumo?.totalMetas ?? metas.length ?? 0)
  const metasConcluidas = Number(participant.resumo?.metasConcluidas ?? metas.filter((meta) => meta.premioLiberado).length)
  const metaLines = metas.map((meta) => buildMetaLine(meta))

  return {
    participant,
    payout,
    progress,
    soldValueLabel: buildParticipantSoldValueLabel(metas),
    metasConcluidas,
    totalMetas,
    summary: buildParticipantSummary(challenge, participant, payout, metasConcluidas, totalMetas),
    metaLines,
  }
}

function buildParticipantSummary(
  challenge: Challenge,
  participant: ChallengeParticipant,
  payout: number,
  metasConcluidas: number,
  totalMetas: number
) {
  const challengeStatus = getChallengeLifecycleStatus(challenge)

  if (!challenge.exigeAceite) {
    if (payout > 0) {
      return `Apurou ${metasConcluidas}/${totalMetas} meta(s) e liberou ${formatCurrencyBRL(payout)}.`
    }

    return `Participou automaticamente e fechou com ${metasConcluidas}/${totalMetas} meta(s), sem valor liberado.`
  }

  const status = String(participant.statusParticipacao ?? "").toUpperCase()

  if (status === "RECUSADO") {
    return "Não entrou na campanha e não gera pagamento."
  }

  if (payout > 0) {
    return `Liberou ${formatCurrencyBRL(payout)} com ${metasConcluidas}/${totalMetas} meta(s) concluída(s).`
  }

  if (["DISPONIVEL", "CONVIDADO"].includes(status) && isClosedChallengeStatus(challengeStatus)) {
    return "Ficou sem adesão efetiva até o fechamento e não gera pagamento."
  }

  return `Fechou com ${metasConcluidas}/${totalMetas} meta(s) e sem valor liberado.`
}

function buildMetaLine(meta: ChallengeMeta) {
  const focus = getChallengeMetaFocusLabel(meta)
  const focusSuffix = focus ? ` | ${focus}` : ""
  return `${getMetaTypeLabel(meta.tipoMeta)}${focusSuffix}: ${formatMetaProgressValue(meta)} de ${formatMetaValue(meta)}`
}

function buildParticipantSoldValueLabel(metas: ChallengeMeta[]) {
  const relevantMetas = metas.filter((meta) => ["FATURAMENTO", "PRODUTO_OU_MARCA"].includes(String(meta.tipoMeta ?? "").toUpperCase()))
  if (!relevantMetas.length) return "Sem valor"

  // Cada meta usa seu proprio metricType (VALOR ou QUANTIDADE): formatar individualmente
  // evita somar reais com unidades quando elas tem unidades diferentes.
  return relevantMetas.map((meta) => formatMetaProgressValue(meta)).join(" + ")
}

function getCompactParticipantStatus(challenge: Challenge, participant: ChallengeParticipant) {
  if (!challenge.exigeAceite) {
    return "Automático"
  }

  return getParticipantStatusLabel(participant.statusParticipacao)
}

function getReportTone(challenge: Challenge) {
  const kindLabel = getChallengeCampaignKindLabel(getChallengeCampaignKind(challenge)).toLowerCase()
  const lifecycleStatus = getChallengeLifecycleStatus(challenge)

  if (isEndedChallengeStatus(lifecycleStatus)) {
    return {
      eyebrow: "3. Relatório final",
      title: `Fechamento do ${kindLabel}`,
      description: "Esse resumo consolida resultado, atingimento e valor a pagar por vendedor para servir como base de conferência do gerente.",
    }
  }

  if (lifecycleStatus === "CANCELADO") {
    return {
      eyebrow: "3. Relatório congelado",
      title: `Apuração parcial do ${kindLabel}`,
      description: "A campanha foi cancelada, mas o quadro abaixo preserva a apuração acumulada para conferência interna.",
    }
  }

  return {
    eyebrow: "3. Prévia gerencial",
    title: `Prévia de pagamento do ${kindLabel}`,
    description: "Os valores abaixo acompanham a apuração atual. Quando a campanha for encerrada, esse painel vira o relatório final do gerente.",
  }
}

function buildReportCsv(challenge: Challenge, kind: string, rows: ReportRow[]) {
  const headers = [
    "campanha_id",
    "campanha",
    "tipo",
    "status_campanha",
    "vigencia_inicio",
    "vigencia_fim",
    "sk_vendedor",
    "vendedor",
    "status_participacao",
    "metas_concluidas",
    "metas_totais",
    "atingimento_percentual",
    "valor_a_pagar",
    "resultado_resumido",
    "detalhes_metas",
  ]

  const body = rows.map((row) => [
    String(challenge.id),
    challenge.titulo ?? "",
    kind,
    getChallengeLifecycleStatus(challenge),
    formatDateBR(challenge.dataInicio),
    formatDateBR(challenge.dataFim),
    String(row.participant.skVendedor ?? ""),
    row.participant.nomeVendedor ?? "",
    challenge.exigeAceite ? row.participant.statusParticipacao : "PARTICIPACAO_AUTOMATICA",
    String(row.metasConcluidas),
    String(row.totalMetas),
    String(Math.round(row.progress)),
    formatCurrencyBRL(row.payout),
    row.summary,
    row.metaLines.join(" | "),
  ])

  return [headers, ...body]
    .map((columns) => columns.map(escapeCsvValue).join(";"))
    .join("\r\n")
}

function escapeCsvValue(value: string) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function buildReportFileName(challenge: Challenge, kind: string) {
  const baseTitle = normalizeFileSlug(challenge.titulo ?? `${kind}-${challenge.id}`)
  return `relatorio-${normalizeFileSlug(kind)}-${baseTitle}-${challenge.id}.csv`
}

function normalizeFileSlug(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "campanha"
}

function ReportMetric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function CompactReportValue({
  label,
  value,
  helper,
  align = "left",
}: {
  label: string
  value: string
  helper?: string
  align?: "left" | "right"
}) {
  const alignClass = align === "right" ? "md:text-right" : ""
  const helperAlignClass = align === "right" ? "md:justify-end" : ""

  return (
    <div className={`min-w-0 ${alignClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36 md:hidden">{label}</p>
      <p className="whitespace-nowrap font-semibold text-white">{value}</p>
      {helper ? (
        <div className={`mt-1 flex ${helperAlignClass}`}>
          <p className="whitespace-nowrap text-xs text-white/45">{helper}</p>
        </div>
      ) : null}
    </div>
  )
}
