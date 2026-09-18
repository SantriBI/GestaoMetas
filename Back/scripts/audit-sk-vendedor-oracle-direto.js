import "../src/config/env.js"
import oracledb from "../src/db/oracleClient.js"
import { queryTenantByEmpresaId } from "../src/db/mysql-tenants.js"

// Mesma auditoria de audit-sk-vendedor-empresa.js, mas conecta no Oracle direto com
// ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING (variaveis de ambiente), sem passar pela
// organizacoes_auth.oracle_password criptografada - use quando a APP_ENCRYPTION_KEY local nao
// bate com a que criptografou a senha em producao. So leitura, nao altera nada.
//
// Uso (PowerShell, tudo num comando so pra nao perder as variaveis):
//   $env:MYSQL_HOST='...'; $env:MYSQL_PORT='...'; $env:MYSQL_USER='...'; $env:MYSQL_PASSWORD='...'; $env:MYSQL_DATABASE='...';
//   $env:ORACLE_USER='...'; $env:ORACLE_PASSWORD='...'; $env:ORACLE_CONNECT_STRING='...';
//   node scripts/audit-sk-vendedor-oracle-direto.js --org=22

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const orgArg = process.argv.find((arg) => arg.startsWith("--org="))
const onlyOrgId = orgArg ? Number(orgArg.split("=")[1]) : null

if (!onlyOrgId) {
  console.error("Uso: node scripts/audit-sk-vendedor-oracle-direto.js --org=<id_organizacao>")
  process.exit(1)
}

const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env
if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
  console.error("Defina ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING no ambiente antes de rodar.")
  process.exit(1)
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

async function main() {
  const connection = await oracledb.getConnection({
    user: ORACLE_USER,
    password: ORACLE_PASSWORD,
    connectString: ORACLE_CONNECT_STRING,
  })

  async function oracleRows(sql, binds = {}) {
    const result = await connection.execute(sql, binds)
    return (result.rows ?? []).map(normalizeRow)
  }

  try {
    console.log(`Auditando org ${onlyOrgId} (conexao Oracle direta)...\n`)

    const cadastrados = await queryTenantByEmpresaId(
      onlyOrgId,
      `
      SELECT id_usuario, nome, nome_completo, cpf, sk_vendedor
      FROM usuarios_auth
      WHERE role = 'VENDEDOR' AND ativo = 'S' AND sk_vendedor IS NOT NULL
      `
    )

    if (!cadastrados.length) {
      console.log("Nenhum vendedor ativo com sk_vendedor cadastrado.")
      return
    }

    const skCadastrados = [...new Set(cadastrados.map((r) => Number(r.sk_vendedor)).filter(Number.isFinite))]

    const dimVendedorAtual = await oracleRows(
      `
      SELECT SK_VENDEDOR, VENDEDOR_ID, EMPRESA_ID, NOME_VENDEDOR
      FROM DIM_VENDEDOR
      WHERE SK_VENDEDOR IN (${skCadastrados.map((_, i) => `:sk${i}`).join(", ")})
      `,
      Object.fromEntries(skCadastrados.map((v, i) => [`sk${i}`, v]))
    )

    const vendedorIds = [...new Set(dimVendedorAtual.map((r) => r.vendedor_id).filter((v) => v != null))]
    if (!vendedorIds.length) {
      console.log("Nenhum SK_VENDEDOR cadastrado foi encontrado em DIM_VENDEDOR.")
      return
    }

    const irmaos = await oracleRows(
      `
      SELECT SK_VENDEDOR, VENDEDOR_ID, EMPRESA_ID, NOME_VENDEDOR
      FROM DIM_VENDEDOR
      WHERE VENDEDOR_ID IN (${vendedorIds.map((_, i) => `:vid${i}`).join(", ")})
      ORDER BY VENDEDOR_ID, EMPRESA_ID
      `,
      Object.fromEntries(vendedorIds.map((v, i) => [`vid${i}`, v]))
    )

    const skTodos = [...new Set(irmaos.map((r) => r.sk_vendedor))]
    const receitas = await oracleRows(
      `
      SELECT SK_VENDEDOR, SK_EMPRESA, RECEITA_MES, META_MES
      FROM VW_RANKING_VENDEDORES
      WHERE SK_VENDEDOR IN (${skTodos.map((_, i) => `:rv${i}`).join(", ")})
      `,
      Object.fromEntries(skTodos.map((v, i) => [`rv${i}`, v]))
    )
    const receitaBySk = new Map(receitas.map((r) => [r.sk_vendedor, r]))

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
  } finally {
    await connection.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
