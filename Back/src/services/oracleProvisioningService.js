import { readFile } from "node:fs/promises"
import oracledb from "../db/oracleClient.js"

const ddlUrl = new URL("../../sql/ddl_gestao_metas.sql", import.meta.url)

function stripSqlTerminator(sql) {
  return String(sql ?? "").trim().replace(/;\s*$/, "")
}

function extractViewDefinitionsFromDdl(ddl) {
  const blocks = String(ddl ?? "").match(
    /CREATE\s+OR\s+REPLACE\s+(?:FORCE\s+)?(?:EDITIONABLE\s+)?VIEW[\s\S]*?(?=\n\s*CREATE\s+OR\s+REPLACE\s+(?:FORCE\s+)?(?:EDITIONABLE\s+)?VIEW|\n\s*--\s*=+\s*\n\s*--\s*FIM DO SCRIPT|$)/gi
  ) ?? []

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
