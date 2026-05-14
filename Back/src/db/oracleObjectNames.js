import { query } from "./oracle.js"

export const CHALLENGE_TABLE_ALIASES = Object.freeze({
  challengeTable: ["GM_TB_DESAFIOS_COMERCIAIS", "DESAFIOS_COMERCIAIS"],
  challengeGoalsTable: ["GM_TB_DESAFIOS_COMERCIAIS_METAS", "DESAFIOS_COMERCIAIS_METAS"],
  challengeSellersTable: ["GM_TB_DESAFIOS_COMERCIAIS_VENDEDORES", "DESAFIOS_COMERCIAIS_VENDEDORES"],
  challengeProgressTable: ["GM_TB_DESAFIOS_COMERCIAIS_PROGRESSO", "DESAFIOS_COMERCIAIS_PROGRESSO"],
  challengeLogTable: ["GM_TB_DESAFIOS_COMERCIAIS_LOG", "DESAFIOS_COMERCIAIS_LOG"],
})

const OBJECT_SPECS = {
  usersTable: {
    type: "TABLE",
    candidates: ["GM_TB_USUARIOS_APP", "USUARIOS_APP"],
  },
  feedPostsTable: {
    type: "TABLE",
    candidates: ["GM_TB_FEED_POSTS", "FEED_POSTS"],
  },
  feedLikesTable: {
    type: "TABLE",
    candidates: ["GM_TB_FEED_CURTIDAS", "FEED_CURTIDAS"],
  },
  feedCommentsTable: {
    type: "TABLE",
    candidates: ["GM_TB_FEED_COMENTARIOS", "FEED_COMENTARIOS"],
  },
  objectivesTable: {
    type: "TABLE",
    candidates: ["GM_TB_OBJETIVOS_VENDEDOR", "OBJETIVOS_VENDEDOR"],
  },
  profileTable: {
    type: "TABLE",
    candidates: ["GM_TB_PERFIL_VENDEDOR", "PERFIL_VENDEDOR"],
  },
  challengeTable: {
    type: "TABLE",
    candidates: CHALLENGE_TABLE_ALIASES.challengeTable,
  },
  challengeGoalsTable: {
    type: "TABLE",
    candidates: CHALLENGE_TABLE_ALIASES.challengeGoalsTable,
  },
  challengeSellersTable: {
    type: "TABLE",
    candidates: CHALLENGE_TABLE_ALIASES.challengeSellersTable,
  },
  challengeProgressTable: {
    type: "TABLE",
    candidates: CHALLENGE_TABLE_ALIASES.challengeProgressTable,
  },
  challengeLogTable: {
    type: "TABLE",
    candidates: CHALLENGE_TABLE_ALIASES.challengeLogTable,
  },
  rankingVendorsView: {
    type: "VIEW",
    owner: "DM_VENDAS",
    candidates: ["GM_VW_RANKING_VENDEDORES", "VW_RANKING_VENDEDORES"],
  },
  rankingVendorsDayView: {
    type: "VIEW",
    owner: "DM_VENDAS",
    candidates: ["GM_VW_RANKING_VENDEDORES_DIA", "VW_RANKING_VENDEDORES_DIA"],
  },
  rankingVendorsDayHistView: {
    type: "VIEW",
    candidates: ["GM_VW_RANKING_VENDEDORES_DIA_HIST", "VW_RANKING_VENDEDORES_DIA_HIST"],
  },
}

const DEFAULT_ACTIVATION_TABLE_NAMES = {
  campaignsTable: "CAMPANHAS_ATIVACAO",
  campaignClientsTable: "CAMPANHAS_ATIVACAO_CLIENTES",
  campaignLinksTable: "CAMPANHA_LINKS",
  campaignEventsTable: "CAMPANHA_EVENTOS",
}

const ACTIVATION_TABLE_FAMILIES = [
  DEFAULT_ACTIVATION_TABLE_NAMES,
  {
    campaignsTable: "GM_TB_CAMPANHAS_ATIVACAO",
    campaignClientsTable: "GM_TB_CAMPANHAS_ATIVACAO_CLIENTES",
    campaignLinksTable: "GM_TB_CAMPANHA_LINKS",
    campaignEventsTable: "GM_TB_CAMPANHA_EVENTOS",
  },
]

const objectNameCache = new Map()
let cachedActivationTableNames = null

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function buildObjectName(owner, objectName) {
  return owner ? `${owner}.${objectName}` : objectName
}

function buildInList(candidates) {
  return candidates.map((candidate) => `'${candidate}'`).join(", ")
}

async function tableExistsInCurrentSchema(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: String(tableName ?? "").toUpperCase() }
  )

  const total = Number(rows[0]?.TOTAL ?? rows[0]?.total ?? 0)
  return Number.isFinite(total) && total > 0
}

async function findCurrentSchemaObject(spec) {
  const rows = await query(
    `
    SELECT object_name
    FROM USER_OBJECTS
    WHERE OBJECT_TYPE = :object_type
      AND OBJECT_NAME IN (${buildInList(spec.candidates)})
    `,
    { object_type: spec.type }
  )

  const available = new Set(rows.map((row) => normalizeRow(row).object_name))
  return spec.candidates.find((candidate) => available.has(candidate)) ?? null
}

async function findOwnedObject(spec) {
  const rows = await query(
    `
    SELECT object_name
    FROM ALL_OBJECTS
    WHERE OWNER = :owner
      AND OBJECT_TYPE = :object_type
      AND OBJECT_NAME IN (${buildInList(spec.candidates)})
    `,
    {
      owner: spec.owner,
      object_type: spec.type,
    }
  )

  const available = new Set(rows.map((row) => normalizeRow(row).object_name))
  return spec.candidates.find((candidate) => available.has(candidate)) ?? null
}

export async function resolveOracleObjectName(key) {
  if (objectNameCache.has(key)) {
    return objectNameCache.get(key)
  }

  const spec = OBJECT_SPECS[key]
  if (!spec) {
    throw new Error(`Oracle object alias nao mapeado: ${key}`)
  }

  const resolvedObjectName = spec.owner
    ? await findOwnedObject(spec)
    : await findCurrentSchemaObject(spec)

  const finalName = buildObjectName(spec.owner, resolvedObjectName ?? spec.candidates[0])
  objectNameCache.set(key, finalName)
  return finalName
}

export async function resolveOracleObjectNames(keys) {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await resolveOracleObjectName(key)])
  )

  return Object.fromEntries(entries)
}

export async function getUsersTableName() {
  return resolveOracleObjectName("usersTable")
}

export async function getFeedPostsTableName() {
  return resolveOracleObjectName("feedPostsTable")
}

export async function getFeedLikesTableName() {
  return resolveOracleObjectName("feedLikesTable")
}

export async function getFeedCommentsTableName() {
  return resolveOracleObjectName("feedCommentsTable")
}

export async function getObjectivesTableName() {
  return resolveOracleObjectName("objectivesTable")
}

export async function getProfileTableName() {
  return resolveOracleObjectName("profileTable")
}

export async function getChallengeTableNames() {
  return resolveOracleObjectNames(Object.keys(CHALLENGE_TABLE_ALIASES))
}

export async function getRankingVendorsViewName() {
  return resolveOracleObjectName("rankingVendorsView")
}

export async function getRankingVendorsDayViewName() {
  return resolveOracleObjectName("rankingVendorsDayView")
}

export async function getRankingVendorsDayHistViewName() {
  return resolveOracleObjectName("rankingVendorsDayHistView")
}

export async function getActivationTableNames() {
  if (cachedActivationTableNames) {
    return cachedActivationTableNames
  }

  for (const family of ACTIVATION_TABLE_FAMILIES) {
    const hasCampaigns = await tableExistsInCurrentSchema(family.campaignsTable)
    const hasCampaignClients = await tableExistsInCurrentSchema(family.campaignClientsTable)

    if (hasCampaigns && hasCampaignClients) {
      cachedActivationTableNames = family
      return cachedActivationTableNames
    }
  }

  cachedActivationTableNames = DEFAULT_ACTIVATION_TABLE_NAMES
  return cachedActivationTableNames
}
