import { readFile } from "node:fs/promises"
import oracledb from "../db/oracleClient.js"

const ddlUrl = new URL("../../sql/ddl_gestao_metas.sql", import.meta.url)

function stripSqlTerminator(sql) {
  return String(sql ?? "").trim().replace(/;\s*$/, "")
}

function findSqlStatementTerminator(sql, startIndex = 0) {
  let inSingleQuote = false

  for (let index = startIndex; index < sql.length; index += 1) {
    const char = sql[index]
    const nextChar = sql[index + 1]

    if (char === "'") {
      if (inSingleQuote && nextChar === "'") {
        index += 1
        continue
      }
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === ";" && !inSingleQuote) {
      return index
    }
  }

  return -1
}

function extractViewDefinitionsFromDdl(ddl) {
  const source = String(ddl ?? "")
  const viewStartPattern = /CREATE\s+OR\s+REPLACE\s+(?:FORCE\s+)?(?:EDITIONABLE\s+)?VIEW\b/gi
  const blocks = []
  let match = null

  while ((match = viewStartPattern.exec(source)) !== null) {
    const endIndex = findSqlStatementTerminator(source, match.index)
    if (endIndex === -1) continue
    blocks.push(source.slice(match.index, endIndex + 1))
    viewStartPattern.lastIndex = endIndex + 1
  }

  return blocks
    .map((block) => {
      const name = block.match(/VIEW\s+"DM_VENDAS"\."([^"]+)"/i)?.[1]
        ?? block.match(/VIEW\s+"?([A-Z0-9_]+)"?/i)?.[1]

      if (!name) return null

      const sql = stripSqlTerminator(
        block.replace(
          /CREATE\s+OR\s+REPLACE\s+(?:FORCE\s+)?(?:EDITIONABLE\s+)?VIEW\s+"DM_VENDAS"\."([^"]+)"/i,
          (_, viewName) => `CREATE OR REPLACE VIEW ${viewName}`
        )
      )

      return { name, sql }
    })
    .filter(Boolean)
}

async function getViewDefinitions() {
  const ddl = await readFile(ddlUrl, "utf8")
  const definitions = extractViewDefinitionsFromDdl(ddl)

  if (!definitions.length) {
    throw new Error("Nenhuma view encontrada em Back/sql/ddl_gestao_metas.sql.")
  }

  return definitions
}

function splitDdlSections(ddl) {
  const triggersIdx = String(ddl ?? "").search(/--\s*=+\s*\r?\n--\s*BLOCO 7: TRIGGERS/i)
  const viewsIdx = String(ddl ?? "").search(/--\s*=+\s*\r?\n--\s*BLOCO 8: VIEWS/i)

  if (triggersIdx === -1 || viewsIdx === -1 || viewsIdx <= triggersIdx) {
    throw new Error(
      "Nao foi possivel localizar os marcadores BLOCO 7 (TRIGGERS) / BLOCO 8 (VIEWS) em ddl_gestao_metas.sql."
    )
  }

  return {
    schemaObjectsSql: ddl.slice(0, triggersIdx),
    triggersSql: ddl.slice(triggersIdx, viewsIdx),
  }
}

function stripLeadingComments(sql) {
  return String(sql ?? "").replace(/^(\s*--[^\n]*\n)+/g, "").trim()
}

function extractSchemaObjectStatements(schemaObjectsSql) {
  return String(schemaObjectsSql ?? "")
    .split(";")
    .map((chunk) => stripLeadingComments(chunk))
    .filter(Boolean)
    .map((sql) => {
      let match = sql.match(/^CREATE\s+SEQUENCE\s+"([A-Z0-9_]+)"\."([A-Z0-9_]+)"/i)
      if (match) return { type: "SEQUENCE", schema: match[1], name: match[2], sql }

      match = sql.match(/^CREATE\s+TABLE\s+"([A-Z0-9_]+)"\."([A-Z0-9_]+)"/i)
      if (match) return { type: "TABLE", schema: match[1], name: match[2], sql }

      match = sql.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+"([A-Z0-9_]+)"\."([A-Z0-9_]+)"/i)
      if (match) return { type: "INDEX", schema: match[1], name: match[2], sql }

      if (/^COMMENT\s+ON\s+/i.test(sql)) return { type: "COMMENT", sql }

      return { type: "OTHER", sql }
    })
}

function extractTriggerStatements(triggersSql) {
  const lines = String(triggersSql ?? "").split(/\r?\n/)
  const statements = []
  let mode = "seek"
  let plsqlBuffer = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (mode === "seek") {
      if (/^CREATE\s+OR\s+REPLACE\s+(?:EDITIONABLE\s+)?TRIGGER/i.test(trimmed)) {
        mode = "plsql"
        plsqlBuffer = [line]
      } else if (/^ALTER\s+TRIGGER\s+"[^"]+"\."[^"]+"\s+ENABLE;?\s*$/i.test(trimmed)) {
        statements.push({ type: "TRIGGER_ENABLE", sql: stripSqlTerminator(trimmed) })
      }
      continue
    }

    if (trimmed === "/") {
      const body = plsqlBuffer.join("\n").trim()
      const nameMatch = body.match(/TRIGGER\s+"([A-Z0-9_]+)"\."([A-Z0-9_]+)"/i)
      statements.push({ type: "TRIGGER_BODY", schema: nameMatch?.[1], name: nameMatch?.[2], sql: body })
      mode = "seek"
      plsqlBuffer = []
    } else {
      plsqlBuffer.push(line)
    }
  }

  return statements
}

async function getSchemaProvisionPlan() {
  const ddl = await readFile(ddlUrl, "utf8")
  const { schemaObjectsSql, triggersSql } = splitDdlSections(ddl)

  return {
    schemaStatements: extractSchemaObjectStatements(schemaObjectsSql).filter((stmt) => stmt.type !== "OTHER"),
    triggerStatements: extractTriggerStatements(triggersSql),
  }
}

async function schemaObjectExists(connection, objectType, objectName) {
  const result = await connection.execute(
    `SELECT COUNT(*) FROM USER_OBJECTS WHERE OBJECT_NAME = :objectName AND OBJECT_TYPE = :objectType`,
    { objectName, objectType }
  )
  const count = result.rows?.[0]?.[0] ?? result.rows?.[0]?.["COUNT(*)"] ?? 0
  return Number(count) > 0
}

const ALREADY_EXISTS_ORA_CODES = ["ORA-00955", "ORA-01430", "ORA-02264", "ORA-02275"]

function isAlreadyExistsError(error) {
  const message = String(error?.message ?? "")
  return ALREADY_EXISTS_ORA_CODES.some((code) => message.includes(code))
}

export async function provisionOracleSchemaObjects({ user, password, connectString }) {
  let connection = null
  const result = {
    ok: true,
    tables: { created: [], skipped: [] },
    sequences: { created: [], skipped: [] },
    indexes: { created: [], skipped: [] },
    comments: 0,
    triggers: [],
    failed: [],
  }

  try {
    const { schemaStatements, triggerStatements } = await getSchemaProvisionPlan()
    connection = await oracledb.getConnection({ user, password, connectString })

    for (const stmt of schemaStatements) {
      try {
        if (stmt.type === "COMMENT") {
          await connection.execute(stmt.sql)
          result.comments += 1
          continue
        }

        const objectType = stmt.type === "INDEX" ? "INDEX" : stmt.type
        const exists = await schemaObjectExists(connection, objectType, stmt.name)
        const bucket = stmt.type === "TABLE" ? result.tables : stmt.type === "SEQUENCE" ? result.sequences : result.indexes

        if (exists) {
          bucket.skipped.push(stmt.name)
          continue
        }

        await connection.execute(stmt.sql)
        bucket.created.push(stmt.name)
      } catch (error) {
        if (isAlreadyExistsError(error)) continue
        result.failed.push({ type: stmt.type, name: stmt.name ?? null, error: String(error?.message ?? error) })
      }
    }

    for (const stmt of triggerStatements) {
      try {
        await connection.execute(stmt.sql)
        if (stmt.type === "TRIGGER_BODY") {
          result.triggers.push(stmt.name)
        }
      } catch (error) {
        result.failed.push({ type: stmt.type, name: stmt.name ?? null, error: String(error?.message ?? error) })
      }
    }

    result.ok = result.failed.length === 0
    return result
  } catch (error) {
    error.status = 422
    error.message = `Falha ao provisionar tabelas Oracle: ${error.message}`
    throw error
  } finally {
    if (connection) {
      try {
        await connection.close()
      } catch {}
    }
  }
}

export async function provisionOracleViews({ user, password, connectString }) {
  let connection = null
  const created = []
  const updated = []

  try {
    const viewDefinitions = await getViewDefinitions()
    connection = await oracledb.getConnection({ user, password, connectString })

    for (const view of viewDefinitions) {
      const status = await getCurrentSchemaObjectStatus(connection, view.name)
      await connection.execute(view.sql)
      if (status) {
        updated.push(view.name)
      } else {
        created.push(view.name)
      }
    }

    return { ok: true, created, updated }
  } catch (error) {
    error.status = 422
    error.message = `Falha ao criar views Oracle: ${error.message}`
    throw error
  } finally {
    if (connection) {
      try {
        await connection.close()
      } catch {}
    }
  }
}

export async function dropOracleProvisionedViews({ user, password, connectString }) {
  let connection = null
  const dropped = []
  const missing = []

  try {
    const viewDefinitions = await getViewDefinitions()
    connection = await oracledb.getConnection({ user, password, connectString })

    for (const view of viewDefinitions.slice().reverse()) {
      const status = await getCurrentSchemaObjectStatus(connection, view.name)
      if (!status) {
        missing.push(view.name)
        continue
      }

      await connection.execute(`DROP VIEW ${view.name}`)
      dropped.push(view.name)
    }

    return { ok: true, dropped, missing }
  } catch (error) {
    error.status = 422
    error.message = `Falha ao remover views Oracle: ${error.message}`
    throw error
  } finally {
    if (connection) {
      try {
        await connection.close()
      } catch {}
    }
  }
}

async function getCurrentSchemaObjectStatus(connection, objectName) {
  const result = await connection.execute(
    `
    SELECT status
    FROM USER_OBJECTS
    WHERE OBJECT_NAME = :objectName
      AND OBJECT_TYPE = 'VIEW'
    `,
    { objectName }
  )

  return result.rows?.[0]?.[0] ?? result.rows?.[0]?.STATUS ?? null
}
