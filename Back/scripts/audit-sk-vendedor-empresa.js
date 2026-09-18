import "../src/config/env.js"
import centralPool from "../src/db/mysql.js"
import { queryOracleByEmpresaId } from "../src/db/oracle-tenants.js"
import { queryTenantByEmpresaId } from "../src/db/mysql-tenants.js"

// Audita divergencia entre usuarios_auth.sk_vendedor (MySQL do tenant, 1 valor por login)
// e o SK_VENDEDOR realmente ativo no Oracle no mes corrente (VW_RANKING_VENDEDORES), quando
// o ERP recria SK_VENDEDOR por empresa (mesma pessoa, VENDEDOR_ID estavel, SK_VENDEDOR novo
// por empresa - caso FACHI 461 -> 481). Roda so leitura, nao altera nada.
//
// Uso: node scripts/audit-sk-vendedor-empresa.js --org=<id_organizacao>

const orgArg = process.argv.find((arg) => arg.startsWith("--org="))
const onlyOrgId = orgArg ? Number(orgArg.split("=")[1]) : null

if (!onlyOrgId) {
  console.error("Uso: node scripts/audit-sk-vendedor-empresa.js --org=<id_organizacao>")
  process.exit(1)
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

async function oracleRows(empresaId, sql, binds = {}) {
  return (await queryOracleByEmpresaId(empresaId, sql, binds, { suppressErrorLog: true })).map(normalizeRow)
}

async function main() {
  const [orgRows] = await centralPool.query(
    "SELECT id_organizacao, nome FROM organizacoes_auth WHERE id_organizacao = ?",
    [onlyOrgId]
  )
  const org = orgRows[0]
  if (!org) {
    console.error(`Organizacao ${onlyOrgId} nao encontrada em organizacoes_auth.`)
    process.exit(1)
  }
  console.log(`Auditando ${org.nome} (org ${org.id_organizacao})...\n`)

  // 1) Vendedores cadastrados no tenant (MySQL) - 1 sk_vendedor por login
  const cadastrados = await queryTenantByEmpresaId(
    org.id_organizacao,
    `
    SELECT id_usuario, nome, nome_completo, cpf, sk_vendedor
    FROM usuarios_auth
    WHERE role = 'VENDEDOR' AND ativo = 'S' AND sk_vendedor IS NOT NULL
    `
  )

  if (!cadastrados.length) {
    console.log("Nenhum vendedor ativo com sk_vendedor cadastrado.")
    process.exit(0)
  }

  const skCadastrados = [...new Set(cadastrados.map((r) => Number(r.sk_vendedor)).filter(Number.isFinite))]

  // 2) VENDEDOR_ID (chave estavel por pessoa) de cada sk_vendedor cadastrado
  const dimVendedorAtual = await oracleRows(
    org.id_organizacao,
    `
    SELECT SK_VENDEDOR, VENDEDOR_ID, EMPRESA_ID, NOME_VENDEDOR
    FROM DIM_VENDEDOR
    WHERE SK_VENDEDOR IN (${skCadastrados.map((_, i) => `:sk${i}`).join(", ")})
    `,
    Object.fromEntries(skCadastrados.map((v, i) => [`sk${i}`, v]))
  )

  const vendedorIds = [...new Set(dimVendedorAtual.map((r) => r.vendedor_id).filter((v) => v != null))]
  if (!vendedorIds.length) {
    console.log("Nenhum SK_VENDEDOR cadastrado foi encontrado em DIM_VENDEDOR (verifique se sao dessa organizacao).")
    process.exit(0)
  }

  // 3) Todos os SK_VENDEDOR (outras empresas incluidas) para os mesmos VENDEDOR_ID
  const irmaos = await oracleRows(
    org.id_organizacao,
    `
    SELECT SK_VENDEDOR, VENDEDOR_ID, EMPRESA_ID, NOME_VENDEDOR
    FROM DIM_VENDEDOR
    WHERE VENDEDOR_ID IN (${vendedorIds.map((_, i) => `:vid${i}`).join(", ")})
    ORDER BY VENDEDOR_ID, EMPRESA_ID
    `,
    Object.fromEntries(vendedorIds.map((v, i) => [`vid${i}`, v]))
  )

  // 4) Receita do mes corrente por SK_VENDEDOR (pra saber qual codigo esta realmente ativo)
  const skTodos = [...new Set(irmaos.map((r) => r.sk_vendedor))]
  const receitas = await oracleRows(
    org.id_organizacao,
    `
    SELECT SK_VENDEDOR, SK_EMPRESA, RECEITA_MES, META_MES
    FROM VW_RANKING_VENDEDORES
    WHERE SK_VENDEDOR IN (${skTodos.map((_, i) => `:rv${i}`).join(", ")})
    `,
    Object.fromEntries(skTodos.map((v, i) => [`rv${i}`, v]))
  )
  const receitaBySk = new Map(receitas.map((r) => [r.sk_vendedor, r]))

  // Monta grupos por vendedor_id e compara com o cadastrado
  const grupos = new Map()
  for (const row of irmaos) {
    if (!grupos.has(row.vendedor_id)) grupos.set(row.vendedor_id, [])
    grupos.get(row.vendedor_id).push(row)
  }

  const cadastroByVendedorId = new Map(
    dimVendedorAtual.map((r) => [r.vendedor_id, cadastrados.find((c) => Number(c.sk_vendedor) === r.sk_vendedor)])
  )

  let divergencias = 0
  for (const [vendedorId, linhas] of grupos) {
    const cadastro = cadastroByVendedorId.get(vendedorId)
    if (!cadastro) continue

    const skCadastrado = Number(cadastro.sk_vendedor)
    const comReceita = linhas.filter((l) => {
      const r = receitaBySk.get(l.sk_vendedor)
      return r && Number(r.receita_mes) !== 0
    })
    const skAtivoDiferente = comReceita.find((l) => l.sk_vendedor !== skCadastrado)

    if (linhas.length > 1 && skAtivoDiferente) {
      divergencias++
      console.log(`[DIVERGENCIA] ${cadastro.nome_completo ?? cadastro.nome} (cpf ${cadastro.cpf}, login id ${cadastro.id_usuario})`)
      console.log(`  cadastrado em usuarios_auth: sk_vendedor=${skCadastrado}`)
      for (const l of linhas) {
        const r = receitaBySk.get(l.sk_vendedor)
        const marker = l.sk_vendedor === skCadastrado ? "  <- cadastrado" : (l.sk_vendedor === skAtivoDiferente.sk_vendedor ? "  <- ATIVO (tem receita, nao cadastrado)" : "")
        console.log(
          `    sk_vendedor=${l.sk_vendedor} empresa_id=${l.empresa_id} receita_mes=${r?.receita_mes ?? "n/a"} sk_empresa=${r?.sk_empresa ?? "n/a"}${marker}`
        )
      }
      console.log("")
    }
  }

  console.log(`\nTotal analisado: ${grupos.size} vendedores | Divergencias encontradas: ${divergencias}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
