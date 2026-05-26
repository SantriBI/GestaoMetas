"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CalendarRange, Coins, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChallengeImpactPreview } from "@/components/challenges/ChallengeImpactPreview"
import { ChallengeMetaBuilder } from "@/components/challenges/ChallengeMetaBuilder"
import type {
  Challenge,
  ChallengeCampaignKind,
  ChallengeFormPayload,
  ChallengeImpactPreviewResponse,
  ChallengeMeta,
  ChallengeMetadata,
  ChallengeModuleSetup,
} from "@/lib/challenges"
import {
  compareChallengeDateValues,
  formatCurrencyBRL,
  formatDateBR,
  getChallengeDateInputValue,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  hasChallengeMetaTarget,
  getMetaTypeLabel,
} from "@/lib/challenges"

const STEPS = ["Nome", "Metas", "Prazo", "Impacto estimado", "Revisao"]

export function ChallengeWizard({
  open,
  campaignKind,
  onCancel,
  onSubmit,
  onEstimateImpact,
  saving,
  editingChallenge,
  metadata,
  createdBy,
  moduleSetup,
}: {
  open: boolean
  campaignKind: ChallengeCampaignKind
  onCancel: () => void
  onSubmit: (payload: ChallengeFormPayload, id?: number | string) => Promise<unknown> | unknown
  onEstimateImpact: (payload: ChallengeFormPayload) => Promise<ChallengeImpactPreviewResponse | null>
  saving?: boolean
  editingChallenge?: Challenge | null
  metadata?: ChallengeMetadata | null
  createdBy?: string
  moduleSetup?: ChallengeModuleSetup | null
}) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const impactRequestRef = useRef(0)
  const [step, setStep] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [bonusMonth, setBonusMonth] = useState(getCurrentMonthValue())
  const [metas, setMetas] = useState<ChallengeMeta[]>([])
  const [impactPreview, setImpactPreview] = useState<ChallengeImpactPreviewResponse | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [impactError, setImpactError] = useState<string | null>(null)

  const effectiveKind = editingChallenge ? getChallengeCampaignKind(editingChallenge) : campaignKind
  const orderedMetas = metas.map((meta, index) => ({ ...meta, ordemExibicao: index + 1 }))
  const impact = impactPreview?.impact ?? editingChallenge?.impact ?? null
  const totalReward = orderedMetas.reduce((sum, meta) => sum + Number(meta.recompensaValor ?? 0), 0)
  const eligibleSellers = metadata?.sellers.length ?? 0
  const draftPayload: ChallengeFormPayload = {
    titulo: titulo.trim(),
    descricao:
      effectiveKind === "BONUS"
        ? "Bonus mensal automatico com metas comerciais e acompanhamento continuo do resultado."
        : "Campanha comercial com prazo definido, aceite do time e acompanhamento por meta.",
    dataInicio,
    dataFim,
    exigeAceite: effectiveKind === "DESAFIO",
    empresaId: editingChallenge?.empresaId ?? null,
    criadoPor: createdBy,
    metas: orderedMetas,
  }

  useEffect(() => {
    if (!open) return

    const currentMonth = getCurrentMonthValue()
    const nextStart =
      getChallengeDateInputValue(editingChallenge?.dataInicio) ||
      (effectiveKind === "BONUS" ? getMonthStart(currentMonth) : getTodayValue())
    const nextEnd =
      getChallengeDateInputValue(editingChallenge?.dataFim) ||
      (effectiveKind === "BONUS" ? getMonthEnd(currentMonth) : addDaysValue(getTodayValue(), 7))
    const nextMonth = effectiveKind === "BONUS" ? (nextStart ? nextStart.slice(0, 7) : currentMonth) : currentMonth
    const nextMetas = editingChallenge?.metas?.length
      ? editingChallenge.metas.map((meta, index) => ({ ...meta, ordemExibicao: index + 1, config: meta.config ?? {} }))
      : []

    setTitulo(editingChallenge?.titulo ?? "")
    setDataInicio(nextStart)
    setDataFim(nextEnd)
    setBonusMonth(nextMonth)
    setMetas(nextMetas)
    setStep(0)
    setImpactPreview(null)
    setImpactError(null)
  }, [campaignKind, editingChallenge, effectiveKind, open])

  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [open, step])

  useEffect(() => {
    const payload: ChallengeFormPayload = {
      titulo: titulo.trim(),
      descricao:
        effectiveKind === "BONUS"
          ? "Bonus mensal automatico com metas comerciais e acompanhamento continuo do resultado."
          : "Campanha comercial com prazo definido, aceite do time e acompanhamento por meta.",
      dataInicio,
      dataFim,
      exigeAceite: effectiveKind === "DESAFIO",
      empresaId: editingChallenge?.empresaId ?? null,
      criadoPor: createdBy,
      metas: metas.map((meta, index) => ({ ...meta, ordemExibicao: index + 1 })),
    }

    if (step < 3 || !payload.titulo || !payload.dataInicio || !payload.dataFim || !payload.metas.length) return

    let cancelled = false
    const requestId = impactRequestRef.current + 1
    impactRequestRef.current = requestId

    setImpactLoading(true)
    setImpactError(null)

    void onEstimateImpact(payload)
      .then((result) => {
        if (cancelled || impactRequestRef.current !== requestId) return
        setImpactPreview(result)
        if (!result) setImpactError("Nao foi possivel gerar a leitura de impacto neste momento.")
      })
      .catch((err) => {
        if (cancelled || impactRequestRef.current !== requestId) return
        setImpactPreview(null)
        setImpactError(err instanceof Error ? err.message : "Nao foi possivel gerar a leitura de impacto.")
      })
      .finally(() => {
        if (cancelled || impactRequestRef.current !== requestId) return
        setImpactLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [createdBy, dataFim, dataInicio, editingChallenge?.empresaId, effectiveKind, metas, onEstimateImpact, step, titulo])

  const metasValidas =
    orderedMetas.length > 0 &&
    orderedMetas.every((meta) => {
      const metaValor = Number(meta.metaValor)
      const recompensa = Number(meta.recompensaValor)

      if (!Number.isFinite(metaValor) || metaValor <= 0) return false
      if (!Number.isFinite(recompensa) || recompensa < 0) return false
      if (!hasChallengeMetaTarget(meta)) return false
      return true
    })

  const canAdvance =
    step === 0
      ? titulo.trim().length > 0
      : step === 1
        ? metasValidas
        : step === 2
          ? Boolean(dataInicio && dataFim && compareChallengeDateValues(dataFim, dataInicio) >= 0)
          : true

  function handleMonthChange(value: string) {
    setBonusMonth(value)
    if (!value) {
      setDataInicio("")
      setDataFim("")
      return
    }

    setDataInicio(getMonthStart(value))
    setDataFim(getMonthEnd(value))
  }

  async function handleCreate() {
    if (step !== STEPS.length - 1 || !canAdvance || moduleSetup?.ready === false) return
    await onSubmit(draftPayload, editingChallenge?.id)
  }

  function handleBack() {
    if (step === 0) {
      onCancel()
      return
    }

    setStep((current) => Math.max(0, current - 1))
  }

  function handleNext() {
    if (!canAdvance || step >= STEPS.length - 1) return
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
        <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-5 lg:space-y-7 lg:px-7 lg:py-6">
          <div className="flex flex-wrap gap-3">
            {STEPS.map((label, index) => (
              <div
                key={label}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  index === step
                    ? "border-cyan-300/24 bg-cyan-300/10 text-cyan-50"
                    : index < step
                      ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-50"
                      : "border-white/10 bg-white/[0.03] text-white/48"
                }`}
              >
                {index + 1}. {label}
              </div>
            ))}
          </div>

          <div className="mx-auto w-full max-w-[1180px]">
            {step === 0 ? (
              <section className={panelClass}>
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.16fr)_320px]">
                  <div className="space-y-8">
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Etapa 1</p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight text-white">Nome da campanha</h3>
                      <p className="mt-3 text-sm leading-7 text-white/58">
                        Diga ao time, em uma frase curta, o que precisa acontecer. Quanto mais claro, mais rapido o time entra em ritmo.
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6">
                      <Field label="Nome">
                        <Input
                          value={titulo}
                          onChange={(event) => setTitulo(event.target.value)}
                          className={wizardInputClass}
                          placeholder={effectiveKind === "BONUS" ? "Ex.: Bonus de Conversao de Abril" : "Ex.: Sprint de Reativacao da Semana"}
                        />
                      </Field>
                    </div>
                  </div>

                  <aside className={asidePanelClass}>
                    <AsideCard title="Como o gerente vai ler" icon={<Sparkles className="h-3.5 w-3.5 text-cyan-200" />} highlight>
                      <p className="text-xl font-semibold text-white">
                        {titulo || (effectiveKind === "BONUS" ? "Novo bonus mensal" : "Nova campanha")}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-white/56">
                        {effectiveKind === "BONUS"
                          ? "Bonus recorrente, automatico e sem aceite. Ideal para dar ritmo mensal ao time."
                          : "Campanha com inicio, fim e aceite do vendedor. Ideal para acelerar uma frente comercial especifica."}
                      </p>
                    </AsideCard>

                    <AsideCard title="Base da operacao" icon={<Target className="h-3.5 w-3.5 text-cyan-200" />}>
                      <p className="text-sm leading-7 text-white/60">
                        {eligibleSellers
                          ? `${eligibleSellers} vendedor(es) entram no radar de elegibilidade desta campanha.`
                          : "A leitura de participantes elegiveis aparece na etapa de impacto estimado."}
                      </p>
                    </AsideCard>
                  </aside>
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className={panelClass}>
                <ChallengeMetaBuilder metas={orderedMetas} onChange={setMetas} />
              </section>
            ) : null}

            {step === 2 ? (
              <section className={panelClass}>
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.16fr)_320px]">
                  <div className="space-y-8">
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Etapa 3</p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight text-white">Prazo da campanha</h3>
                      <p className="mt-3 text-sm leading-7 text-white/58">
                        Defina a janela comercial da acao. O prazo certo ajuda o time a sentir urgencia sem perder clareza.
                      </p>
                    </div>

                    <div className="space-y-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6">
                      {effectiveKind === "BONUS" ? (
                        <Field label="Mes de referencia">
                          <Input type="month" value={bonusMonth} onChange={(event) => handleMonthChange(event.target.value)} className={wizardInputClass} />
                        </Field>
                      ) : (
                        <div className="grid gap-5 md:grid-cols-2">
                          <Field label="Data inicio">
                            <Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} className={wizardInputClass} />
                          </Field>

                          <Field label="Data fim">
                            <Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} className={wizardInputClass} />
                          </Field>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className={asidePanelClass}>
                    <AsideCard title="Formato do prazo" icon={<CalendarRange className="h-3.5 w-3.5 text-cyan-200" />} highlight>
                      <p className="text-lg font-semibold text-white">
                        {effectiveKind === "BONUS" ? "Bonus mensal automatico" : "Campanha com data marcada"}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-white/56">
                        {effectiveKind === "BONUS"
                          ? "O bonus roda dentro do mes escolhido e nao exige aceite do time."
                          : "O desafio abre, precisa de aceite e termina no prazo combinado com a operacao."}
                      </p>
                    </AsideCard>

                    <AsideCard title="Periodo selecionado" icon={<CalendarRange className="h-3.5 w-3.5 text-cyan-200" />}>
                      <p className="text-lg font-semibold text-white">
                        {dataInicio && dataFim ? `${formatDateBR(dataInicio)} ate ${formatDateBR(dataFim)}` : "Escolha as datas"}
                      </p>
                    </AsideCard>

                    {dataInicio && dataFim && compareChallengeDateValues(dataFim, dataInicio) < 0 ? (
                      <div className="rounded-[24px] border border-rose-300/18 bg-rose-400/10 p-5 text-sm leading-7 text-rose-100">
                        A data final precisa ser igual ou posterior a data inicial.
                      </div>
                    ) : null}
                  </aside>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className={panelClass}>
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Etapa 4</p>
                  <h3 className="mt-4 text-3xl font-black tracking-tight text-white">Impacto estimado</h3>
                  <p className="mt-3 text-sm leading-7 text-white/58">
                    Antes de publicar, confira o quanto a campanha pode custar e o faturamento que ela pode ajudar a gerar.
                  </p>
                </div>

                <div className="mt-8 space-y-6">
                  <ChallengeImpactPreview
                    impact={impact}
                    loading={impactLoading}
                    error={impactError}
                    preview
                    title="Impacto da campanha"
                    description="Leitura comercial do bonus, do faturamento projetado e da base elegivel para esta configuracao."
                  />

                  {impact ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <ImpactCallout
                        title="Custo potencial"
                        value={`A campanha pode custar ate ${formatCurrencyBRL(impact.bonusPotential)}.`}
                      />
                      <ImpactCallout
                        title="Faturamento potencial"
                        value={`E pode gerar ate ${formatCurrencyBRL(impact.estimatedRevenue)} em faturamento.`}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className={panelClass}>
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Etapa 5</p>
                  <h3 className="mt-4 text-3xl font-black tracking-tight text-white">Revisao final</h3>
                  <p className="mt-3 text-sm leading-7 text-white/58">
                    Um ultimo olhar para confirmar nome, metas, prazo e impacto financeiro antes de publicar.
                  </p>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-4">
                  <ReviewStat label="Formato" value={effectiveKind === "BONUS" ? "Bonus mensal" : "Desafio com aceite"} />
                  <ReviewStat label="Prazo" value={dataInicio && dataFim ? `${formatDateBR(dataInicio)} ate ${formatDateBR(dataFim)}` : "-"} />
                  <ReviewStat label="Metas" value={`${orderedMetas.length} meta(s)`} />
                  <ReviewStat label="Bonus potencial" value={formatCurrencyBRL(totalReward)} />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      <Target className="h-4 w-4 text-cyan-200" />
                      O que vai entrar na campanha
                    </div>
                    <h4 className="mt-4 text-2xl font-black tracking-tight text-white">{titulo || "Nova campanha"}</h4>
                    <div className="mt-5 space-y-3">
                      {orderedMetas.map((meta, index) => (
                        <div key={`${meta.tipoMeta}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{getMetaTypeLabel(meta.tipoMeta)}</p>
                              <p className="mt-1 text-sm text-white/58">
                                Meta {meta.tipoMeta === "FATURAMENTO" ? formatCurrencyBRL(meta.metaValor) : `${meta.metaValor} ${meta.unidadeMeta}`}
                              </p>
                            </div>
                            <span className="rounded-full border border-amber-200/14 bg-amber-200/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                              {formatCurrencyBRL(meta.recompensaValor)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <AsideCard title="Leitura executiva" icon={<Sparkles className="h-3.5 w-3.5 text-cyan-200" />} highlight>
                      <p className="text-sm leading-7 text-white/62">
                        {effectiveKind === "BONUS"
                          ? "Bonus automatico, sem aceite e com acompanhamento recorrente do resultado."
                          : "Campanha com aceite do time, prazo definido e acompanhamento por meta."}
                      </p>
                    </AsideCard>

                    <AsideCard title="Impacto esperado" icon={<Coins className="h-3.5 w-3.5 text-cyan-200" />}>
                      <p className="text-sm leading-7 text-white/62">
                        {impact
                          ? `Potencial de ${formatCurrencyBRL(impact.estimatedRevenue)} em faturamento com ate ${formatCurrencyBRL(impact.bonusPotential)} de bonus.`
                          : "O impacto sera calculado assim que nome, metas e prazo estiverem preenchidos."}
                      </p>
                    </AsideCard>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 bg-[linear-gradient(180deg,rgba(2,8,23,0.84),rgba(2,8,23,0.96))] px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-7">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Etapa {step + 1} de {STEPS.length}: {STEPS[step]}
            </p>
            <p className="mt-1 text-sm text-white/46">
              {moduleSetup?.ready === false
                ? "A campanha pode ser revisada agora, mas a publicacao fica bloqueada ate a persistencia do modulo."
                : "O fluxo foi reduzido ao essencial para publicar mais rapido e com melhor leitura de retorno."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" onClick={handleBack} className="h-12 rounded-2xl border-white/12 bg-white/5 text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step === 0 ? "Voltar ao painel" : "Voltar"}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance}
                className="h-12 rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa,#f59e0b)] px-6 text-black hover:opacity-95 disabled:opacity-50"
              >
                Proximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving || !canAdvance || moduleSetup?.ready === false}
                className="h-12 rounded-2xl bg-[linear-gradient(135deg,#f59e0b,#ec4899,#06b6d4)] px-6 text-black hover:opacity-95 disabled:opacity-50"
              >
                {moduleSetup?.ready === false
                  ? "Banco nao inicializado"
                  : saving
                    ? "Publicando..."
                    : editingChallenge
                      ? `Salvar ${getChallengeCampaignKindLabel(effectiveKind).toLowerCase()}`
                      : "Publicar campanha"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ImpactCallout({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-cyan-300/12 bg-cyan-300/[0.06] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/72">{title}</p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function ReviewStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

function AsideCard({
  title,
  icon,
  highlight = false,
  children,
}: {
  title: string
  icon: ReactNode
  highlight?: boolean
  children: ReactNode
}) {
  return (
    <div className={`rounded-[24px] border p-5 ${highlight ? "border-cyan-300/14 bg-cyan-300/[0.06]" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/44">
        {icon}
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{label}</span>
      {children}
    </label>
  )
}

function getTodayValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function getCurrentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function addDaysValue(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getMonthStart(value: string) {
  return `${value}-01`
}

function getMonthEnd(value: string) {
  const [year, month] = value.split("-").map(Number)
  const lastDay = new Date(year, month, 0)
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`
}

const asidePanelClass = "space-y-5 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,24,0.95),rgba(15,23,42,0.88))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)]"
const panelClass = "rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-5 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.22)] sm:px-7 sm:py-7 xl:px-8 xl:py-8"
const wizardInputClass = "h-14 w-full rounded-[20px] border border-white/10 bg-black/20 px-5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-white/28 focus-visible:border-cyan-300/35 focus-visible:ring-0"
