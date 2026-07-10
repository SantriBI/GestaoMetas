import "../src/config/env.js"
import oracledb from "../src/db/oracleClient.js"
import centralPool from "../src/db/mysql.js"
import { decryptSecret } from "../src/security/secrets.js"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const APPLY = process.argv.includes("--apply")
const orgArg = process.argv.find((arg) => arg.startsWith("--org="))
const onlyOrgId = orgArg ? Number(orgArg.split("=")[1]) : null

const SEQUENCES = [
  { name: "DESAFIOS_COMERCIAIS_SEQ", table: "DESAFIOS_COMERCIAIS", column: "ID_DESAFIO" },
  { name: "DESAFIOS_COMERCIAIS_METAS_SEQ", table: "DESAFIOS_COMERCIAIS_METAS", column: "ID_META" },
  { name: "DESAFIOS_COMERCIAIS_VENDEDORES_SEQ", table: "DESAFIOS_COMERCIAIS_VENDEDORES", column: "ID" },
  { name: "DESAFIOS_COMERCIAIS_PROGRESSO_SEQ", table: "DESAFIOS_COMERCIAIS_PROGRESSO", column: "ID" },
  { name: "DESAFIOS_COMERCIAIS_LOG_SEQ", table: "DESAFIOS_COMERCIAIS_LOG", column: "ID" },
]

const REQUIRED_TABLES = [
  "DESAFIOS_COMERCIAIS",
  "DESAFIOS_COMERCIAIS_METAS",
  "DESAFIOS_COMERCIAIS_VENDEDORES",
  "DESAFIOS_COMERCIAIS_PROGRESSO",
  "DESAFIOS_COMERCIAIS_LOG",
]

function getOracleErrorCode(error) {
  if (typeof error?.errorNum === "number") return error.errorNum
  const match = String(error?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function quoteName(name) {
  return `"${String(name).replaceAll('"', '""')}"`
}

async function scalar(connection, sql, binds = {}) {
  const result = await connection.execute(sql, binds)
  const row = normalizeRow(result.rows?.[0] ?? {})
  return row.value ?? row.total ?? null
}

async function listOrganizations() {
  const params = []
  let where = "ativo = 'S' AND oracle_user IS NOT NULL AND oracle_password IS NOT NULL AND oracle_connect_string IS NOT NULL"
  if (onlyOrgId) {
    where += " AND id_organizacao = ?"
    params.push(onlyOrgId)
  }

  const [rows] = await centralPool.query(
    `
    SELECT id_organizacao, nome, oracle_user, oracle_password, oracle_connect_string
    FROM organizacoes_auth
    WHERE ${where}
    ORDER BY id_organizacao
    `,
    params
  )
  return rows
}

async function getConnection(org) {
  return oracledb.getConnection({
    user: org.oracle_user,
    password: decryptSecret(String(org.oracle_password)),
    connectString: org.oracle_connect_string,
  })
}

async function tableExists(connection, tableName) {
  const total = await scalar(
    connection,
    `
    SELECT COUNT(*) AS value
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: tableName }
  )
  return Number(total) > 0
}

async function sequenceExists(connection, sequenceName) {
  const total = await scalar(
    connection,
    `
    SELECT COUNT(*) AS value
    FROM USER_SEQUENCES
    WHERE SEQUENCE_NAME = :sequence_name
    `,
    { sequence_name: sequenceName }
  )
  return Number(total) > 0
}

async function getNextSequenceStart(connection, tableName, columnName) {
  const result = await connection.execute(
    `SELECT NVL(MAX(${quoteName(columnName)}), 0) + 1 AS value FROM ${quoteName(tableName)}`
  )
  const row = normalizeRow(result.rows?.[0] ?? {})
  const value = Number(row.value ?? 1)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}

async function createSequenceIfMissing(connection, spec, actions) {
  const exists = await sequenceExists(connection, spec.name)
  if (exists) {
    actions.push(`ok sequence ${spec.name}`)
    return
  }

  const start = await getNextSequenceStart(connection, spec.table, spec.column)
  const ddl = `CREATE SEQUENCE ${quoteName(spec.name)} START WITH ${start} INCREMENT BY 1 NOCACHE NOCYCLE`

  if (APPLY) {
    await connection.execute(ddl)
    actions.push(`created sequence ${spec.name} start=${start}`)
  } else {
    actions.push(`would create sequence ${spec.name} start=${start}`)
  }
}

async function findStatusConstraint(connection) {
  const result = await connection.execute(
    `
    SELECT constraint_name, search_condition_vc
    FROM USER_CONSTRAINTS
    WHERE table_name = 'DESAFIOS_COMERCIAIS'
      AND constraint_type = 'C'
      AND (
        constraint_name = 'CK_DESAFIOS_STATUS'
        OR UPPER(search_condition_vc) LIKE '%STATUS%'
      )
    ORDER BY CASE WHEN constraint_name = 'CK_DESAFIOS_STATUS' THEN 0 ELSE 1 END
    `
  )
  return (result.rows ?? []).map(normalizeRow)[0] ?? null
}

function statusConstraintNeedsUpdate(constraint) {
  const condition = String(constraint?.search_condition_vc ?? "").toUpperCase()
  return !condition.includes("ENCERRADO_AUTOMATICO") || !condition.includes("ENCERRADO_MANUAL")
}

async function updateStatusConstraintIfNeeded(connection, actions) {
  const constraint = await findStatusConstraint(connection)
  if (constraint && !statusConstraintNeedsUpdate(constraint)) {
    actions.push(`ok constraint ${constraint.constraint_name}`)
    return
  }

  if (!APPLY) {
    actions.push(
      constraint?.constraint_name
        ? `would replace constraint ${constraint.constraint_name}`
        : "would create constraint CK_DESAFIOS_STATUS"
    )
    return
  }

  if (constraint?.constraint_name) {
    await connection.execute(`ALTER TABLE ${quoteName("DESAFIOS_COMERCIAIS")} DROP CONSTRAINT ${quoteName(constraint.constraint_name)}`)
  }

  await connection.execute(`
    ALTER TABLE ${quoteName("DESAFIOS_COMERCIAIS")}
    ADD CONSTRAINT ${quoteName("CK_DESAFIOS_STATUS")}
    CHECK (
      STATUS IN (
        'RASCUNHO',
        'AGENDADO',
        'ATIVO',
        'ENCERRADO',
        'ENCERRADO_AUTOMATICO',
        'ENCERRADO_MANUAL',
        'CANCELADO'
      )
    )
  `)
  actions.push(
    constraint?.constraint_name
      ? `replaced constraint ${constraint.constraint_name}`
      : "created constraint CK_DESAFIOS_STATUS"
  )
}

async function repairOrganization(org) {
  const actions = []
  let connection = null
  try {
    connection = await getConnection(org)
    const currentSchema = await scalar(connection, "SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS value FROM dual")

    for (const tableName of REQUIRED_TABLES) {
      if (!(await tableExists(connection, tableName))) {
        actions.push(`missing table ${tableName} in current schema ${currentSchema}`)
      }
    }

    if (actions.some((action) => action.startsWith("missing table"))) {
      return { ok: false, currentSchema, actions }
    }

    for (const spec of SEQUENCES) {
      await createSequenceIfMissing(connection, spec, actions)
    }

    await updateStatusConstraintIfNeeded(connection, actions)
    return { ok: true, currentSchema, actions }
  } catch (error) {
    const code = getOracleErrorCode(error)
    return {
      ok: false,
      currentSchema: null,
      actions: [`error${code ? ` ORA-${String(code).padStart(5, "0")}` : ""}: ${error.message}`],
    }
  } finally {
    if (connection) {
      await connection.close()
    }
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`)
  if (!APPLY) console.log("No banco nada sera alterado. Reexecute com --apply para aplicar.\n")

  const orgs = await listOrganizations()
  if (!orgs.length) {
    console.log("Nenhuma organizacao Oracle ativa encontrada.")
    return
  }

  for (const org of orgs) {
    console.log(`\n[${org.id_organizacao}] ${org.nome} (${org.oracle_user})`)
    const result = await repairOrganization(org)
    console.log(`schema=${result.currentSchema ?? "n/a"} status=${result.ok ? "ok" : "attention"}`)
    for (const action of result.actions) {
      console.log(`- ${action}`)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Repair failed:", error)
    process.exit(1)
  })
