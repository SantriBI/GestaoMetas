// Script somente leitura (SELECT): extrai todos os usuarios cadastrados (todas as organizacoes/tenants),
// resolve a(s) loja(s) de cada um via Oracle (FATO_FUNCIONARIOS_ACESSOS / DIM_EMPRESAS) e grava:
//   - scripts/output/relatorio-usuarios-data.json  (dados brutos, para auditoria/depuracao)
//   - <raiz do projeto>/relatorio_usuarios.html     (dashboard com os dados reais embutidos)
//
// Uso: node scripts/relatorio-usuarios.js   (a partir de GestaoMetas/GestaoMetas/Back)
import "../src/config/env.js"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pLimit from "p-limit"

import centralPool from "../src/db/mysql.js"
import { queryTenantByEmpresaId } from "../src/db/mysql-tenants.js"
import { getLojasAcessoByCpf } from "../src/services/lojaAcessoService.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "../../..") // .../GestaoMetas (raiz, onde vive relatorio_usuarios.html)
const OUTPUT_JSON = path.resolve(__dirname, "output/relatorio-usuarios-data.json")
const OUTPUT_HTML = path.resolve(PROJECT_ROOT, "relatorio_usuarios.html")
const HTML_TEMPLATE = path.resolve(PROJECT_ROOT, "relatorio_usuarios.html")

const USER_COLUMNS =
  "id_usuario, login, nome, nome_completo, cpf, role, ativo, empresa_id, ultimo_login, criado_em"

function normalizeCpf(v) {
  return String(v ?? "").replace(/\D/g, "")
}

function toIsoOrNull(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function fetchAllUsers() {
  console.log("[relatorio-usuarios] Buscando organizacoes...")
  const [orgs] = await centralPool.query(
    "SELECT id_organizacao, nome, ativo, db_name FROM organizacoes_auth ORDER BY nome"
  )
  console.log(`[relatorio-usuarios] ${orgs.length} organizacoes encontradas.`)

  const orgById = new Map(orgs.map((o) => [Number(o.id_organizacao), o]))
  const seen = new Set() // dedupe por id_usuario+origem
  const raw = []

  // Usuarios do MySQL central (SUPERADMIN/ADMIN/GERENTE_SISTEMAS e legados com empresa_id)
  try {
    const [centrais] = await centralPool.query(`SELECT ${USER_COLUMNS} FROM usuarios_auth`)
    for (const u of centrais) {
      const key = `central:${u.id_usuario}`
      if (seen.has(key)) continue
      seen.add(key)
      raw.push({ ...u, source: "central" })
    }
    console.log(`[relatorio-usuarios] ${centrais.length} usuarios no MySQL central.`)
  } catch (error) {
    console.warn("[relatorio-usuarios] Falha ao ler usuarios centrais:", error?.message ?? error)
  }

  // Usuarios de cada tenant (VENDEDOR/GERENTE/PAINEL/INDUSTRIA/ADMIN por organizacao)
  for (const org of orgs) {
    if (!org.db_name) continue
    try {
      const rows = await queryTenantByEmpresaId(org.id_organizacao, `SELECT ${USER_COLUMNS} FROM usuarios_auth`)
      for (const u of rows) {
        const key = `tenant:${org.id_organizacao}:${u.id_usuario}`
        if (seen.has(key)) continue
        seen.add(key)
        raw.push({ ...u, source: "tenant", empresa_id: u.empresa_id ?? org.id_organizacao })
      }
      console.log(`[relatorio-usuarios] Organizacao "${org.nome}": ${rows.length} usuarios.`)
    } catch (error) {
      console.warn(
        `[relatorio-usuarios] Falha ao ler usuarios do tenant da organizacao ${org.id_organizacao} (${org.nome}):`,
        error?.message ?? error
      )
    }
  }

  console.log(`[relatorio-usuarios] Total bruto (antes de resolver lojas): ${raw.length} usuarios.`)

  // Resolve a(s) loja(s) via Oracle, com concorrencia limitada para nao sobrecarregar o Oracle de producao
  const limit = pLimit(4)
  let resolved = 0
  await Promise.all(
    raw.map((u) =>
      limit(async () => {
        const empresaId = Number(u.empresa_id)
        const cpf = normalizeCpf(u.cpf)
        u._lojas = []
        if (empresaId && cpf.length === 11) {
          try {
            u._lojas = await getLojasAcessoByCpf(empresaId, cpf)
          } catch (error) {
            console.warn(
              `[relatorio-usuarios] Falha ao resolver lojas (empresa=${empresaId}, cpf=***${cpf.slice(-4)}):`,
              error?.message ?? error
            )
          }
        }
        resolved += 1
        if (resolved % 50 === 0) console.log(`[relatorio-usuarios] Lojas resolvidas: ${resolved}/${raw.length}`)
      })
    )
  )

  const now = Date.now()
  const users = raw.map((u) => {
    const org = orgById.get(Number(u.empresa_id))
    const orgNome = org?.nome ?? (u.role === "SUPERADMIN" || u.role === "GERENTE_SISTEMAS" ? "Administração" : "Sem organização")

    let loja = orgNome
    if (u._lojas && u._lojas.length === 1) {
      loja = `${orgNome} · ${u._lojas[0].nomeResumido}`
    } else if (u._lojas && u._lojas.length > 1) {
      loja = `${orgNome} · ${u._lojas[0].nomeResumido} (+${u._lojas.length - 1})`
    }

    const ultimoLoginIso = toIsoOrNull(u.ultimo_login)
    const lastActiveDays = ultimoLoginIso ? Math.floor((now - new Date(ultimoLoginIso).getTime()) / 86400000) : null

    let status
    if (String(u.ativo ?? "S").toUpperCase() !== "S") status = "Inativo"
    else if (lastActiveDays === null) status = "Nunca acessou"
    else if (lastActiveDays <= 7) status = "Ativo"
    else if (lastActiveDays <= 30) status = "Recente"
    else status = "Inativo"

    return {
      nome: u.nome_completo || u.nome || u.login,
      login: u.login,
      email: null,
      loja,
      role: u.role,
      lastActiveDays,
      status,
    }
  })

  return users
}

function buildHtml(users) {
  const template = fs.readFileSync(HTML_TEMPLATE, "utf8")
  const marker = "/* __RELATORIO_USUARIOS_DATA_START__ */"
  const markerEnd = "/* __RELATORIO_USUARIOS_DATA_END__ */"
  const startIdx = template.indexOf(marker)
  const endIdx = template.indexOf(markerEnd)
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      "Marcadores de dados nao encontrados em relatorio_usuarios.html. Rode primeiro o build do template (ver instrucoes)."
    )
  }
  const dataBlock = `${marker}\n  var REAL_USERS_DATA = ${JSON.stringify(users)};\n  ${markerEnd}`
  return template.slice(0, startIdx) + dataBlock + template.slice(endIdx + markerEnd.length)
}

async function main() {
  const users = await fetchAllUsers()

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(users, null, 2), "utf8")
  console.log(`[relatorio-usuarios] JSON salvo em: ${OUTPUT_JSON}`)

  const html = buildHtml(users)
  fs.writeFileSync(OUTPUT_HTML, html, "utf8")
  console.log(`[relatorio-usuarios] Dashboard atualizado em: ${OUTPUT_HTML}`)
  console.log(`[relatorio-usuarios] Total de usuarios no relatorio: ${users.length}`)

  process.exit(0)
}

main().catch((error) => {
  console.error("[relatorio-usuarios] Falha:", error)
  process.exit(1)
})
