export type ChallengeStatus =
  | "RASCUNHO"
  | "AGENDADO"
  | "ATIVO"
  | "ENCERRADO"
  | "ENCERRADO_AUTOMATICO"
  | "ENCERRADO_MANUAL"
  | "CANCELADO";
export type ParticipantStatus = "CONVIDADO" | "DISPONIVEL" | "ACEITO" | "EM_ANDAMENTO" | "CONCLUIDO" | "EXPIRADO" | "RECUSADO"
export type ChallengeMetaType = "FATURAMENTO" | "PEDIDOS_FECHADOS" | "CLIENTES_ATENDIDOS" | "RECUPERAR_CLIENTES" | "PRODUTO_OU_MARCA"
export type ChallengeCampaignKind = "DESAFIO" | "BONUS"

export interface ChallengeImpactMetrics {
  eligibleParticipants: number
  acceptedParticipants: number
  completedParticipants: number
  bonusPotential: number
  bonusPaid: number
  bonusRemainingPotential: number
  estimatedRevenue: number
  realizedRevenue: number
  estimatedOrders: number
  realizedOrders: number
  estimatedClients: number
  realizedClients: number
  estimatedRecoveredClients: number
  realizedRecoveredClients: number
  returnPerBonusPotential: number
  returnPerBonusRealized: number
  costPercentPotential: number
  costPercentRealized: number
  revenueCaptureRate: number
  bonusBurnRate: number
  estimationBasis: string
  realizationBasis: string
  referenceTicketMedio: number
  referenceReceitaPorCliente: number
  referenceWindowDays: number
  generatedAt?: string | null
}

export interface ChallengeModuleSetup {
  ready: boolean
  code: string | null
  error: string | null
  missingTables: string[]
  missingSequences: string[]
  scriptPath?: string | null
  sqlScript?: string | null
  instructions?: string[]
}

export interface SellerChallengeAlertItem {
  id: number | string
  titulo: string | null
  descricao?: string | null
  dataInicio?: string | Date | null
  dataFim?: string | Date | null
  brandNames?: string[]
  metas?: ChallengeMeta[]
  exigeAceite?: boolean
  status?: string | null
  participantStatus?: ParticipantStatus | string | null
}

export interface SellerChallengeAlertResponse {
  hasNewChallenge: boolean
  challenge: SellerChallengeAlertItem | null
  items?: SellerChallengeAlertItem[]
  mock?: boolean
}

type SellerCampaignSurfaceItem = {
  id: number | string
  dataInicio?: string | Date | null
  dataFim?: string | Date | null
  exigeAceite?: boolean | null
  status?: string | null
  participantStatus?: ParticipantStatus | string | null
  participant?: {
    statusParticipacao?: ParticipantStatus | string | null
  } | null
}

export interface ChallengeImpactPreviewResponse {
  impact: ChallengeImpactMetrics
  participantsPreview: {
    eligibleParticipants: number
    companies: number
  }
}

export type ChallengeMetricType = 'VALOR' | 'QUANTIDADE'

export interface ChallengeMeta {
  idMeta?: number
  idDesafio?: number
  tipoMeta: ChallengeMetaType
  metaValor: number
  unidadeMeta: string
  recompensaValor: number
  metricType?: ChallengeMetricType
  ordemExibicao: number
  config?: Record<string, unknown>
  progressoAtual?: number
  percentualConclusao?: number
  concluidoEm?: string | Date | null
  premioLiberado?: boolean
  premioValor?: number
  multiplier?: number
}

export interface ChallengeMetaTargetSummary {
  kind: "PRODUCT" | "BRAND" | "PRODUCT_OR_BRAND"
  label: string
  value: string
}

export interface ChallengeParticipant {
  id?: number
  skVendedor: number | string
  nomeVendedor: string | null
  statusParticipacao: ParticipantStatus
  visualizadoEm?: string | Date | null
  aceitoEm?: string | Date | null
  premioTotalLiberado: number
  concluidoEm?: string | Date | null
  ultimaAtualizacao?: string | Date | null
  metas?: ChallengeMeta[]
  resumo?: {
    totalMetas: number
    metasConcluidas: number
    percentualGeral: number
    premioTotalLiberado: number
  }
}

export interface Challenge {
  id: number
  empresaId?: number | string | null
  titulo: string | null
  descricao: string | null
  dataInicio: string | Date | null
  dataFim: string | Date | null
  status: ChallengeStatus
  exigeAceite: boolean
  criadoPor?: string | null
  criadoEm?: string | Date | null
  atualizadoEm?: string | Date | null
  metas: ChallengeMeta[]
  stats: {
    totalParticipants: number
    acceptedParticipants: number
    completedParticipants: number
    pendingParticipants: number
    progressAverage: number
    adherenceRate: number
    completionRate: number
    estimatedRewardTotal: number
  }
  impact: ChallengeImpactMetrics
  participant?: ChallengeParticipant
  participants?: ChallengeParticipant[]
  leaderboard?: Array<{
    posicao: number
    skVendedor: number | string
    nomeVendedor: string | null
    percentualConclusao: number
    premioTotalLiberado: number
  }>
  timeline?: Array<{
    evento: string | null
    descricao: string | null
    dataEvento: string | Date | null
  }>
  ctas?: Array<{
    label: string
    href: string
  }>
  mock?: boolean
}

export interface ChallengesResponse {
  items: Challenge[]
  summary: {
    activeChallenges: number
    totalParticipants?: number
    estimatedRewardTotal?: number
    paidRewardTotal?: number
    estimatedRevenueTotal?: number
    realizedRevenueTotal?: number
    estimatedOrdersTotal?: number
    realizedOrdersTotal?: number
    estimatedClientsTotal?: number
    realizedClientsTotal?: number
    returnPerBonusPotential?: number
    returnPerBonusRealized?: number
    adherenceRate?: number
    completionRate?: number
    completedChallenges?: number
    totalRewards?: number
    newChallenges?: number
  }
  initialization?: {
    ready: boolean
    code: string | null
    error: string | null
  }
  mock?: boolean
}

export interface ChallengeMetadata {
  metaTypes: ChallengeMetaType[]
  sellers: Array<{
    skVendedor: number | string
    nomeVendedor: string
    empresaId?: number | string | null
  }>
  themes: string[]
}

export interface ChallengeProductOption {
  produtoId: number | string
  nomeProduto: string
  nomeMarca?: string | null
}

export interface ChallengeBrandOption {
  marcaId: number | string
  nomeMarca: string
  nomeCategoria?: string | null
}

export interface ChallengeFormPayload {
  titulo: string
  descricao?: string | null
  dataInicio: string
  dataFim: string
  exigeAceite?: boolean
  empresaId?: number | string | null
  sellerIds?: Array<number | string>
  criadoPor?: string
  metas: ChallengeMeta[]
}

export class ChallengeApiError extends Error {
  code: string | null
  details: unknown
  status: number
  payload: unknown

  constructor(message: string, options?: { code?: string | null; details?: unknown; status?: number; payload?: unknown }) {
    super(message)
    this.name = "ChallengeApiError"
    this.code = options?.code ?? null
    this.details = options?.details ?? null
    this.status = options?.status ?? 500
    this.payload = options?.payload ?? null
  }
}

export const metaTypeLabels: Record<ChallengeMetaType, string> = {
  FATURAMENTO: "Faturamento",
  PEDIDOS_FECHADOS: "Pedidos fechados",
  CLIENTES_ATENDIDOS: "Clientes atendidos",
  RECUPERAR_CLIENTES: "Recuperar clientes",
  PRODUTO_OU_MARCA: "Produto ou marca",
}

export function getMetaTypeLabel(type: ChallengeMetaType | string | null | undefined) {
  return metaTypeLabels[type as ChallengeMetaType] ?? "Meta"
}

export function getChallengeStatusLabel(status: ChallengeStatus) {
  const labels: Record<ChallengeStatus, string> = {
    RASCUNHO: "Rascunho",
    AGENDADO: "Agendado",
    ATIVO: "Ativo",
    ENCERRADO: "Encerrado",
    ENCERRADO_AUTOMATICO: "Encerrado",
    ENCERRADO_MANUAL: "Encerrado manual",
    CANCELADO: "Cancelado",
  }
  return labels[status]
}

function normalizeChallengeStatusValue(value: unknown): ChallengeStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (["RASCUNHO", "AGENDADO", "ATIVO", "ENCERRADO", "ENCERRADO_AUTOMATICO", "ENCERRADO_MANUAL", "CANCELADO"].includes(normalized)) {
    return normalized as ChallengeStatus
  }

  return null
}

export function isEndedChallengeStatus(status: ChallengeStatus | string | null | undefined) {
  const normalized = String(status ?? "").trim().toUpperCase()
  return ["ENCERRADO", "ENCERRADO_AUTOMATICO", "ENCERRADO_MANUAL"].includes(normalized)
}

export function isClosedChallengeStatus(status: ChallengeStatus | string | null | undefined) {
  return isEndedChallengeStatus(status) || String(status ?? "").trim().toUpperCase() === "CANCELADO"
}

export function getParticipantStatusLabel(status: ParticipantStatus) {
  const labels: Record<ParticipantStatus, string> = {
    CONVIDADO: "Convidado",
    DISPONIVEL: "Disponivel",
    ACEITO: "Aceito",
    EM_ANDAMENTO: "Em andamento",
    CONCLUIDO: "Concluido",
    EXPIRADO: "Expirado",
    RECUSADO: "Recusado",
  }
  return labels[status]
}

export function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0)
}

const challengeCalendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function buildChallengeCalendarDate(dateToken: string) {
  const [year, month, day] = dateToken.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function normalizeChallengeCalendarDate(value: string | Date | null | undefined) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
  }

  const raw = String(value).trim()
  const match = challengeCalendarDatePattern.exec(raw)
  if (match) {
    const normalized = `${match[1]}-${match[2]}-${match[3]}`
    return buildChallengeCalendarDate(normalized) ? normalized : null
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
}

export function getChallengeDateInputValue(value: string | Date | null | undefined) {
  return normalizeChallengeCalendarDate(value) ?? ""
}

export function parseChallengeDateTime(value: string | Date | null | undefined, edge: "start" | "end" = "start") {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value)
  }

  const raw = String(value).trim()
  if (challengeCalendarDatePattern.test(raw)) {
    return new Date(`${raw}T${edge === "end" ? "23:59:59.999" : "00:00:00.000"}`)
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function compareChallengeDateValues(
  left: string | Date | null | undefined,
  right: string | Date | null | undefined
) {
  const normalizedLeft = normalizeChallengeCalendarDate(left)
  const normalizedRight = normalizeChallengeCalendarDate(right)
  if (!normalizedLeft || !normalizedRight) return Number.NaN
  return normalizedLeft.localeCompare(normalizedRight)
}

export function formatDateBR(value: string | Date | null | undefined) {
  const normalizedValue = normalizeChallengeCalendarDate(value)
  if (!normalizedValue) return "-"
  const date = buildChallengeCalendarDate(normalizedValue)
  if (!date) return "-"
  return date.toLocaleDateString("pt-BR")
}

export function getChallengeLifecycleStatus(
  challenge: Pick<Challenge, "status" | "dataInicio" | "dataFim">,
  now = new Date()
): ChallengeStatus {
  const persistedStatus = normalizeChallengeStatusValue(challenge.status)
  if (persistedStatus === "CANCELADO") return "CANCELADO"
  if (persistedStatus === "ENCERRADO_MANUAL" || persistedStatus === "ENCERRADO") return "ENCERRADO_MANUAL"

  const startValue = getChallengeDateInputValue(challenge.dataInicio)
  const endValue = getChallengeDateInputValue(challenge.dataFim)
  const start = startValue ? parseChallengeDateTime(startValue, "start") : null
  const end = endValue ? parseChallengeDateTime(endValue, "end") : null
  if (!start || !end || Number.isNaN(now.getTime())) return persistedStatus ?? "RASCUNHO"

  if (now.getTime() < start.getTime()) return "AGENDADO"
  if (now.getTime() > end.getTime()) return "ENCERRADO_AUTOMATICO"
  return "ATIVO"
}

export function getChallengeLifecycleLabel(
  challenge: Pick<Challenge, "status" | "dataInicio" | "dataFim">,
  now = new Date()
) {
  const lifecycleStatus = getChallengeLifecycleStatus(challenge, now)

  if (lifecycleStatus === "AGENDADO") {
    const startValue = getChallengeDateInputValue(challenge.dataInicio)
    const start = startValue ? parseChallengeDateTime(startValue, "start") : null
    if (!start) return "Agendado"
    const daysUntilStart = Math.max(Math.ceil((start.getTime() - now.getTime()) / 86400000), 0)
    return daysUntilStart <= 1 ? "Comeca em 1 dia" : `Comeca em ${daysUntilStart} dias`
  }

  if (lifecycleStatus === "ATIVO") {
    const endValue = getChallengeDateInputValue(challenge.dataFim)
    const end = endValue ? parseChallengeDateTime(endValue, "end") : null
    if (!end) return "Ativo"
    const remainingMs = end.getTime() - now.getTime()
    const remainingDays = remainingMs / 86400000
    if (remainingDays > 0 && remainingDays <= 1) return "Ultimas 24h"
    const wholeRemainingDays = Math.max(Math.ceil(remainingMs / 86400000), 0)
    if (wholeRemainingDays > 1) return `Termina em ${wholeRemainingDays} dias`
    return "Ativo"
  }

  if (lifecycleStatus === "ENCERRADO_MANUAL") {
    return "Encerrado manualmente"
  }

  if (isEndedChallengeStatus(lifecycleStatus)) {
    return `Encerrado em ${formatDateBR(challenge.dataFim)}`
  }

  if (lifecycleStatus === "CANCELADO") {
    return "Campanha cancelada"
  }

  return "Rascunho em configuracao"
}

export function formatMetaValue(meta: Pick<ChallengeMeta, "metaValor" | "unidadeMeta" | "tipoMeta" | "metricType">) {
  if (meta.metricType === "QUANTIDADE") return `${meta.metaValor} ${meta.unidadeMeta ?? "itens"}`.trim()
  if (meta.tipoMeta === "FATURAMENTO" || meta.tipoMeta === "PRODUTO_OU_MARCA") return formatCurrencyBRL(meta.metaValor)
  return `${meta.metaValor} ${meta.unidadeMeta ?? ""}`.trim()
}

export function formatMetaProgressValue(meta: Pick<ChallengeMeta, "progressoAtual" | "unidadeMeta" | "tipoMeta" | "metricType">) {
  if (meta.metricType === "QUANTIDADE") return `${meta.progressoAtual ?? 0} ${meta.unidadeMeta ?? "itens"}`.trim()
  if (meta.tipoMeta === "FATURAMENTO" || meta.tipoMeta === "PRODUTO_OU_MARCA") {
    return formatCurrencyBRL(Number(meta.progressoAtual ?? 0))
  }

  return `${meta.progressoAtual ?? 0} ${meta.unidadeMeta ?? ""}`.trim()
}

function normalizeChallengeMetaTargetType(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (["PRODUCT", "BRAND", "PRODUCT_OR_BRAND", "CATEGORY"].includes(normalized)) {
    return normalized
  }

  return null
}

function extractLegacyChallengeTargetValue(rawValue: unknown, kind: "PRODUCT" | "BRAND") {
  const raw = String(rawValue ?? "").trim()
  if (!raw) return ""

  const prefix = kind === "PRODUCT" ? "produto" : "marca"
  const cleaned = raw.replace(new RegExp(`^${prefix}\\s+(?:\\d+\\s*-\\s*)?`, "i"), "").trim()
  return cleaned || raw
}

function resolveChallengeMetaTargetValue(config: Record<string, unknown>, kind: "PRODUCT" | "BRAND", targetType: string | null) {
  const configuredName = String(kind === "PRODUCT" ? config.productName ?? "" : config.brandName ?? "").trim()
  const configuredId = String(kind === "PRODUCT" ? config.productId ?? "" : config.brandId ?? "").trim()
  const legacyValue = String(config.targetValue ?? "").trim()

  if (configuredId && configuredName) return `${configuredId} - ${configuredName}`
  if (configuredName) return configuredName
  if (targetType === kind && legacyValue) {
    return extractLegacyChallengeTargetValue(legacyValue, kind)
  }
  if (configuredId) return configuredId
  return ""
}

export function getChallengeMetaTargetSummary(meta: Pick<ChallengeMeta, "tipoMeta" | "config">): ChallengeMetaTargetSummary | null {
  if (meta.tipoMeta !== "PRODUTO_OU_MARCA") return null

  const config = meta.config ?? {}
  const targetType = normalizeChallengeMetaTargetType(config.targetType)
  const productValue = resolveChallengeMetaTargetValue(config, "PRODUCT", targetType)
  const brandValue = resolveChallengeMetaTargetValue(config, "BRAND", targetType)

  if (targetType === "PRODUCT" && productValue) {
    return { kind: "PRODUCT", label: "Produto alvo", value: productValue }
  }

  if (targetType === "BRAND" && brandValue) {
    return { kind: "BRAND", label: "Marca alvo", value: brandValue }
  }

  if (productValue && brandValue) {
    return { kind: "PRODUCT_OR_BRAND", label: "Produto ou marca", value: `Produto ${productValue} | Marca ${brandValue}` }
  }

  if (productValue) {
    return { kind: "PRODUCT", label: "Produto alvo", value: productValue }
  }

  if (brandValue) {
    return { kind: "BRAND", label: "Marca alvo", value: brandValue }
  }

  const legacyValue = String(config.targetValue ?? "").trim()
  if (!legacyValue) return null

  return {
    kind: "PRODUCT_OR_BRAND",
    label: "Produto ou marca",
    value: legacyValue,
  }
}

export function getChallengeMetaFocusLabel(meta: Pick<ChallengeMeta, "tipoMeta" | "config">) {
  const target = getChallengeMetaTargetSummary(meta)
  if (!target) return null

  if (target.kind === "PRODUCT") return `Produto ${target.value}`
  if (target.kind === "BRAND") return `Marca ${target.value}`
  return target.value
}

export function hasChallengeMetaTarget(meta: Pick<ChallengeMeta, "tipoMeta" | "config">) {
  if (meta.tipoMeta !== "PRODUTO_OU_MARCA") return true
  return Boolean(getChallengeMetaFocusLabel(meta))
}

export function getChallengeCampaignKind(challenge: { exigeAceite?: boolean | null }): ChallengeCampaignKind {
  return challenge.exigeAceite === false ? "BONUS" : "DESAFIO"
}

export function getChallengeCampaignKindLabel(kind: ChallengeCampaignKind) {
  return kind === "BONUS" ? "Bonus" : "Desafio"
}

function normalizeChallengeBrandName(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function extractChallengeBrandNames(metas?: Array<Pick<ChallengeMeta, "config">> | null, brandNames?: Array<string | null | undefined>) {
  const configuredBrandNames = (metas ?? []).map((meta) => {
    const directBrandName = String(meta.config?.brandName ?? "").trim()
    if (directBrandName) return directBrandName

    const target = getChallengeMetaTargetSummary({ tipoMeta: "PRODUTO_OU_MARCA", config: meta.config })
    if (!target) return ""
    if (target.kind === "BRAND") return target.value

    const combinedBrandMatch = target.value.match(/Marca\s+(.+)$/i)
    return combinedBrandMatch?.[1]?.trim() ?? ""
  })
  return [...(brandNames ?? []), ...configuredBrandNames]
    .map(normalizeChallengeBrandName)
    .filter(Boolean)
}

export function getChallengeBannerAsset(input: {
  title?: string | null
  metas?: Array<Pick<ChallengeMeta, "config">> | null
  brandNames?: Array<string | null | undefined>
} | string | null | undefined) {
  const title = typeof input === "string" || input == null ? input : input.title
  const metas = typeof input === "object" && input ? input.metas : undefined
  const brandNames = typeof input === "object" && input ? input.brandNames : undefined
  const normalizedTitle = String(title ?? "").trim().toLowerCase()
  const normalizedBrandNames = extractChallengeBrandNames(metas, brandNames)

  if (normalizedBrandNames.includes("SUVINIL") || normalizedTitle.includes("suvinil")) {
    return {
      src: "/BannerDesafio.png",
      alt: "Banner do desafio Suvinil",
    }
  }

  return {
    src: "/BannerDesafioGeral.png",
    alt: "Banner do desafio",
  }
}

export function isSellerChallengeAvailable(challenge: Pick<Challenge, "exigeAceite" | "participant">) {
  return getChallengeCampaignKind(challenge) === "DESAFIO" && ["DISPONIVEL", "CONVIDADO"].includes(String(challenge.participant?.statusParticipacao ?? "").toUpperCase())
}

export function isSellerChallengeAccepted(challenge: Pick<Challenge, "exigeAceite" | "participant">) {
  return getChallengeCampaignKind(challenge) === "DESAFIO" && ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO"].includes(String(challenge.participant?.statusParticipacao ?? "").toUpperCase())
}

export function isSellerBonus(challenge: Pick<Challenge, "exigeAceite">) {
  return getChallengeCampaignKind(challenge) === "BONUS"
}

export function getSellerCampaignParticipantStatus(challenge: Pick<SellerCampaignSurfaceItem, "participantStatus" | "participant">) {
  return String(challenge.participant?.statusParticipacao ?? challenge.participantStatus ?? "").toUpperCase()
}

export function shouldShowSellerCampaignBanner(
  challenge: Pick<SellerCampaignSurfaceItem, "status" | "dataInicio" | "dataFim" | "participantStatus" | "participant">
) {
  const status = getChallengeLifecycleStatus(challenge as Pick<Challenge, "status" | "dataInicio" | "dataFim">)
  const participantStatus = getSellerCampaignParticipantStatus(challenge)

  return ["ATIVO", "AGENDADO"].includes(status) && participantStatus !== "RECUSADO"
}

export function getSellerCampaignNotificationId(
  challenge: Pick<SellerCampaignSurfaceItem, "id" | "exigeAceite">,
  skVendedor?: number | string | null
) {
  const sellerKey = String(skVendedor ?? "vendedor")
  const prefix = getChallengeCampaignKind(challenge) === "BONUS" ? "seller-bonus" : "seller-challenge"
  return `${prefix}-${sellerKey}-${challenge.id}`
}

export function getSellerCampaignNotificationPrefixes(skVendedor?: number | string | null) {
  const sellerKey = String(skVendedor ?? "vendedor")
  return [`seller-challenge-${sellerKey}-`, `seller-bonus-${sellerKey}-`] as const
}

export function getTotalReward(challenge: Pick<Challenge, "metas">) {
  return challenge.metas.reduce((sum, meta) => sum + (Number(meta.recompensaValor) || 0), 0)
}

export function aggregateChallengesSummary(items: Challenge[]): ChallengesResponse["summary"] {
  const totals = items.reduce(
    (accumulator, challenge) => {
      const impact = challenge.impact
      const stats = challenge.stats
      const totalParticipants = Number(stats?.totalParticipants ?? challenge.participants?.length ?? 0)
      const acceptedParticipants = Number(stats?.acceptedParticipants ?? 0)
      const completedParticipants = Number(stats?.completedParticipants ?? 0)
      const potentialReward = Number(impact?.bonusPotential ?? stats?.estimatedRewardTotal ?? getTotalReward(challenge))
      const paidReward = Number(impact?.bonusPaid ?? 0)
      const potentialRevenue = Number(impact?.estimatedRevenue ?? 0)
      const realizedRevenue = Number(impact?.realizedRevenue ?? 0)

      accumulator.totalParticipants += totalParticipants
      accumulator.acceptedParticipants += acceptedParticipants
      accumulator.completedParticipants += completedParticipants
      accumulator.estimatedRewardTotal += potentialReward
      accumulator.paidRewardTotal += paidReward
      accumulator.estimatedRevenueTotal += potentialRevenue
      accumulator.realizedRevenueTotal += realizedRevenue
      accumulator.estimatedOrdersTotal += Number(impact?.estimatedOrders ?? 0)
      accumulator.realizedOrdersTotal += Number(impact?.realizedOrders ?? 0)
      accumulator.estimatedClientsTotal += Number(impact?.estimatedClients ?? 0)
      accumulator.realizedClientsTotal += Number(impact?.realizedClients ?? 0)
      const lifecycleStatus = getChallengeLifecycleStatus(challenge)
      accumulator.activeChallenges += lifecycleStatus === "ATIVO" ? 1 : 0
      accumulator.completedChallenges += isEndedChallengeStatus(lifecycleStatus) ? 1 : 0
      accumulator.newChallenges += lifecycleStatus === "RASCUNHO" || lifecycleStatus === "AGENDADO" ? 1 : 0
      accumulator.completionRateSum += Number(stats?.completionRate ?? 0)

      return accumulator
    },
    {
      activeChallenges: 0,
      totalParticipants: 0,
      acceptedParticipants: 0,
      completedParticipants: 0,
      estimatedRewardTotal: 0,
      paidRewardTotal: 0,
      estimatedRevenueTotal: 0,
      realizedRevenueTotal: 0,
      estimatedOrdersTotal: 0,
      realizedOrdersTotal: 0,
      estimatedClientsTotal: 0,
      realizedClientsTotal: 0,
      completedChallenges: 0,
      newChallenges: 0,
      completionRateSum: 0,
    }
  )

  const totalItems = items.length
  const adherenceRate = totals.totalParticipants ? (totals.acceptedParticipants / totals.totalParticipants) * 100 : 0
  const completionRate = totalItems ? totals.completionRateSum / totalItems : 0

  return {
    activeChallenges: totals.activeChallenges,
    totalParticipants: totals.totalParticipants,
    estimatedRewardTotal: totals.estimatedRewardTotal,
    paidRewardTotal: totals.paidRewardTotal,
    estimatedRevenueTotal: totals.estimatedRevenueTotal,
    realizedRevenueTotal: totals.realizedRevenueTotal,
    estimatedOrdersTotal: totals.estimatedOrdersTotal,
    realizedOrdersTotal: totals.realizedOrdersTotal,
    estimatedClientsTotal: totals.estimatedClientsTotal,
    realizedClientsTotal: totals.realizedClientsTotal,
    returnPerBonusPotential: totals.estimatedRewardTotal > 0 ? totals.estimatedRevenueTotal / totals.estimatedRewardTotal : 0,
    returnPerBonusRealized: totals.paidRewardTotal > 0 ? totals.realizedRevenueTotal / totals.paidRewardTotal : 0,
    adherenceRate,
    completionRate,
    completedChallenges: totals.completedChallenges,
    totalRewards: totals.paidRewardTotal,
    newChallenges: totals.newChallenges,
  }
}

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ChallengeApiError(payload?.error ?? "Erro ao carregar desafios.", {
      code: payload?.code ?? null,
      details: payload?.details ?? null,
      status: response.status,
      payload,
    })
  }
  return payload as T
}

export async function fetchChallenges() {
  return request<ChallengesResponse>("/api/desafios")
}

export async function fetchChallengeMetadata() {
  return request<ChallengeMetadata>("/api/desafios/metadata")
}

export async function fetchChallengeSetup() {
  return request<ChallengeModuleSetup>("/api/desafios/setup")
}

export async function searchChallengeProducts(term: string) {
  const params = new URLSearchParams({ q: term })
  return request<{ items: ChallengeProductOption[] }>(`/api/desafios/catalogo/produtos?${params.toString()}`)
}

export async function searchChallengeBrands(term: string) {
  const params = new URLSearchParams({ q: term })
  return request<{ items: ChallengeBrandOption[] }>(`/api/desafios/catalogo/marcas?${params.toString()}`)
}

export async function fetchChallengeDetails(id: number | string) {
  return request<Challenge>(`/api/desafios/${id}`)
}

export async function previewChallengeImpact(payload: ChallengeFormPayload) {
  return request<ChallengeImpactPreviewResponse>("/api/desafios/impact-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function createChallenge(payload: ChallengeFormPayload) {
  return request<Challenge>("/api/desafios", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateChallenge(id: number | string, payload: ChallengeFormPayload) {
  return request<Challenge>(`/api/desafios/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function closeChallenge(
  id: number | string,
  status: "ENCERRADO" | "ENCERRADO_MANUAL" | "CANCELADO" = "ENCERRADO_MANUAL"
) {
  const params = new URLSearchParams({ status })
  return request<Challenge>(`/api/desafios/${id}?${params.toString()}`, { method: "DELETE" })
}

export async function fetchSellerChallenges(
  skVendedor: number | string,
  mode: "all" | "novos" | "disponiveis" | "ativos" = "all"
) {
  const suffixMap = {
    all: "",
    novos: "/novos",
    disponiveis: "/disponiveis",
    ativos: "/ativos",
  } as const
  const suffix = suffixMap[mode]
  return request<ChallengesResponse>(`/api/vendedor/${skVendedor}/desafios${suffix}`)
}

export async function fetchSellerChallengeDetail(skVendedor: number | string, id: number | string) {
  return request<Challenge>(`/api/vendedor/${skVendedor}/desafios/${id}`)
}

export async function fetchSellerChallengeAlert(skVendedor: number | string) {
  return request<SellerChallengeAlertResponse>(`/api/vendedor/${skVendedor}/desafios/novos`)
}

export async function acceptSellerChallenge(id: number | string, skVendedor: number | string) {
  return request<Challenge>(`/api/desafios/${id}/aceitar`, {
    method: "POST",
    body: JSON.stringify({ skVendedor }),
  })
}

export async function declineSellerChallenge(id: number | string, skVendedor: number | string) {
  return request<Challenge>(`/api/desafios/${id}/recusar`, {
    method: "POST",
    body: JSON.stringify({ skVendedor }),
  })
}

export async function markSellerChallengeSeen(id: number | string, skVendedor: number | string) {
  return request<{ success: boolean; id: number | string; visualizadoEm: string | null }>(`/api/desafios/${id}/visualizar`, {
    method: "POST",
    body: JSON.stringify({ skVendedor }),
  })
}

export function isChallengeExpiredByDate(
  challenge: Pick<Challenge, "dataFim">,
  now = new Date()
): boolean {
  const endValue = getChallengeDateInputValue(challenge.dataFim)
  const end = endValue ? parseChallengeDateTime(endValue, "end") : null
  return end !== null && now.getTime() > end.getTime()
}

export function isChallengeCurrentlyActive(
  challenge: Pick<Challenge, "status" | "dataInicio" | "dataFim">,
  now = new Date()
): boolean {
  return getChallengeLifecycleStatus(challenge, now) === "ATIVO"
}

export function isChallengeAvailableForSeller(
  challenge: Pick<Challenge, "exigeAceite" | "participant" | "status" | "dataInicio" | "dataFim">,
  now = new Date()
): boolean {
  return isSellerChallengeAvailable(challenge) && isChallengeCurrentlyActive(challenge, now)
}

export function isChallengeInProgressForSeller(
  challenge: Pick<Challenge, "exigeAceite" | "participant" | "status" | "dataInicio" | "dataFim">,
  now = new Date()
): boolean {
  const participantStatus = String(challenge.participant?.statusParticipacao ?? "").toUpperCase()
  return (
    getChallengeCampaignKind(challenge) === "DESAFIO" &&
    ["ACEITO", "EM_ANDAMENTO"].includes(participantStatus) &&
    isChallengeCurrentlyActive(challenge, now)
  )
}

export function isChallengeClosedForSeller(
  challenge: Pick<Challenge, "exigeAceite" | "participant" | "status" | "dataInicio" | "dataFim">,
  now = new Date()
): boolean {
  const participantStatus = String(challenge.participant?.statusParticipacao ?? "").toUpperCase()
  if (participantStatus === "CONCLUIDO" || participantStatus === "EXPIRADO") return true
  return isClosedChallengeStatus(getChallengeLifecycleStatus(challenge, now))
}
