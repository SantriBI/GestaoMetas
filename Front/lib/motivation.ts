import type { LifeGoalObjective, LifeGoalResponse } from "@/lib/life-goal"
import type { AuthUser } from "@/lib/user-session"

export type MotivationTone = "emerald" | "sky" | "amber" | "violet"

export type MotivationContextName =
  | "dashboard"
  | "ranking"
  | "attack"
  | "challenges"
  | "life-goal"

export interface MotivationContextInput {
  context: MotivationContextName
  dailyGap?: number | null
  openQuotes?: number | null
  openQuoteValue?: number | null
  championValue?: number | null
  rankPosition?: number | null
  totalRanked?: number | null
  availableReward?: number | null
  unlockedReward?: number | null
  averageTicket?: number | null
}

export interface MotivationMessage {
  eyebrow: string
  headline: string
  body: string
  badge: string
  tone: MotivationTone
  highlights: string[]
  ctaLabel?: string | null
  ctaHref?: string | null
}

function formatWholeCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function getFirstName(user?: Pick<AuthUser, "nome"> | null, goal?: LifeGoalResponse | null) {
  const fullName = String(user?.nome ?? goal?.seller.nomeVendedor ?? "Vendedor").trim()
  return fullName.split(/\s+/).filter(Boolean)[0] ?? "Vendedor"
}

export function getPrimaryLifeGoalObjective(goal?: LifeGoalResponse | null): LifeGoalObjective | null {
  if (!goal) return null
  if (goal.objective) return goal.objective
  return goal.objectives.find((objective) => objective.status === "EM_ANDAMENTO") ?? goal.objectives[0] ?? null
}

export function getLifeGoalLabel(goal?: LifeGoalResponse | null) {
  const objective = getPrimaryLifeGoalObjective(goal)
  if (objective?.nomeObjetivo?.trim()) {
    return objective.nomeObjetivo.trim()
  }

  const fallback = goal?.profile?.objetivosPessoais?.trim()
  if (fallback) {
    return fallback
  }

  return "sua proxima conquista"
}

function getLifeGoalReference(label: string) {
  const normalizedLabel = String(label ?? "").trim()
  if (!normalizedLabel || normalizedLabel === "sua proxima conquista") {
    return "sua proxima conquista"
  }

  return `seu objetivo de ${normalizedLabel}`
}

export function getLifeGoalRemaining(goal?: LifeGoalResponse | null) {
  return Math.max(Number(goal?.summary.faltaTotal ?? 0), 0)
}

export function getLifeGoalProgress(goal?: LifeGoalResponse | null) {
  return Math.min(Math.max(Number(goal?.summary.percentualTotal ?? 0), 0), 100)
}

export function getMotivationBadge(goal?: LifeGoalResponse | null, context?: MotivationContextInput) {
  const progress = getLifeGoalProgress(goal)
  const hasDailyGap = context?.dailyGap !== null && context?.dailyGap !== undefined
  const dailyGap = Number(context?.dailyGap ?? 0)

  if (progress >= 100) return "Objetivo coberto"
  if (progress >= 85) return "Meta quase batida"
  if (hasDailyGap && dailyGap <= 0 && context?.context === "dashboard") return "Dia forte de vendas"
  if (progress >= 60) return "Voce esta perto"
  return "Jornada em andamento"
}

export function getSuggestedTicketValue(goal?: LifeGoalResponse | null, context?: MotivationContextInput) {
  const averageTicket = Number(context?.averageTicket ?? 0)
  if (averageTicket > 0) {
    return averageTicket
  }

  const openQuotes = Number(context?.openQuotes ?? 0)
  const openQuoteValue = Number(context?.openQuoteValue ?? 0)
  if (openQuotes > 0 && openQuoteValue > 0) {
    return Number((openQuoteValue / openQuotes).toFixed(2))
  }

  const base = Number(goal?.simulator.valorBaseSugerido ?? 0)
  if (base > 0) {
    return base
  }

  const untilDeadline = Number(goal?.simulator.vendaDiariaNecessariaAtePrazo ?? 0)
  if (untilDeadline > 0) {
    return Number(Math.max(untilDeadline / 2, 0).toFixed(2))
  }

  return 0
}

export function buildSalesBurst(targetValue: number, goal?: LifeGoalResponse | null, context?: MotivationContextInput) {
  const remaining = Math.max(Number(targetValue ?? 0), 0)
  const ticketValue = getSuggestedTicketValue(goal, context)
  if (remaining <= 0 || ticketValue <= 0) {
    return null
  }

  const salesCount = Math.ceil(remaining / ticketValue)
  if (!Number.isFinite(salesCount) || salesCount <= 0 || salesCount > 9) {
    return null
  }

  return {
    salesCount,
    ticketValue,
    label: `${salesCount} venda${salesCount > 1 ? "s" : ""} de ${formatWholeCurrency(ticketValue)} resolvem isso`,
  }
}

function buildOnboardingMessage(firstName: string, context: MotivationContextInput): MotivationMessage {
  const contextMap: Record<MotivationContextName, { eyebrow: string; headline: string; body: string; tone: MotivationTone }> = {
    dashboard: {
      eyebrow: "Motor de motivacao",
      headline: `${firstName}, conecte seu resultado ao que importa fora do trabalho.`,
      body: "Ative sua Meta de Vida para transformar o painel em algo que lembra seu motivo, seus objetivos e o impacto de cada venda.",
      tone: "emerald",
    },
    ranking: {
      eyebrow: "Ranking com proposito",
      headline: `${firstName}, o ranking fica mais forte quando ele aponta para a sua vida.`,
      body: "Cadastre seu motivo, para quem voce trabalha e seus objetivos para receber leituras motivacionais enquanto sobe de posicao.",
      tone: "sky",
    },
    attack: {
      eyebrow: "Ataque com sentido",
      headline: `${firstName}, suas oportunidades ficam mais claras quando voce sabe o por que.`,
      body: "Ative sua Meta de Vida para cruzar oportunidades, clientes e metas pessoais no mesmo fluxo.",
      tone: "amber",
    },
    challenges: {
      eyebrow: "Desafios com destino",
      headline: `${firstName}, aceite campanhas sabendo o que elas destravam na sua vida.`,
      body: "Com seu perfil completo, o SIP passa a mostrar quanto cada desafio aproxima seus objetivos pessoais.",
      tone: "violet",
    },
    "life-goal": {
      eyebrow: "Comece sua jornada",
      headline: `${firstName}, vamos dar um motivo real para o seu mes.`,
      body: "Responda algumas perguntas, conte o que voce quer conquistar e transforme a Meta de Vida no seu painel mais humano.",
      tone: "emerald",
    },
  }

  const selected = contextMap[context.context]

  return {
    eyebrow: selected.eyebrow,
    headline: selected.headline,
    body: selected.body,
    badge: "Ative sua historia",
    tone: selected.tone,
    highlights: [
      "Conte quanto voce quer ganhar no mes",
      "Mostre por quem voce trabalha",
      "Cadastre objetivos que valem a pena perseguir",
    ],
    ctaLabel: "Abrir Meta de Vida",
    ctaHref: "/vendedor/minha-meta-de-vida",
  }
}

export function buildMotivationMessage(
  user?: Pick<AuthUser, "nome"> | null,
  goal?: LifeGoalResponse | null,
  context?: MotivationContextInput
): MotivationMessage {
  const normalizedContext = context ?? { context: "dashboard" as const }
  const firstName = getFirstName(user, goal)

  if (!goal || (!goal.profile && !(goal.objectives?.length ?? 0))) {
    return buildOnboardingMessage(firstName, normalizedContext)
  }

  const label = getLifeGoalLabel(goal)
  const goalReference = getLifeGoalReference(label)
  const remaining = getLifeGoalRemaining(goal)
  const earned = Number(goal.summary.ganhoTotal ?? 0)
  const progress = getLifeGoalProgress(goal)
  const dailyGap = Math.max(Number(normalizedContext.dailyGap ?? 0), 0)
  const rankPosition = Number(normalizedContext.rankPosition ?? 0)
  const totalRanked = Number(normalizedContext.totalRanked ?? 0)
  const openQuotes = Number(normalizedContext.openQuotes ?? 0)
  const openQuoteValue = Number(normalizedContext.openQuoteValue ?? 0)
  const championValue = Number(normalizedContext.championValue ?? 0)
  const availableReward = Number(normalizedContext.availableReward ?? 0)
  const unlockedReward = Number(normalizedContext.unlockedReward ?? 0)
  const motivationReason = goal.profile?.motivoTrabalho?.trim()
  const motivationFor = goal.profile?.paraQuemTrabalha?.trim()
  const hasPersonalContext = Boolean(motivationReason || motivationFor)
  const objectiveCount = Number(goal.summary.quantidadeObjetivos ?? 0)
  const salesBurstForRemaining = buildSalesBurst(remaining, goal, normalizedContext)
  const salesBurstForDay = buildSalesBurst(dailyGap, goal, normalizedContext)
  const whyTail = hasPersonalContext
    ? "Lembre-se do que move voce e mantenha o foco na sua proxima conquista."
    : "Seu resultado esta virando conquista real."

  const baseHighlights = [
    remaining > 0 ? `Faltam ${formatWholeCurrency(remaining)} para conquistar ${goalReference}` : `${label} ja esta coberto`,
    salesBurstForRemaining?.label ?? `${progress.toFixed(1)}% da jornada ja conquistado`,
    objectiveCount > 1 ? `${objectiveCount} objetivos estao andando juntos` : "Sua jornada esta concentrada no que importa",
  ]

  switch (normalizedContext.context) {
    case "ranking":
      return {
        eyebrow: "Ranking com proposito",
        headline:
          rankPosition > 0
            ? `${firstName}, voce esta em ${rankPosition}° e cada cliente novo aproxima voce de seu objetivo.`
            : `${firstName}, sua posicao ainda esta entrando no radar, mas seu objetivo continua vivo.`,
        body:
          "Lembre-se do que move voce e mantenha o foco na sua proxima conquista.",
        badge: getMotivationBadge(goal, normalizedContext),
        tone: "sky",
        highlights: [
          rankPosition > 0 ? `Posicao atual: ${rankPosition}${totalRanked > 0 ? ` de ${totalRanked}` : ""}` : "Posicao em sincronizacao",
          ...baseHighlights.slice(0, 2),
        ],
        ctaLabel: "Ver jornada completa",
        ctaHref: "/vendedor/minha-meta-de-vida",
      }
    case "attack":
      return {
        eyebrow: "Area de Ataque",
        headline:
          openQuotes > 0
            ? `${firstName}, ${openQuotes} oportunidade${openQuotes > 1 ? "s" : ""} podem aproximar voce de ${goalReference} ainda hoje.`
            : `${firstName}, escolha o proximo contato com ${goalReference} em mente.`,
        body: championValue > 0
          ? `Clientes campeoes podem gerar ${formatWholeCurrency(championValue)} e encurtar sua jornada de forma rapida. ${whyTail}`
          : `${openQuoteValue > 0 ? `Ha ${formatWholeCurrency(openQuoteValue)} em orcamentos no radar. ` : ""}${whyTail}`,
        badge: getMotivationBadge(goal, normalizedContext),
        tone: "amber",
        highlights: [
          openQuotes > 0 ? `${openQuotes} orcamentos pedindo abordagem` : "Revise a carteira e priorize impacto",
          championValue > 0 ? `Clientes campeoes podem gerar ${formatWholeCurrency(championValue)}` : baseHighlights[0],
          salesBurstForRemaining?.label ?? baseHighlights[1],
        ],
        ctaLabel: "Abrir Meta de Vida",
        ctaHref: "/vendedor/minha-meta-de-vida",
      }
    case "challenges":
      return {
        eyebrow: "Desafios com destino",
        headline:
          availableReward > 0
            ? `${firstName}, essas campanhas podem financiar parte do caminho para ${goalReference}.`
            : `${firstName}, cada campanha aceita pode aproximar voce de ${goalReference}.`,
        body:
          unlockedReward > 0
            ? `Voce ja liberou ${formatWholeCurrency(unlockedReward)} em premio. Agora use os proximos desafios para ficar mais perto de ${goalReference}.`
            : `${availableReward > 0 ? `Ha ${formatWholeCurrency(availableReward)} em recompensa esperando decisao. ` : ""}${whyTail}`,
        badge: getMotivationBadge(goal, normalizedContext),
        tone: "violet",
        highlights: [
          availableReward > 0 ? `${formatWholeCurrency(availableReward)} em premio potencial` : "Campanhas ativas no seu radar",
          unlockedReward > 0 ? `${formatWholeCurrency(unlockedReward)} ja liberados` : baseHighlights[0],
          baseHighlights[1],
        ],
        ctaLabel: "Ver Meta de Vida",
        ctaHref: "/vendedor/minha-meta-de-vida",
      }
    case "life-goal":
      return {
        eyebrow: "Sua jornada",
        headline:
          remaining <= 0
            ? `${firstName}, voce ja cobriu ${goalReference}.`
            : `${firstName}, faltam ${formatWholeCurrency(remaining)} para voce conquistar ${goalReference}.`,
        body:
          remaining <= 0
            ? `Seu resultado comercial ja pagou seus objetivos ativos. Agora e hora de escolher a proxima conquista e continuar no embalo.`
            : `Voce ja transformou ${formatWholeCurrency(earned)} em progresso real. ${whyTail}`,
        badge: getMotivationBadge(goal, normalizedContext),
        tone: "emerald",
        highlights: [
          goal.profile?.rendaDesejada
            ? `Voce quer ganhar ${formatWholeCurrency(Number(goal.profile.rendaDesejada))} neste mes`
            : baseHighlights[0],
          salesBurstForRemaining?.label ?? baseHighlights[1],
          goal.tracking.daysToClosestDeadline > 0
            ? `${goal.tracking.daysToClosestDeadline} dias para a proxima data`
            : baseHighlights[2],
        ],
        ctaLabel: "Atualizar minha jornada",
        ctaHref: "#wizard-meta-de-vida",
      }
    case "dashboard":
    default:
      return {
        eyebrow: "Motor de motivacao",
        headline:
          dailyGap > 0
            ? `${firstName}, faltam ${formatWholeCurrency(dailyGap)} hoje para voce conquistar ${goalReference}.`
            : `${firstName}, o ritmo de hoje ja esta aproximando voce de ${goalReference}.`,
        body:
          dailyGap > 0
            ? `${salesBurstForDay?.label ? `${salesBurstForDay.label}. ` : ""}Pense nos seus objetivos e metas para ter garra de correr atras!`
            : "Seu resultado do dia soma forca ao seu objetivo maior. Continue firme nos seus objetivos.",
        badge: getMotivationBadge(goal, normalizedContext),
        tone: "emerald",
        highlights: [
          dailyGap > 0 ? `Faltam ${formatWholeCurrency(dailyGap)} para fechar a meta do dia` : "Meta do dia protegida",
          baseHighlights[0],
          salesBurstForRemaining?.label ?? baseHighlights[1],
        ],
        ctaLabel: "Ver minha Meta de Vida",
        ctaHref: "/vendedor/minha-meta-de-vida",
      }
  }
}
