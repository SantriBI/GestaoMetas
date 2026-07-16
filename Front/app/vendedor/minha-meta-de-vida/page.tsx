"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Coins,
  DollarSign,
  Flame,
  HeartHandshake,
  RotateCcw,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { MotivationSpotlight } from "@/components/layout/MotivationSpotlight"
import {
  LifeGoalWizard,
  type LifeGoalWizardObjectiveDraft,
  type LifeGoalWizardProfileForm,
} from "@/components/life-goal/LifeGoalWizard"
import { formatCurrency } from "@/lib/types"
import {
  createSellerLifeGoal,
  createSellerProfile,
  fetchSellerLifeGoal,
  formatLifeGoalStatus,
  LifeGoalApiError,
  type LifeGoalMessage,
  type LifeGoalObjective,
  type LifeGoalPayload,
  type LifeGoalResponse,
  type SellerProfilePayload,
  updateSellerLifeGoal,
  updateSellerProfile,
} from "@/lib/life-goal"
import {
  buildMotivationMessage,
  buildSalesBurst,
  getLifeGoalLabel,
  getLifeGoalRemaining,
} from "@/lib/motivation"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

function formatDateInput(value?: string | Date | null) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateLabel(value?: string | Date | null) {
  if (!value) return "-"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR")
}

function parseDecimalInput(value: string) {
  const normalized = value.replace(",", ".").trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildEmptyObjectiveDraft(): LifeGoalWizardObjectiveDraft {
  return {
    id: null,
    nomeObjetivo: "",
    valorObjetivo: "",
    dataLimite: formatDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  }
}

function buildObjectiveDrafts(objectives?: LifeGoalObjective[]) {
  if (!objectives?.length) {
    return [buildEmptyObjectiveDraft()]
  }

  return objectives.map((objective) => ({
    id: objective.id,
    nomeObjetivo: objective.nomeObjetivo ?? "",
    valorObjetivo: String(objective.valorObjetivo ?? ""),
    dataLimite: formatDateInput(objective.dataLimite),
  }))
}

function buildProfileForm(profile?: LifeGoalResponse["profile"]): LifeGoalWizardProfileForm {
  const salarioFixo = Number(profile?.salarioFixo ?? 0)
  const comissaoDesejada = Number(profile?.comissaoDesejada ?? 0)

  return {
    salarioFixo: salarioFixo > 0 ? String(salarioFixo) : "",
    comissaoDesejada: comissaoDesejada > 0 ? String(comissaoDesejada) : "",
    motivoTrabalho: profile?.motivoTrabalho ?? "",
    paraQuemTrabalha: profile?.paraQuemTrabalha ?? "",
    objetivosPessoais: profile?.objetivosPessoais ?? "",
    preferenciasProduto: profile?.preferenciasProduto ?? "",
  }
}

function getIncomeTargets(profile?: LifeGoalResponse["profile"] | null) {
  const salarioFixo = Number(profile?.salarioFixo ?? 0)
  const comissaoDesejada = Number(profile?.comissaoDesejada ?? 0)
  const rendaDesejada = Number((salarioFixo + comissaoDesejada).toFixed(2))

  return {
    salarioFixo: Number.isFinite(salarioFixo) ? salarioFixo : 0,
    comissaoDesejada: Number.isFinite(comissaoDesejada) ? comissaoDesejada : 0,
    rendaDesejada: Number.isFinite(rendaDesejada) ? rendaDesejada : 0,
  }
}

function getIncomeTargetsFromForm(profileForm: LifeGoalWizardProfileForm) {
  const salarioFixo = parseDecimalInput(profileForm.salarioFixo)
  const comissaoDesejada = parseDecimalInput(profileForm.comissaoDesejada)

  return {
    salarioFixo,
    comissaoDesejada,
    rendaDesejada: Number((salarioFixo + comissaoDesejada).toFixed(2)),
  }
}

function getStatusClasses(status: LifeGoalResponse["status"] | LifeGoalObjective["status"]) {
  switch (status) {
    case "CONQUISTADA":
      return "border-emerald-300/30 bg-emerald-400/12 text-emerald-100"
    case "PRAZO_ENCERRADO":
      return "border-rose-300/30 bg-rose-400/12 text-rose-100"
    case "EM_ANDAMENTO":
      return "border-cyan-300/30 bg-cyan-400/12 text-cyan-100"
    default:
      return "border-white/10 bg-white/5 text-white/72"
  }
}

function isObjectiveDraftFilled(draft: LifeGoalWizardObjectiveDraft) {
  return (
    draft.nomeObjetivo.trim().length > 0 ||
    draft.valorObjetivo.trim().length > 0 ||
    draft.dataLimite.trim().length > 0
  )
}

function isObjectiveDraftComplete(draft: LifeGoalWizardObjectiveDraft) {
  return (
    draft.nomeObjetivo.trim().length > 0 &&
    parseDecimalInput(draft.valorObjetivo) > 0 &&
    draft.dataLimite.trim().length > 0
  )
}

function buildPersonalObjectiveSummary(drafts: LifeGoalWizardObjectiveDraft[]) {
  const names = drafts
    .map((draft) => draft.nomeObjetivo.trim())
    .filter(Boolean)

  if (!names.length) return null
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} e ${names[1]}`
  return `${names[0]}, ${names[1]} e mais ${names.length - 2} objetivo${names.length - 2 > 1 ? "s" : ""}`
}

function isWizardSetupIncomplete(goal?: LifeGoalResponse | null) {
  if (!goal) return true

  const profile = goal.profile
  return (
    Number(profile?.comissaoDesejada ?? 0) <= 0 ||
    !profile?.motivoTrabalho ||
    !profile?.paraQuemTrabalha ||
    !profile?.preferenciasProduto ||
    !goal.objectives.length
  )
}

export default function MinhaMetaDeVidaPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [lifeGoal, setLifeGoal] = useState<LifeGoalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [wizardSaving, setWizardSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [profileForm, setProfileForm] = useState(buildProfileForm())
  const [wizardObjectives, setWizardObjectives] = useState<LifeGoalWizardObjectiveDraft[]>([buildEmptyObjectiveDraft()])
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardOpen, setWizardOpen] = useState(true)

  useEffect(() => {
    const user = getStoredUser()

    if (!user || user.role !== "VENDEDOR") {
      router.push("/login")
      return
    }

    setStoredUser(user)
    setAuthUser(user)
  }, [router])

  useEffect(() => {
    const sellerId = authUser?.sk_vendedor
    if (sellerId === null || sellerId === undefined || sellerId === "") return
    const resolvedSellerId: string | number = sellerId

    async function loadPanel() {
      setLoading(true)

      try {
        const payload = await fetchSellerLifeGoal(resolvedSellerId)
        applyPanel(payload)
        setError(null)
        setErrorDetails(null)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Nao foi possivel carregar o painel Minha Meta de Vida."
        setError(message)
        setLifeGoal(null)

        if (err instanceof LifeGoalApiError && err.details && typeof err.details === "object") {
          setErrorDetails(err.details as Record<string, unknown>)
        } else {
          setErrorDetails(null)
        }
      } finally {
        setLoading(false)
      }
    }

    void loadPanel()
  }, [authUser?.sk_vendedor])

  function applyPanel(payload: LifeGoalResponse) {
    setLifeGoal(payload)
    setProfileForm(buildProfileForm(payload.profile))
    setWizardObjectives(buildObjectiveDrafts(payload.objectives))
  }

  useEffect(() => {
    if (!lifeGoal) return

    setAnimatedProgress(0)
    const timeoutId = window.setTimeout(() => {
      setAnimatedProgress(lifeGoal.summary.percentualTotal)
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [lifeGoal?.summary.percentualTotal, lifeGoal?.summary.quantidadeObjetivos])

  useEffect(() => {
    if (isWizardSetupIncomplete(lifeGoal)) {
      setWizardOpen(true)
    }
  }, [lifeGoal])

  const scriptPath = typeof errorDetails?.scriptPath === "string" ? errorDetails.scriptPath : null
  const instructions = Array.isArray(errorDetails?.instructions)
    ? errorDetails.instructions.map(String)
    : []

  async function refreshPanel() {
    if (!authUser?.sk_vendedor) return

    try {
      const payload = await fetchSellerLifeGoal(authUser.sk_vendedor)
      applyPanel(payload)
      setError(null)
      setErrorDetails(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel atualizar o painel Minha Meta de Vida."
      setError(message)
    }
  }

  function validateWizardStep(step: number) {
    if (step === 0) {
      const incomeTargets = getIncomeTargetsFromForm(profileForm)
      if (incomeTargets.comissaoDesejada <= 0) {
        toast.error("Conte quanto voce quer ganhar de comissao para complementar seu mes.")
        return false
      }
    }

    if (step === 1 && !profileForm.motivoTrabalho.trim()) {
      toast.error("Escreva seu motivo. E ele que vai puxar sua energia nas mensagens do sistema.")
      return false
    }

    if (step === 2 && !profileForm.paraQuemTrabalha.trim()) {
      toast.error("Diga para quem voce trabalha para o SIP lembrar quem vai sentir esse resultado com voce.")
      return false
    }

    if (step === 3) {
      const hasPartialDraft = wizardObjectives.some(
        (draft) => isObjectiveDraftFilled(draft) && !isObjectiveDraftComplete(draft)
      )

      if (hasPartialDraft) {
        toast.error("Complete ou limpe os objetivos pela metade antes de continuar.")
        return false
      }

      if (!wizardObjectives.some(isObjectiveDraftComplete)) {
        toast.error("Cadastre pelo menos um objetivo real para ativar sua jornada.")
        return false
      }
    }

    if (step === 4 && !profileForm.preferenciasProduto.trim()) {
      toast.error("Conte o que voce gosta de vender ou fazer melhor para fechar sua jornada.")
      return false
    }

    return true
  }

  async function handleFinishWizard() {
    if (!authUser?.sk_vendedor) {
      toast.error("Seu usuario nao possui vendedor vinculado.")
      return
    }

    if (![0, 1, 2, 3, 4].every((step) => validateWizardStep(step))) {
      return
    }

    const completeObjectives = wizardObjectives.filter(isObjectiveDraftComplete)
    const objectiveSummary =
      buildPersonalObjectiveSummary(completeObjectives) ??
      (profileForm.objetivosPessoais.trim() || null)
    const incomeTargets = getIncomeTargetsFromForm(profileForm)

    const profilePayload: SellerProfilePayload = {
      sk_vendedor: authUser.sk_vendedor,
      vendedor_id: authUser.sk_vendedor,
      empresa_id: authUser.empresa_id ?? authUser.sk_empresa ?? null,
      renda_desejada: incomeTargets.rendaDesejada,
      salario_fixo: incomeTargets.salarioFixo,
      comissao_desejada: incomeTargets.comissaoDesejada,
      motivo_trabalho: profileForm.motivoTrabalho.trim() || null,
      para_quem_trabalha: profileForm.paraQuemTrabalha.trim() || null,
      objetivos_pessoais: objectiveSummary,
      preferencias_produto: profileForm.preferenciasProduto.trim() || null,
    }

    setWizardSaving(true)

    try {
      if (lifeGoal?.profile?.id != null) {
        await updateSellerProfile(lifeGoal.profile.id, profilePayload)
      } else {
        await createSellerProfile(profilePayload)
      }

      let latestPanel: LifeGoalResponse | null = null

      for (const draft of completeObjectives) {
        const objectivePayload: LifeGoalPayload = {
          sk_vendedor: authUser.sk_vendedor,
          vendedor_id: authUser.sk_vendedor,
          empresa_id: authUser.empresa_id ?? authUser.sk_empresa ?? null,
          nome_objetivo: draft.nomeObjetivo.trim(),
          valor_objetivo: parseDecimalInput(draft.valorObjetivo),
          data_limite: draft.dataLimite,
        }

        latestPanel = draft.id != null
          ? await updateSellerLifeGoal(draft.id, objectivePayload)
          : await createSellerLifeGoal(objectivePayload)
      }

      if (!latestPanel) {
        latestPanel = await fetchSellerLifeGoal(authUser.sk_vendedor)
      }

      applyPanel(latestPanel)
      setWizardOpen(false)
      setWizardStep(0)
      toast.success("Sua jornada emocional foi atualizada.")
      setError(null)
      setErrorDetails(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel salvar sua jornada agora."
      setError(message)
      if (err instanceof LifeGoalApiError && err.details && typeof err.details === "object") {
        setErrorDetails(err.details as Record<string, unknown>)
      }
      toast.error(message)
    } finally {
      setWizardSaving(false)
    }
  }

  function handleWizardNext() {
    if (!validateWizardStep(wizardStep)) return

    if (wizardStep === 4) {
      void handleFinishWizard()
      return
    }

    setWizardStep((current) => Math.min(current + 1, 4))
  }

  function handleWizardBack() {
    setWizardStep((current) => Math.max(current - 1, 0))
  }

  function openWizardAt(step = 0) {
    setWizardOpen(true)
    setWizardStep(step)
    window.setTimeout(() => {
      document.getElementById("wizard-meta-de-vida")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  function updateObjectiveDraft(index: number, patch: Partial<LifeGoalWizardObjectiveDraft>) {
    setWizardObjectives((current) =>
      current.map((draft, currentIndex) => (currentIndex === index ? { ...draft, ...patch } : draft))
    )
  }

  function addObjectiveDraft() {
    setWizardObjectives((current) => [...current, buildEmptyObjectiveDraft()])
  }

  function removeObjectiveDraft(index: number) {
    setWizardObjectives((current) => {
      const selected = current[index]
      if (selected?.id != null) {
        return current
      }

      const next = current.filter((_, currentIndex) => currentIndex !== index)
      return next.length ? next : [buildEmptyObjectiveDraft()]
    })
  }

  if (loading && !lifeGoal) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.16),transparent_22%),linear-gradient(145deg,#071019,#08131f_45%,#0a1522)] pb-mobile-tabbar">
        <AppShellNav user={authUser} />
        <MobileTabBar user={authUser} />
        <main className="mx-auto flex min-h-[70vh] max-w-[1200px] items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-10 text-center text-white">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/12 border-t-emerald-300" />
            <div>
              <p className="text-lg font-semibold">Montando seu painel pessoal</p>
              <p className="mt-1 text-sm text-white/64">Estamos conectando vendas, motivos e conquistas em uma so leitura.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const motivationMessage = buildMotivationMessage(authUser, lifeGoal, {
    context: "life-goal",
    openQuotes:
      lifeGoal?.insights.preferredOpenQuotes?.count ??
      lifeGoal?.insights.championOpportunity?.openQuotesCount ??
      0,
    openQuoteValue: lifeGoal?.insights.preferredOpenQuotes?.value ?? 0,
    championValue: lifeGoal?.insights.championOpportunity?.topChampionValue ?? 0,
  })
  const primaryLifeGoalLabel = getLifeGoalLabel(lifeGoal)
  const remainingToLifeGoal = getLifeGoalRemaining(lifeGoal)
  const incomeTargets = getIncomeTargets(lifeGoal?.profile)
  const desiredIncome = incomeTargets.rendaDesejada
  const fixedSalary = incomeTargets.salarioFixo
  const desiredCommission = incomeTargets.comissaoDesejada
  const desiredIncomeGap =
    desiredIncome > 0
      ? Math.max(desiredIncome - (fixedSalary + Number(lifeGoal?.summary.ganhoTotal ?? 0)), 0)
      : remainingToLifeGoal
  const preferredOpenQuotes = lifeGoal?.insights.preferredOpenQuotes ?? null
  const championOpportunity = lifeGoal?.insights.championOpportunity ?? null
  const dailyActionTarget =
    Number(lifeGoal?.tracking.daysToClosestDeadline ?? 0) > 0
      ? Number(lifeGoal?.simulator.vendaDiariaNecessariaAtePrazo ?? 0)
      : Number(lifeGoal?.simulator.vendaDiariaNecessariaAteFimDoMes ?? 0)
  const actionBurst = buildSalesBurst(dailyActionTarget, lifeGoal, {
    context: "life-goal",
    openQuotes: preferredOpenQuotes?.count ?? 0,
    openQuoteValue: preferredOpenQuotes?.value ?? 0,
  })
  const generatedObjectiveSummary =
    buildPersonalObjectiveSummary(wizardObjectives.filter(isObjectiveDraftComplete)) ??
    (profileForm.objetivosPessoais.trim() || "Seus sonhos ainda estao sendo montados.")

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.16),transparent_22%),linear-gradient(145deg,#071019,#08131f_45%,#0a1522)] pb-mobile-tabbar">
      <AppShellNav user={authUser} />
      <MobileTabBar user={authUser} />

      <main className="mx-auto max-w-[1240px] space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        {error ? (
          <section className="rounded-[28px] border border-rose-300/18 bg-rose-400/10 px-5 py-5 text-rose-50 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-100/72">Atencao</p>
            <p className="mt-2 text-base font-semibold">{error}</p>
            {scriptPath ? <p className="mt-2 text-sm text-rose-100/72">Script sugerido: {scriptPath}</p> : null}
            {instructions.length ? (
              <div className="mt-3 space-y-1 text-sm text-rose-100/80">
                {instructions.map((instruction) => (
                  <p key={instruction}>{instruction}</p>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {!lifeGoal?.capabilities.profileEnabled ? (
          <section className="rounded-[26px] border border-amber-300/18 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-50/90">
            O modulo de perfil ainda nao foi encontrado no banco. Execute {lifeGoal?.capabilities.profileScriptPath ?? "o script do perfil"} para liberar a personalizacao completa.
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,17,30,0.94),rgba(10,20,34,0.88),rgba(18,90,70,0.28))] px-6 py-7 shadow-[0_28px_80px_rgba(2,6,23,0.34)] sm:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/22 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/90">
                <Sparkles className="h-3.5 w-3.5" />
                Meta de Vida
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Sua Meta de Vida, sem complicacao.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
                  Veja rapido quanto falta, quanto ja entrou e o que merece sua atencao hoje.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openWizardAt(0)}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/12 px-4 py-2 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-400/18"
                >
                  {isWizardSetupIncomplete(lifeGoal) ? "Ativar jornada" : "Atualizar minha historia"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void refreshPanel()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white/78 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Atualizar leitura
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Salario fixo"
                  value={fixedSalary > 0 ? formatCurrency(fixedSalary) : "-"}
                  description="O valor base que entra no seu mes."
                  accent="text-amber-200"
                />
                <StatCard
                  label="Comissao desejada"
                  value={desiredCommission > 0 ? formatCurrency(desiredCommission) : "-"}
                  description="Quanto voce quer somar alem do fixo."
                  accent="text-emerald-200"
                />
                <StatCard
                  label="Meta total do mes"
                  value={desiredIncome > 0 ? formatCurrency(desiredIncome) : "-"}
                  description="Salario fixo + comissao desejada."
                  accent="text-white"
                />
                <StatCard
                  label="Quanto falta"
                  value={formatCurrency(desiredIncomeGap)}
                  description="O que ainda falta para fechar sua renda desejada."
                  accent="text-cyan-200"
                />
              </div>
            </div>

            <section className="rounded-[30px] border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    {lifeGoal?.summary.quantidadeObjetivos
                      ? `${lifeGoal.summary.quantidadeObjetivos} objetivo${lifeGoal.summary.quantidadeObjetivos > 1 ? "s" : ""}`
                      : "Monte seu painel"}
                  </h2>
                </div>

                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(lifeGoal?.status ?? "SEM_OBJETIVO")}`}>
                  {formatLifeGoalStatus(lifeGoal?.status ?? "SEM_OBJETIVO")}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/56">Total planejado</p>
                    <p className="text-3xl font-black text-white">
                      {formatCurrency(lifeGoal?.summary.valorTotalObjetivos ?? 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/56">Progresso do painel</p>
                    <p className="text-2xl font-black text-emerald-200">
                      {(lifeGoal?.summary.percentualTotal ?? 0).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#f59e0b)] shadow-[0_0_28px_rgba(16,185,129,0.42)] transition-[width] duration-[1400ms] ease-out"
                    style={{ width: `${Math.min(animatedProgress, 100)}%` }}
                  />
                </div>

                <div className="grid gap-3 text-sm text-white/62 sm:grid-cols-3">
                  <MiniInfo label="Desde" value={formatDateLabel(lifeGoal?.tracking.startedAt)} />
                  <MiniInfo label="Proxima data" value={formatDateLabel(lifeGoal?.tracking.closestDeadlineAt)} />
                  <MiniInfo label="Dias restantes" value={String(lifeGoal?.tracking.daysToClosestDeadline ?? 0)} />
                </div>

                <p className="rounded-2xl border border-emerald-300/14 bg-emerald-400/8 px-4 py-3 text-sm leading-6 text-emerald-50/90">
                  {lifeGoal?.summary.quantidadeObjetivos
                    ? `Voce esta a ${formatCurrency(remainingToLifeGoal)} de ${primaryLifeGoalLabel}.`
                    : "Comece cadastrando seus objetivos e o motivo do seu trabalho para transformar venda em conquista pessoal."}
                </p>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <BreakdownCard
            icon={<DollarSign className="h-5 w-5 text-cyan-200" />}
            title="Comissao"
            value={formatCurrency(lifeGoal?.ganhos.comissao ?? 0)}
            description={
              lifeGoal?.ganhos.comissaoOrigem === "oracle"
                ? `Valor real da sua comissao a pagar, com base em ${formatCurrency(lifeGoal?.ganhos.faturamentoConsiderado ?? 0)} de receita acumulada.`
                : lifeGoal?.ganhos.comissaoOrigem === "indisponivel"
                  ? "Comissao real indisponivel no momento. Configure o acesso ao Oracle para exibir o valor correto."
                  : `Estimativa baseada em ${formatCurrency(lifeGoal?.ganhos.faturamentoConsiderado ?? 0)} de faturamento considerado.`
            }
            accent="from-cyan-400/22 via-cyan-400/10 to-transparent"
          />
          <BreakdownCard
            icon={<Coins className="h-5 w-5 text-amber-200" />}
            title="Bonus"
            value={formatCurrency(lifeGoal?.ganhos.bonus ?? 0)}
            description="Recompensas liberadas em campanhas de bonus que ja cairam no seu caminho."
            accent="from-amber-400/22 via-amber-400/10 to-transparent"
          />
          <BreakdownCard
            icon={<Swords className="h-5 w-5 text-emerald-200" />}
            title="Desafios"
            value={formatCurrency(lifeGoal?.ganhos.desafios ?? 0)}
            description="Premios ja conquistados em desafios aceitos e concluidos."
            accent="from-emerald-400/22 via-emerald-400/10 to-transparent"
          />
        </section>

        <MotivationSpotlight message={motivationMessage} />

        <LifeGoalWizard
          open={wizardOpen}
          saving={wizardSaving}
          step={wizardStep}
          profileForm={profileForm}
          objectives={wizardObjectives}
          generatedObjectiveSummary={generatedObjectiveSummary}
          needsAttention={isWizardSetupIncomplete(lifeGoal)}
          onOpen={() => openWizardAt(0)}
          onClose={() => setWizardOpen(false)}
          onBack={handleWizardBack}
          onNext={handleWizardNext}
          onProfileChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
          onObjectiveChange={updateObjectiveDraft}
          onObjectiveAdd={addObjectiveDraft}
          onObjectiveRemove={removeObjectiveDraft}
        />

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-white">Seu resumo</h3>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <EmotionCard
                icon={<HeartHandshake className="h-5 w-5 text-cyan-200" />}
                title="Voce trabalha por"
                value={lifeGoal?.profile?.motivoTrabalho ?? "Seu motivo ainda nao foi registrado."}
              />
              <EmotionCard
                icon={<UserRound className="h-5 w-5 text-emerald-200" />}
                title="Para quem voce trabalha"
                value={lifeGoal?.profile?.paraQuemTrabalha ?? "Conte quem avanca junto com voce."}
              />
              <EmotionCard
                icon={<Target className="h-5 w-5 text-amber-200" />}
                title="Seu objetivo emocional"
                value={generatedObjectiveSummary}
              />
            </div>

            <p className="mt-5 rounded-[24px] border border-emerald-300/14 bg-emerald-400/8 px-4 py-4 text-sm leading-6 text-emerald-50/90">
              Cada venda esta te levando mais perto disso. O SIP agora usa essa historia para te lembrar, ao longo do sistema, que meta boa e meta que muda a vida.
            </p>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
            <h3 className="text-2xl font-black text-white">Leitura rapida</h3>

            <div className="mt-6 space-y-3">
              <MiniInfo label="Objetivo principal" value={primaryLifeGoalLabel} />
              <MiniInfo label="Quanto falta para ele" value={formatCurrency(remainingToLifeGoal)} />
              <MiniInfo
                label="Momento do painel"
                value={lifeGoal?.status === "CONQUISTADA" ? "Objetivo coberto" : "Jornada em andamento"}
              />
            </div>

            <p className="mt-5 text-sm leading-6 text-white/64">
              {remainingToLifeGoal > 0
                ? `Voce ja colocou ${formatCurrency(lifeGoal?.summary.ganhoTotal ?? 0)} nessa historia. O que entra agora encurta o caminho para ${primaryLifeGoalLabel}.`
                : "Seu painel pessoal ja foi financiado. Agora voce pode escolher a proxima conquista sem perder o ritmo."}
            </p>
          </section>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-white">Seus objetivos</h3>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/72">
              {lifeGoal?.summary.quantidadeObjetivos ?? 0} objetivo{(lifeGoal?.summary.quantidadeObjetivos ?? 0) > 1 ? "s" : ""}
            </div>
          </div>

          {lifeGoal?.objectives.length ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <MiniInfo label="Soma total" value={formatCurrency(lifeGoal.summary.valorTotalObjetivos)} />
                <MiniInfo label="Conquistado" value={formatCurrency(lifeGoal.summary.ganhoTotal)} />
                <MiniInfo label="Ainda falta" value={formatCurrency(lifeGoal.summary.faltaTotal)} />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {lifeGoal.objectives.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    onEdit={() => openWizardAt(3)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[26px] border border-dashed border-white/12 bg-white/[0.03] px-5 py-6 text-sm leading-7 text-white/64">
              Voce ainda nao cadastrou objetivos ativos. Abra o wizard, escolha uma conquista real e deixe o sistema lembrar diariamente do que vale a pena perseguir.
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-white">Plano de acao</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <PlanActionCard
              icon={<Flame className="h-5 w-5 text-amber-200" />}
              title="Seu dia fica resolvido com um plano simples"
              description={
                actionBurst?.label
                  ? actionBurst.label
                  : dailyActionTarget > 0
                    ? `Se voce vender ${formatCurrency(dailyActionTarget)} por dia, a jornada continua sob controle.`
                    : "Cadastre seus objetivos para o SIP montar a conta ideal do dia."
              }
            />
            <PlanActionCard
              icon={<Target className="h-5 w-5 text-emerald-200" />}
              title="Oportunidades abertas no seu radar"
              description={
                preferredOpenQuotes?.count
                  ? `Voce tem ${preferredOpenQuotes.count} orcamento${preferredOpenQuotes.count > 1 ? "s" : ""} em aberto${preferredOpenQuotes.category ? ` em ${preferredOpenQuotes.category}` : ""}, somando ${formatCurrency(preferredOpenQuotes.value)}.`
                  : "As oportunidades mais alinhadas ao seu perfil vao aparecer aqui conforme os dados comerciais entrarem."
              }
            />
            <PlanActionCard
              icon={<Swords className="h-5 w-5 text-cyan-200" />}
              title="Clientes campeoes podem acelerar seu objetivo"
              description={
                championOpportunity?.topChampionValue
                  ? `${championOpportunity.championsWithOpenQuotes || championOpportunity.championsCount} cliente${(championOpportunity.championsWithOpenQuotes || championOpportunity.championsCount) > 1 ? "s" : ""} campeao${(championOpportunity.championsWithOpenQuotes || championOpportunity.championsCount) > 1 ? "s" : ""} estao no radar e podem gerar pelo menos ${formatCurrency(championOpportunity.topChampionValue)}${championOpportunity.topChampionName ? ` com destaque para ${championOpportunity.topChampionName}` : ""}.`
                  : "Assim que houver leitura de clientes campeoes com oportunidade, o SIP mostra aqui onde atacar primeiro."
              }
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <MessagePanel
            icon={<Trophy className="h-5 w-5 text-amber-200" />}
            title="Sugestoes"
            subtitle="Seu plano para chegar la"
            messages={lifeGoal?.suggestions ?? []}
          />
          <MessagePanel
            icon={<Sparkles className="h-5 w-5 text-emerald-200" />}
            title="Oportunidades"
            subtitle="Leituras inteligentes do seu momento"
            messages={lifeGoal?.recommendations ?? []}
          />
        </section>

        <footer className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/58">
          <p>
            {lifeGoal?.summary.quantidadeObjetivos
              ? `Seu painel pessoal conecta ${lifeGoal.summary.quantidadeObjetivos} objetivo${lifeGoal.summary.quantidadeObjetivos > 1 ? "s" : ""} ao resultado comercial do ciclo.`
              : "Defina seu perfil e comece a transformar vendas em um painel pessoal de conquistas."}
          </p>
          <button
            type="button"
            onClick={() => void refreshPanel()}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-medium text-white/74 transition-colors hover:bg-white/6 hover:text-white"
          >
            Atualizar leitura
          </button>
        </footer>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  description,
  accent,
}: {
  label: string
  value: string
  description: string
  accent: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">{label}</p>
      <p className={`mt-3 text-2xl font-black ${accent}`}>{value}</p>
      <p className="mt-2 text-sm text-white/56">{description}</p>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  )
}

function EmotionCard({
  icon,
  title,
  value,
}: {
  icon: ReactNode
  title: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">{title}</p>
          <p className="mt-2 text-sm leading-6 text-white/78">{value}</p>
        </div>
      </div>
    </div>
  )
}

function PlanActionCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-white/64">{description}</p>
        </div>
      </div>
    </div>
  )
}

function ObjectiveCard({ objective, onEdit }: { objective: LifeGoalObjective; onEdit: () => void }) {
  return (
    <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">Objetivo</p>
          <h4 className="mt-2 text-xl font-black text-white">{objective.nomeObjetivo ?? "Sem nome"}</h4>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(objective.status)}`}>
          {formatLifeGoalStatus(objective.status)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniInfo label="Valor" value={formatCurrency(objective.valorObjetivo)} />
        <MiniInfo label="Conquistado" value={formatCurrency(objective.totalConquistado)} />
        <MiniInfo label="Restante" value={formatCurrency(objective.valorRestante)} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/46">
          <span>Progresso</span>
          <span>{objective.percentualConquistado.toFixed(1)}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#34d399,#f59e0b)] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.min(objective.percentualConquistado, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-white/58">Data limite: {formatDateLabel(objective.dataLimite)}</p>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/72 transition-colors hover:bg-white/6 hover:text-white"
        >
          Ajustar no wizard
        </button>
      </div>
    </article>
  )
}

function MessagePanel({
  icon,
  title,
  subtitle,
  messages,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  messages: LifeGoalMessage[]
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">{title}</p>
          <h3 className="mt-2 text-xl font-black text-white">{subtitle}</h3>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">
              {message.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/76">{message.message}</p>
            {message.actionHref && message.actionLabel ? (
              <Link
                href={message.actionHref}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition-colors hover:bg-emerald-400/16"
              >
                {message.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownCard({
  icon,
  title,
  value,
  description,
  accent,
}: {
  icon: ReactNode
  title: string
  value: string
  description: string
  accent: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,0.94),rgba(9,17,30,0.86))] p-5">
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          {icon}
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">{title}</p>
        <p className="mt-3 text-2xl font-black text-white">{value}</p>
        <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
      </div>
    </div>
  )
}
