"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChallengeReview } from "@/components/challenges/ChallengeReview"
import {
  ChallengeTargetAutocomplete,
  type ChallengeTargetAutocompleteOption,
} from "@/components/challenges/ChallengeTargetAutocomplete"
import type {
  Challenge,
  ChallengeCampaignKind,
  ChallengeFormPayload,
  ChallengeMeta,
  ChallengeMetadata,
  ChallengeModuleSetup,
} from "@/lib/challenges"
import {
  compareChallengeDateValues,
  getChallengeDateInputValue,
  getChallengeCampaignKind,
  getChallengeCampaignKindLabel,
  hasChallengeMetaTarget,
  searchChallengeBrands,
  searchChallengeProducts,
} from "@/lib/challenges"

const STEPS = ["Nome", "Meta", "Prazo", "Revisão"]

function getStepQuestions(kind: ChallengeCampaignKind) {
  const noun = kind === "BONUS" ? "bônus" : "desafio"
  return [
    `Como vamos chamar esse ${noun}?`,
    `Qual é a meta do ${noun}?`,
    `Quando o ${noun} roda?`,
    "Pronto para publicar?",
  ]
}

type TargetKind = "BRAND" | "PRODUCT"
type MetaMetricType = "VALOR" | "QUANTIDADE"

export function ChallengeWizard({
  open,
  campaignKind,
  onCancel,
  onSubmit,
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
  saving?: boolean
  editingChallenge?: Challenge | null
  metadata?: ChallengeMetadata | null
  createdBy?: string
  moduleSetup?: ChallengeModuleSetup | null
}) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const isSubmittingRef = useRef(false)
  const [step, setStep] = useState(0)
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [bonusMonth, setBonusMonth] = useState(getCurrentMonthValue())
  const [targetKind, setTargetKind] = useState<TargetKind>("BRAND")
  const [target, setTarget] = useState<ChallengeTargetAutocompleteOption | null>(null)
  const [metricType, setMetricType] = useState<MetaMetricType>("VALOR")
  const [metaValor, setMetaValor] = useState("")
  const [recompensaValor, setRecompensaValor] = useState("")

  const effectiveKind = editingChallenge ? getChallengeCampaignKind(editingChallenge) : campaignKind
  const eligibleSellers = metadata?.sellers.length ?? 0
  const meta = buildMetaFromState(targetKind, target, metricType, metaValor, recompensaValor)
  const eyebrowLabel = editingChallenge
    ? `Editar ${getChallengeCampaignKindLabel(effectiveKind).toLowerCase()}`
    : effectiveKind === "BONUS"
      ? "Novo bônus"
      : "Novo desafio"
  const stepQuestions = getStepQuestions(effectiveKind)
  const draftPayload: ChallengeFormPayload = {
    titulo: titulo.trim(),
    descricao: descricao.trim() || null,
    dataInicio,
    dataFim,
    exigeAceite: effectiveKind === "DESAFIO",
    empresaId: editingChallenge?.empresaId ?? null,
    criadoPor: createdBy,
    metas: [meta],
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
    const existingMeta = editingChallenge?.metas?.[0] ?? null
    const config = existingMeta?.config ?? {}
    const hasProductTarget = Boolean(config.productId || config.productName)
    const hasBrandTarget = Boolean(config.brandId || config.brandName)

    setTitulo(editingChallenge?.titulo ?? "")
    setDescricao(editingChallenge?.descricao ?? "")
    setDataInicio(nextStart)
    setDataFim(nextEnd)
    setBonusMonth(nextMonth)
    setTargetKind(hasProductTarget && !hasBrandTarget ? "PRODUCT" : "BRAND")
    setTarget(
      hasProductTarget
        ? { id: String(config.productId ?? ""), label: String(config.productName ?? "") }
        : hasBrandTarget
          ? { id: String(config.brandId ?? ""), label: String(config.brandName ?? "") }
          : null
    )
    setMetricType(existingMeta?.metricType === "QUANTIDADE" ? "QUANTIDADE" : "VALOR")
    setMetaValor(existingMeta ? String(Number(existingMeta.metaValor) || "") : "")
    setRecompensaValor(existingMeta ? String(Number(existingMeta.recompensaValor) || "") : "")
    setStep(0)
  }, [campaignKind, editingChallenge, effectiveKind, open])

  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [open, step])

  const metaValorNum = Number(metaValor)
  const recompensaNum = Number(recompensaValor)
  const metaValida =
    Number.isFinite(metaValorNum) &&
    metaValorNum > 0 &&
    Number.isFinite(recompensaNum) &&
    recompensaNum >= 0 &&
    hasChallengeMetaTarget(meta)

  const canAdvance =
    step === 0
      ? titulo.trim().length > 0
      : step === 1
        ? metaValida
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

  function handleTargetKindChange(nextKind: TargetKind) {
    setTargetKind(nextKind)
    setTarget(null)
  }

  async function handleCreate() {
    if (step !== STEPS.length - 1 || !canAdvance || moduleSetup?.ready === false) return
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    try {
      await onSubmit(draftPayload, editingChallenge?.id)
    } finally {
      isSubmittingRef.current = false
    }
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
        <div className="space-y-4 px-6 pb-6 pt-8 sm:px-8 sm:pb-6 sm:pt-9">
          <div className="mx-auto w-full max-w-[720px] space-y-2">
            <div className="flex gap-1.5">
              {STEPS.map((_, index) => (
                <div
                  key={STEPS[index]}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${index === step ? "bg-cyan-300" : "bg-white/10"}`}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-white/42">
              Etapa {step + 1} de {STEPS.length} · {STEPS[step]}
            </p>
          </div>

          <div className="mx-auto w-full max-w-[720px]">
            {step === 0 ? (
              <section>
                <StepHeader eyebrow={eyebrowLabel} title={stepQuestions[0]} />

                <div className="mt-7 space-y-6">
                  <Field label="Nome">
                    <Input
                      value={titulo}
                      onChange={(event) => setTitulo(event.target.value)}
                      className={wizardInputClass}
                      placeholder={effectiveKind === "BONUS" ? "Ex.: Bônus de Conversão de Abril" : "Ex.: Sprint de Reativação da Semana"}
                    />
                  </Field>

                  <Field label="Descrição (opcional)">
                    <div className="relative">
                      <textarea
                        value={descricao}
                        onChange={(event) => setDescricao(event.target.value.slice(0, 500))}
                        rows={2}
                        maxLength={500}
                        className={`${wizardInputClass} h-auto resize-none py-3 leading-6`}
                        placeholder="Explique o objetivo, regras e contexto para os vendedores..."
                      />
                      <span className="absolute bottom-3 right-4 text-[11px] text-white/30">
                        {descricao.length}/500
                      </span>
                    </div>
                  </Field>
                </div>

                {eligibleSellers ? (
                  <p className="mt-6 flex items-center gap-2 text-xs text-white/45">
                    <Users className="h-3.5 w-3.5 text-cyan-200" />
                    {eligibleSellers} vendedor(es) entram neste {effectiveKind === "BONUS" ? "bônus" : "desafio"}.
                  </p>
                ) : null}
              </section>
            ) : null}

            {step === 1 ? (
              <section>
                <StepHeader eyebrow={eyebrowLabel} title={stepQuestions[1]} />

                <div className="mt-7 flex gap-3">
                  <TargetKindButton active={targetKind === "BRAND"} onClick={() => handleTargetKindChange("BRAND")}>
                    Marca
                  </TargetKindButton>
                  <TargetKindButton active={targetKind === "PRODUCT"} onClick={() => handleTargetKindChange("PRODUCT")}>
                    Produto
                  </TargetKindButton>
                </div>

                <div className="mt-6">
                  {targetKind === "BRAND" ? (
                    <ChallengeTargetAutocomplete
                      label="Marca"
                      placeholder="Busque por nome ou MARCA_ID"
                      emptyLabel="Nenhuma marca encontrada para esse termo."
                      helperText="Todos os produtos da marca entram na meta automaticamente."
                      value={target}
                      onChange={setTarget}
                      onSearch={loadBrandOptions}
                      inputClassName={wizardInputClass}
                    />
                  ) : (
                    <ChallengeTargetAutocomplete
                      label="Produto"
                      placeholder="Busque por nome ou PRODUTO_ID"
                      emptyLabel="Nenhum produto encontrado para esse termo."
                      helperText="Busca por nome ou PRODUTO_ID direto no Oracle."
                      value={target}
                      onChange={setTarget}
                      onSearch={loadProductOptions}
                      inputClassName={wizardInputClass}
                    />
                  )}
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Medir por</span>
                  <div className="flex overflow-hidden rounded-[14px] border border-white/10 bg-black/20">
                    <button
                      type="button"
                      onClick={() => setMetricType("VALOR")}
                      className={`px-4 py-2 text-xs font-semibold transition ${metricType === "VALOR" ? "bg-cyan-400/20 text-cyan-100" : "text-white/50 hover:text-white/80"}`}
                    >
                      R$ Valor
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricType("QUANTIDADE")}
                      className={`px-4 py-2 text-xs font-semibold transition ${metricType === "QUANTIDADE" ? "bg-cyan-400/20 text-cyan-100" : "text-white/50 hover:text-white/80"}`}
                    >
                      # Quantidade
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <Field label={metricType === "QUANTIDADE" ? "Meta (unidades)" : "Meta (R$)"}>
                    <Input
                      type="number"
                      min={0}
                      value={metaValor}
                      onChange={(event) => setMetaValor(event.target.value)}
                      className={wizardInputClass}
                      placeholder={metricType === "QUANTIDADE" ? "Ex.: 50" : "Ex.: 5000"}
                    />
                  </Field>

                  <Field label="Recompensa (R$)">
                    <Input
                      type="number"
                      min={0}
                      value={recompensaValor}
                      onChange={(event) => setRecompensaValor(event.target.value)}
                      className={wizardInputClass}
                      placeholder="Ex.: 100"
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section>
                <StepHeader eyebrow={eyebrowLabel} title={stepQuestions[2]} />

                <div className="mt-7 space-y-6">
                  {effectiveKind === "BONUS" ? (
                    <Field label="Mês de referência">
                      <Input type="month" value={bonusMonth} onChange={(event) => handleMonthChange(event.target.value)} className={wizardInputClass} />
                    </Field>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      <Field label="Data início">
                        <Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} className={wizardInputClass} />
                      </Field>

                      <Field label="Data fim">
                        <Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} className={wizardInputClass} />
                      </Field>
                    </div>
                  )}
                </div>

                {dataInicio && dataFim && compareChallengeDateValues(dataFim, dataInicio) < 0 ? (
                  <p className="mt-3 text-sm text-rose-300">A data final precisa ser igual ou posterior à data inicial.</p>
                ) : null}
              </section>
            ) : null}

            {step === 3 ? (
              <section>
                <StepHeader eyebrow={eyebrowLabel} title={stepQuestions[3]} />

                <div className="mt-7">
                  <ChallengeReview titulo={titulo} descricao={descricao} metas={[meta]} dataInicio={dataInicio} dataFim={dataFim} />
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 bg-[linear-gradient(180deg,rgba(2,8,23,0.84),rgba(2,8,23,0.96))] px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4">
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
              Próximo
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
                ? "Banco não inicializado"
                : saving
                  ? "Publicando..."
                  : editingChallenge
                    ? `Salvar ${getChallengeCampaignKindLabel(effectiveKind).toLowerCase()}`
                    : `Publicar ${effectiveKind === "BONUS" ? "bônus" : "desafio"}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h3>
    </div>
  )
}

function TargetKindButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-2xl border px-6 text-sm font-semibold transition ${
        active
          ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-50"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
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

function buildMetaFromState(
  targetKind: TargetKind,
  target: ChallengeTargetAutocompleteOption | null,
  metricType: MetaMetricType,
  metaValor: string,
  recompensaValor: string
): ChallengeMeta {
  return {
    tipoMeta: "PRODUTO_OU_MARCA",
    metaValor: Number(metaValor),
    unidadeMeta: metricType === "QUANTIDADE" ? "itens" : "R$",
    recompensaValor: Number(recompensaValor),
    metricType,
    ordemExibicao: 1,
    config: target
      ? targetKind === "BRAND"
        ? {
            brandId: target.id,
            brandName: target.label,
            targetType: "BRAND",
            targetValue: formatTargetOption(target),
          }
        : {
            productId: target.id,
            productName: target.label,
            targetType: "PRODUCT",
            targetValue: formatTargetOption(target),
          }
      : {},
  }
}

function formatTargetOption(option: ChallengeTargetAutocompleteOption) {
  return [String(option.id ?? "").trim(), String(option.label ?? "").trim()].filter(Boolean).join(" - ")
}

async function loadProductOptions(term: string) {
  const response = await searchChallengeProducts(term)
  return response.items.map((item) => ({
    id: item.produtoId,
    label: item.nomeProduto,
    description: item.nomeMarca ? `Marca: ${item.nomeMarca}` : null,
  }))
}

async function loadBrandOptions(term: string) {
  const response = await searchChallengeBrands(term)
  return response.items.map((item) => ({
    id: item.marcaId,
    label: item.nomeMarca,
    description: item.nomeCategoria ? `Categoria: ${item.nomeCategoria}` : null,
  }))
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

const wizardInputClass = "h-14 w-full rounded-[20px] border border-white/10 bg-black/20 px-5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-white/28 focus-visible:border-cyan-300/35 focus-visible:ring-0"
