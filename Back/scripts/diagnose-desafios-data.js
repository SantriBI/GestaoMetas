import "../src/config/env.js"
import centralPool from "../src/db/mysql.js"
import { queryOracleByEmpresaId } from "../src/db/oracle-tenants.js"
import { queryTenantByEmpresaId } from "../src/db/mysql-tenants.js"

const orgArg = process.argv.find((arg) => arg.startsWith("--org="))
const onlyOrgId = orgArg ? Number(orgArg.split("=")[1]) : null

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
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
    SELECT id_organizacao, nome, oracle_user
    FROM organizacoes_auth
    WHERE ${where}
    ORDER BY id_organizacao
    `,
    params
  )
  return rows
}

async function oracleRows(empresaId, sql, binds = {}) {
  return (await queryOracleByEmpresaId(empresaId, sql, binds, { suppressErrorLog: true })).map(normalizeRow)
}

async function diagnoseOrg(org) {
  console.log(`\n[${org.id_organizacao}] ${org.nome} (${org.oracle_user})`)

  try {
    const schemaRows = await oracleRows(org.id_organizacao, "SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS schema_name FROM dual")
    console.log(`schema=${schemaRows[0]?.schema_name ?? "n/a"}`)

    const totals = await oracleRows(
      org.id_organizacao,
      `
      SELECT
        (SELECT COUNT(*) FROM DESAFIOS_COMERCIAIS) AS desafios,
        (SELECT COUNT(*) FROM DESAFIOS_COMERCIAIS_METAS) AS metas,
        (SELECT COUNT(*) FROM DESAFIOS_COMERCIAIS_VENDEDORES) AS participantes
      FROM dual
      `
    )
    console.log("totais:", totals[0])

    const byEmpresa = await oracleRows(
      org.id_organizacao,
      `
      SELECT NVL(TO_CHAR(empresa_id), '<NULL>') AS empresa_id, status, COUNT(*) AS total
      FROM DESAFIOS_COMERCIAIS
      GROUP BY NVL(TO_CHAR(empresa_id), '<NULL>'), status
      ORDER BY empresa_id, status
      `
    )
    console.log("por empresa/status:")
    for (const row of byEmpresa) console.log(`- empresa_id=${row.empresa_id} status=${row.status} total=${row.total}`)

    const visibleForManager = await oracleRows(
      org.id_organizacao,
      `
      SELECT COUNT(*) AS total
      FROM DESAFIOS_COMERCIAIS
      WHERE empresa_id = :empresa_id OR empresa_id IS NULL
      `,
      { empresa_id: org.id_organizacao }
    )
    console.log(`visiveis para gerente com filtro atual: ${visibleForManager[0]?.total ?? 0}`)

    const recent = await oracleRows(
      org.id_organizacao,
      `
      SELECT d.id_desafio,
             d.empresa_id,
             d.titulo,
             d.status,
             d.data_inicio,
             d.data_fim,
             COUNT(v.sk_vendedor) AS participantes
      FROM DESAFIOS_COMERCIAIS d
      LEFT JOIN DESAFIOS_COMERCIAIS_VENDEDORES v
        ON v.id_desafio = d.id_desafio
      GROUP BY d.id_desafio, d.empresa_id, d.titulo, d.status, d.data_inicio, d.data_fim
      ORDER BY d.id_desafio DESC
      FETCH FIRST 10 ROWS ONLY
      `
    )
    console.log("ultimos desafios:")
    for (const row of recent) {
      console.log(
        `- id=${row.id_desafio} empresa_id=${row.empresa_id ?? "<NULL>"} status=${row.status} participantes=${row.participantes} titulo=${row.titulo}`
      )
    }

    let users = []
    try {
      users = await queryTenantByEmpresaId(
        org.id_organizacao,
        `
        SELECT role, sk_vendedor, COUNT(*) AS total
        FROM usuarios_auth
        WHERE ativo = 'S'
        GROUP BY role, sk_vendedor
        ORDER BY role, sk_vendedor
        `
      )
    } catch (error) {
      console.log(`usuarios tenant: erro ao consultar (${error.message})`)
    }

    if (users.length) {
      const sellers = users.filter((row) => String(row.role).toUpperCase() === "VENDEDOR")
      console.log(`vendedores ativos no MySQL tenant: ${sellers.length}`)
      for (const row of sellers.slice(0, 20)) {
        console.log(`- sk_vendedor=${row.sk_vendedor} total=${row.total}`)
      }
    }
  } catch (error) {
    console.log(`erro: ${error.message}`)
  }
}

async function main() {
  const orgs = await listOrganizations()
  if (!orgs.length) {
    console.log("Nenhuma organizacao Oracle ativa encontrada.")
    return
  }

  for (const org of orgs) {
    await diagnoseOrg(org)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Diagnosis failed:", error)
    process.exit(1)
  })
