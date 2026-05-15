import { query } from "./oracle.js"

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
  challengesTable: {
    type: "TABLE",
    candidates: ["GM_TB_DESAFIOS_COMERCIAIS", "DESAFIOS_COMERCIAIS"],
  },
  challengeGoalsTable: {
    type: "TABLE",
    candidates: ["GM_TB_DESAFIOS_COMERCIAIS_METAS", "DESAFIOS_COMERCIAIS_METAS"],
  },
  challengeParticipantsTable: {
    type: "TABLE",
    candidates: ["GM_TB_DESAFIOS_COMERCIAIS_VENDEDORES", "DESAFIOS_COMERCIAIS_VENDEDORES"],
  },
  challengeProgressTable: {
    type: "TABLE",
    candidates: ["GM_TB_DESAFIOS_COMERCIAIS_PROGRESSO", "DESAFIOS_COMERCIAIS_PROGRESSO"],
  },
  challengeLogTable: {
    type: "TABLE",
    candidates: ["GM_TB_DESAFIOS_COMERCIAIS_LOG", "DESAFIOS_COMERCIAIS_LOG"],
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

const objectNameCache = new Map()

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function buildObjectName(owner, objectName) {
  return owner ? `${owner}.${objectName}` : objectName
}

function buildInList(candidates) {
  return candidates.map((candidate) => `'${candidate}'`).join(", ")
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
  if (resolvedObjectName) {
    objectNameCache.set(key, finalName)
  }
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

export async function getRankingVendorsViewName() {
  return resolveOracleObjectName("rankingVendorsView")
}

export async function getRankingVendorsDayViewName() {
  return resolveOracleObjectName("rankingVendorsDayView")
}

export async function getRankingVendorsDayHistViewName() {
  return resolveOracleObjectName("rankingVendorsDayHistView")
}
