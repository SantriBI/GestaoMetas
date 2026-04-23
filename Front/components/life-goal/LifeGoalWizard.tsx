"use client"

import type { ReactNode } from "react"
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  Plus,
  Target,
  Wallet,
} from "lucide-react"

export interface LifeGoalWizardObjectiveDraft {
  id?: number | null
  nomeObjetivo: string
  valorObjetivo: string
  dataLimite: string
}

export interface LifeGoalWizardProfileForm {
  salarioFixo: string
  comissaoDesejada: string
  motivoTrabalho: string
  paraQuemTrabalha: string
  objetivosPessoais: string
  preferenciasProduto: string
}

const WIZARD_STEPS = [
  {
    eyebrow: "Passo 1 de 5",
    title: "Quanto entra de salario fixo e quanto voce quer tirar de comissao?",
    description: "Preencha do jeito mais simples: primeiro o fixo, depois quanto voce quer conquistar de comissao para complementar o mes.",
  },
  {
    eyebrow: "Passo 2 de 5",
    title: "Por que voce trabalha?",
    description: "Use palavras humanas. O SIP vai usar esse motivo para lembrar seu por que nas telas do dia a dia.",
  },
  {
    eyebrow: "Passo 3 de 5",
    title: "Para quem voce trabalha?",
    description: "Quem sente esse resultado com voce? Quando a meta anda, quem mais avanca junto?",
  },
  {
    eyebrow: "Passo 4 de 5",
    title: "Quais conquistas voce quer colocar de pe?",
    description: "Cadastre um ou mais objetivos reais para ligar comissao, bonus e desafios ao que faz sentido na sua vida.",
  },
  {
    eyebrow: "Passo 5 de 5",
    title: "O que voce gosta de vender ou fazer melhor?",
    description: "Esse detalhe ajuda o sistema a cruzar oportunidade comercial com a sua zona de forca.",
  },
] as const

function parseMoneyValue(value: string) {
  const normalized = String(value ?? "").replace(",", ".").trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrencyLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function LifeGoalWizard({
  open,
  saving,
  step,
  profileForm,
  objectives,
  generatedObjectiveSummary,
  needsAttention,
  onOpen,
  onClose,
  onBack,
  onNext,
  onProfileChange,
  onObjectiveChange,
  onObjectiveAdd,
  onObjectiveRemove,
}: {
  open: boolean
  saving: boolean
  step: number
  profileForm: LifeGoalWizardProfileForm
  objectives: LifeGoalWizardObjectiveDraft[]
  generatedObjectiveSummary: string
  needsAttention: boolean
  onOpen: () => void
  onClose: () => void
  onBack: () => void
  onNext: () => void
  onProfileChange: (patch: Partial<LifeGoalWizardProfileForm>) => void
  onObjectiveChange: (index: number, patch: Partial<LifeGoalWizardObjectiveDraft>) => void
  onObjectiveAdd: () => void
  onObjectiveRemove: (index: number) => void
}) {
  const salarioFixo = parseMoneyValue(profileForm.salarioFixo)
  const comissaoDesejada = parseMoneyValue(profileForm.comissaoDesejada)
  const rendaDesejada = salarioFixo + comissaoDesejada
  const objetivosCompletos = objectives.filter(
    (draft) => draft.nomeObjetivo.trim() && parseMoneyValue(draft.valorObjetivo) > 0 && draft.dataLimite.trim()
  )
  const valorTotalObjetivos = objetivosCompletos.reduce(
    (sum, draft) => sum + parseMoneyValue(draft.valorObjetivo),
    0
  )

  return (
    <section
      id="wizard-meta-de-vida"
      className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)] sm:p-7"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">Assistente da Meta de Vida</p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {open ? "Uma pergunta por vez, com mais sentido" : "Sua jornada esta ativa"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            {open
              ? "Nada de formulario frio. Vamos montar sua Meta de Vida em cinco passos e deixar o sistema lembrar constantemente do seu por que."
              : `Hoje o SIP esta puxando sua historia com base em ${generatedObjectiveSummary}.`}
          </p>
        </div>

        {!open ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/78 transition-colors hover:bg-white/10 hover:text-white"
          >
            {needsAttention ? "Ativar jornada" : "Atualizar meus dados"}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">
              <span>{WIZARD_STEPS[step].eyebrow}</span>
              <span>{step + 1}/5</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#f59e0b)] transition-[width] duration-500"
                style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <div key={step} className="animate-in fade-in slide-in-from-right-4 duration-300">
            {step === 0 ? (
              <WizardStage title={WIZARD_STEPS[0].title} description={WIZARD_STEPS[0].description}>
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <InputField
                      label="Salario fixo"
                      icon={<Wallet className="h-4 w-4 text-cyan-200" />}
                      prefix="R$"
                      value={profileForm.salarioFixo}
                      onChange={(value) => onProfileChange({ salarioFixo: value })}
                      placeholder="2000"
                      type="number"
                    />
                    <InputField
                      label="Quanto voce quer ganhar de comissao"
                      icon={<Wallet className="h-4 w-4 text-amber-200" />}
                      prefix="R$"
                      value={profileForm.comissaoDesejada}
                      onChange={(value) => onProfileChange({ comissaoDesejada: value })}
                      placeholder="1500"
                      type="number"
                    />
                  </div>

                  <div className="rounded-[24px] border border-emerald-300/16 bg-emerald-400/8 p-4">
                    <p className="text-sm font-semibold text-emerald-50">Resumo do seu mes</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-50/84">
                      O sistema vai considerar <strong>{formatCurrencyLabel(salarioFixo)}</strong> de fixo e
                      buscar <strong> {formatCurrencyLabel(comissaoDesejada)}</strong> de comissao para voce
                      fechar <strong>{formatCurrencyLabel(rendaDesejada)}</strong> no mes.
                    </p>
                    <p className="mt-3 text-xs text-emerald-50/70">
                      Se voce nao tiver salario fixo, pode deixar zero e preencher apenas a comissao desejada.
                    </p>
                  </div>
                </div>
              </WizardStage>
            ) : null}

            {step === 1 ? (
              <WizardStage title={WIZARD_STEPS[1].title} description={WIZARD_STEPS[1].description}>
                <TextAreaField
                  label="Seu motivo em palavras simples"
                  value={profileForm.motivoTrabalho}
                  onChange={(value) => onProfileChange({ motivoTrabalho: value })}
                  placeholder="Ex: Dar conforto para minha familia, sair das dividas, crescer com mais tranquilidade."
                  rows={5}
                />
              </WizardStage>
            ) : null}

            {step === 2 ? (
              <WizardStage title={WIZARD_STEPS[2].title} description={WIZARD_STEPS[2].description}>
                <TextAreaField
                  label="Quem voce leva junto nessa meta"
                  value={profileForm.paraQuemTrabalha}
                  onChange={(value) => onProfileChange({ paraQuemTrabalha: value })}
                  placeholder="Ex: Minha esposa, meus filhos, minha casa, minha propria paz."
                  rows={4}
                />
              </WizardStage>
            ) : null}

            {step === 3 ? (
              <WizardStage title={WIZARD_STEPS[3].title} description={WIZARD_STEPS[3].description}>
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/70">
                    <p className="font-semibold text-white">Como preencher sem complicar</p>
                    <p className="mt-2">
                      Coloque um objetivo por vez. Escreva o nome da conquista, o valor total e a data que voce quer
                      atingir. Se quiser, pode cadastrar varios objetivos na mesma edicao.
                    </p>
                  </div>

                  {objectives.map((draft, index) => (
                    <ObjectiveDraftCard
                      key={`${draft.id ?? "novo"}-${index}`}
                      index={index}
                      draft={draft}
                      onChange={onObjectiveChange}
                      onRemove={onObjectiveRemove}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={onObjectiveAdd}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-400/16"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar outro objetivo
                  </button>

                  <div className="grid gap-3 md:grid-cols-3">
                    <SummaryPill label="Objetivos prontos" value={String(objetivosCompletos.length)} />
                    <SummaryPill label="Valor total" value={formatCurrencyLabel(valorTotalObjetivos)} />
                    <SummaryPill label="Resumo" value={generatedObjectiveSummary} />
                  </div>
                </div>
              </WizardStage>
            ) : null}

            {step === 4 ? (
              <WizardStage title={WIZARD_STEPS[4].title} description={WIZARD_STEPS[4].description}>
                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <InputField
                    label="Seu terreno favorito de venda"
                    icon={<Target className="h-4 w-4 text-emerald-200" />}
                    value={profileForm.preferenciasProduto}
                    onChange={(value) => onProfileChange({ preferenciasProduto: value })}
                    placeholder="Ex: Tintas, iluminacao, acabamentos, consultoria tecnica"
                  />
                  <div className="rounded-[26px] border border-emerald-300/14 bg-emerald-400/8 px-4 py-4 text-sm leading-6 text-emerald-50/88">
                    <p className="font-semibold">Preview da sua nova camada motivacional</p>
                    <p className="mt-2">
                      Quando aparecer uma oportunidade em <strong>{profileForm.preferenciasProduto || "sua melhor categoria"}</strong>,
                      o SIP vai cruzar isso com seus objetivos e te lembrar por que vale agir agora.
                    </p>
                  </div>
                </div>
              </WizardStage>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/54">
              {step === 0
                ? "Primeiro alinhamos seu fixo com a comissao que voce quer conquistar no mes."
                : step === 1
                  ? "Seu motivo vira linguagem de incentivo nas telas do SIP."
                  : step === 2
                    ? "Quando o sistema lembra quem importa, o esforco ganha mais peso."
                    : step === 3
                      ? "Objetivos reais ajudam o vendedor a sentir que cada venda tem destino."
                      : "Ultimo passo: agora vamos conectar seu estilo de venda ao plano de acao."}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={step === 0 ? onClose : onBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/76 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                {step === 0 ? "Continuar depois" : "Voltar"}
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(5,150,105,0.28)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Salvando..." : step === WIZARD_STEPS.length - 1 ? "Ativar minha jornada" : "Proximo"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryPill label="Salario fixo" value={salarioFixo > 0 ? formatCurrencyLabel(salarioFixo) : "-"} />
          <SummaryPill
            label="Comissao desejada"
            value={comissaoDesejada > 0 ? formatCurrencyLabel(comissaoDesejada) : "-"}
          />
          <SummaryPill label="Trabalha por" value={profileForm.motivoTrabalho || "-"} />
        </div>
      )}
    </section>
  )
}

function WizardStage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
      <div className="space-y-3">
        <h3 className="text-3xl font-black tracking-tight text-white">{title}</h3>
        <p className="text-sm leading-7 text-white/64">{description}</p>
      </div>
      <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
        {children}
      </div>
    </div>
  )
}

function ObjectiveDraftCard({
  index,
  draft,
  onChange,
  onRemove,
}: {
  index: number
  draft: LifeGoalWizardObjectiveDraft
  onChange: (index: number, patch: Partial<LifeGoalWizardObjectiveDraft>) => void
  onRemove: (index: number) => void
}) {
  const isExisting = draft.id != null

  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Objetivo {index + 1}</p>
          <p className="mt-1 text-xs text-white/52">
            {isExisting ? "Ja salvo no seu painel. Edite se quiser ajustar o rumo." : "Novo objetivo para entrar na sua jornada."}
          </p>
        </div>
        {!isExisting ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/62 transition-colors hover:bg-white/8 hover:text-white"
          >
            Remover
          </button>
        ) : (
          <span className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-50">
            Ja salvo
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InputField
          label="Qual objetivo voce quer conquistar?"
          value={draft.nomeObjetivo}
          onChange={(value) => onChange(index, { nomeObjetivo: value })}
          placeholder="Ex: Comprar um celular"
          icon={<Target className="h-4 w-4 text-emerald-200" />}
        />
        <InputField
          label="Quanto voce precisa para isso?"
          value={draft.valorObjetivo}
          onChange={(value) => onChange(index, { valorObjetivo: value })}
          placeholder="3000"
          prefix="R$"
          type="number"
          icon={<Wallet className="h-4 w-4 text-amber-200" />}
        />
        <InputField
          label="Ate quando quer conquistar isso?"
          value={draft.dataLimite}
          onChange={(value) => onChange(index, { dataLimite: value })}
          type="date"
          icon={<Calendar className="h-4 w-4 text-cyan-200" />}
        />
      </div>
    </div>
  )
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  prefix,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  icon?: ReactNode
  prefix?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/72">{label}</span>
      <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
        {icon}
        {prefix ? <span className="text-sm font-semibold text-white/72">{prefix}</span> : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/34 [color-scheme:dark]"
          style={{ colorScheme: "dark" }}
        />
      </div>
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/72">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/34"
      />
    </label>
  )
}
