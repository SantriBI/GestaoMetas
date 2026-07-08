import express from "express"
import bcrypt from "bcrypt"
import oracledb, { getOracleRuntimeInfo } from "../db/oracleClient.js"
import { requireAuth } from "../middleware/auth.js"
import { auditAction } from "../audit.js"
import { encryptSecret, decryptSecret, SecretDecryptError } from "../security/secrets.js"
import {
  dropOracleProvisionedViews,
  provisionOracleSchemaObjects,
  provisionOracleViews,
} from "../services/oracleProvisioningService.js"
import centralPool from "../db/mysql.js"
import {
  ensureTenantDatabaseForOrg,
  getTenantDbNameByEmpresaId,
  queryTenantByEmpresaId,
  dropTenantDatabaseByEmpresaId,
  migrateGlobalVendedoresToTenant,
  describeTenantProvisioningError,
} from "../db/mysql-tenants.js"
import { findEmployeeNameByCpf, resolveAuthUserDisplayName } from "../services/authUsersService.js"
import {
  listSystemManagerOrganizations,
  replaceSystemManagerOrganizations,
} from "../services/gerenteSistemasService.js"

const router = express.Router()

router.use(requireAuth)

const IS_PROD = process.env.NODE_ENV === "production"
const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE_ORG_DELETE === "true"
const VENDOR_DEFAULT_PASSWORD = "sip123"
const LEGACY_ENCRYPTED_PASSWORD_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i

function guard(req, res) {
  if (req.auth?.role !== "SUPERADMIN") {
    res.status(403).json({ error: "Acesso restrito a SUPERADMIN." })
    return false
  }
  return true
}

function handleError(res, error, fallback) {
  if (error instanceof SecretDecryptError) {
    const msg = "Nao foi possivel ler a senha Oracle salva. Edite a organizacao e informe a senha novamente."
    console.warn(`${fallback} ${msg}`)
    return res.status(409).json({
      error: msg,
    })
  }
  console.error(fallback, error)
  const msg = error instanceof Error ? error.message : fallback
  return res.status(Number(error?.status) || 500).json({ error: msg })
}

function normalizeCPF(v) {
  return String(v ?? "").replace(/\D/g, "")
}

function normalizeOrganizationIds(value) {
  const source = Array.isArray(value) ? value : []
  return [...new Set(source.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))]
}

function normalizeConnectString(raw) {
  const s = String(raw ?? "").trim()
  if (!s.includes(":") && s.includes("/")) {
    return `${s.split("/")[0]}:1521/${s.split("/").slice(1).join("/")}`
  }
  return s
}

function pickOracleColumn(columns, candidates) {
  const available = new Set(columns.map((column) => String(column).toUpperCase()))
  return candidates.find((candidate) => available.has(candidate)) ?? null
}

function oracleTextExpr(columns, alias, candidates, fallback) {
  const column = pickOracleColumn(columns, candidates)
  return column ? `${column} AS ${alias}` : `${fallback} AS ${alias}`
}

function oracleCoalesceTextExpr(columns, alias, candidates, fallback) {
  const available = new Set(columns.map((column) => String(column).toUpperCase()))
  const expressions = candidates
    .filter((candidate) => available.has(candidate))
    .map((candidate) => `NULLIF(TRIM(TO_CHAR(${candidate})), '')`)

  return expressions.length ? `COALESCE(${expressions.join(", ")}) AS ${alias}` : `${fallback} AS ${alias}`
}

function cleanOracleText(value) {
  const text = String(value ?? "").trim()
  return text || null
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

async function getOraclePasswordForOrg(org) {
  const password = String(org?.oracle_password ?? "")
  if (!LEGACY_ENCRYPTED_PASSWORD_RE.test(password)) {
    throw httpError(
      409,
      `Senha Oracle da organizacao ${org?.id_organizacao ?? ""} nao esta criptografada. Rode Back/scripts/migrate-oracle-passwords.js antes de usar esta organizacao.`
    )
  }
  return decryptSecret(password)
}

async function lookupFuncionarioInOrg(org, cpfNorm) {
  if (!org?.oracle_user || !org?.oracle_password || !org?.oracle_connect_string) {
    return null
  }

  const plainPwd = await getOraclePasswordForOrg(org)
  let oracleConn = null

  try {
    oracleConn = await oracledb.getConnection({
      user: org.oracle_user,
      password: plainPwd,
      connectString: org.oracle_connect_string,
    })
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

    const columnsResult = await oracleConn.execute(
      `SELECT column_name
       FROM all_tab_columns
       WHERE table_name = 'FATO_FUNCIONARIOS_ACESSOS'`
    )
    const columns = (columnsResult.rows ?? []).map((row) => row.COLUMN_NAME ?? row.column_name).filter(Boolean)
    const nomeExpr = oracleTextExpr(
      columns,
      "nome",
      ["NOME_FUNCIONARIO", "NOME_COMPLETO", "NOME_COLABORADOR", "COLABORADOR", "FUNCIONARIO", "NOME_PESSOA", "NOME"],
      "'Funcionario encontrado'"
    )
    const lojaExpr = oracleTextExpr(
      columns,
      "loja",
      ["NOME_LOJA", "LOJA", "NOME_FILIAL", "FILIAL", "NOME_EMPRESA", "NOME_RESUMIDO", "EMPRESA", "EMPRESA_ACESSO"],
      "NULL"
    )
    const cargoExpr = oracleCoalesceTextExpr(
      columns,
      "cargo",
      [
        "NOME_CARGO",
        "CARGO",
        "CARGO_FUNCIONARIO",
        "DESCRICAO_CARGO",
        "DESC_CARGO",
        "DS_CARGO",
        "FUNCAO",
        "NOME_FUNCAO",
        "FUNCAO_FUNCIONARIO",
        "DESCRICAO_FUNCAO",
        "DESC_FUNCAO",
        "DS_FUNCAO",
        "NOME_PERFIL",
        "PERFIL",
        "DESCRICAO_PERFIL",
        "DESC_PERFIL",
      ],
      "NULL"
    )

    const queries = [
      `SELECT ${nomeExpr}, ${lojaExpr}, ${cargoExpr}, cpf_cnpj_sem_pontos, 'S' AS ativo FROM fato_funcionarios_acessos WHERE TRIM(cpf_cnpj_sem_pontos) = :cpf AND ROWNUM = 1`,
      `SELECT ${nomeExpr}, ${lojaExpr}, ${cargoExpr}, cpf_cnpj_sem_pontos, 'S' AS ativo FROM fato_funcionarios_acessos WHERE REGEXP_REPLACE(cpf_cnpj_sem_pontos,'[^0-9]','') = :cpf AND ROWNUM = 1`,
    ]

    for (const sql of queries) {
      try {
        const result = await oracleConn.execute(sql, { cpf: cpfNorm })
        if (result.rows?.length) return result.rows[0]
      } catch {}
    }

    return null
  } finally {
    if (oracleConn) try { await oracleConn.close() } catch {}
  }
}

function formatFuncionarioPreview(funcionario, org, cpfNorm) {
  return {
    cpf: cpfNorm,
    nome: cleanOracleText(funcionario.NOME ?? funcionario.nome) ?? "Funcionario encontrado",
    loja: cleanOracleText(funcionario.LOJA ?? funcionario.loja),
    cargo: cleanOracleText(funcionario.CARGO ?? funcionario.cargo),
    ativo: funcionario.ATIVO ?? funcionario.ativo ?? "S",
    role_sugerido: "GERENTE",
    empresa_id: org.id_organizacao,
    organizacao_nome: org.nome,
  }
}

async function resolveFuncionarioByCpf(cpfNorm, requestedEmpresaId = null) {
  if (requestedEmpresaId) {
    const [orgRows] = await centralPool.query(
      "SELECT * FROM organizacoes_auth WHERE id_organizacao = ? AND ativo = 'S'",
      [requestedEmpresaId]
    )
    if (!orgRows.length) throw httpError(404, "Organizacao nao encontrada ou inativa")

    const org = orgRows[0]
    const funcionario = await lookupFuncionarioInOrg(org, cpfNorm)
    if (!funcionario) throw httpError(403, "CPF nao pertence a organizacao selecionada.")

    return { org, funcionario }
  }

  const [orgs] = await centralPool.query(
    "SELECT * FROM organizacoes_auth WHERE ativo = 'S' AND oracle_user IS NOT NULL AND oracle_password IS NOT NULL AND oracle_connect_string IS NOT NULL ORDER BY nome"
  )
  const matches = []

  for (const org of orgs) {
    try {
      const funcionario = await lookupFuncionarioInOrg(org, cpfNorm)
      if (funcionario) matches.push({ org, funcionario })
    } catch (error) {
      console.warn("Falha ao validar CPF na organizacao:", org.id_organizacao, error?.message ?? error)
    }
  }

  if (matches.length === 0) throw httpError(404, "CPF nao encontrado em nenhuma organizacao ativa.")
  if (matches.length > 1) throw httpError(409, "CPF encontrado em mais de uma organizacao. Informe a organizacao explicitamente no modo administrativo.")

  return matches[0]
}

async function getActiveOrgById(empresaId) {
  const [orgRows] = await centralPool.query(
    "SELECT * FROM organizacoes_auth WHERE id_organizacao = ? AND ativo = 'S'",
    [empresaId]
  )
  return orgRows[0] ?? null
}

// ── Oracle connection test util ────────────────────────────────────────────────
router.get("/superadmin/gerentes-sistemas", async (req, res) => {
  if (!guard(req, res)) return

  try {
    const [users] = await centralPool.query(
      `
      SELECT id_usuario, nome, nome_completo, login, cpf, ativo, ultimo_login, criado_em
      FROM usuarios_auth
      WHERE role = 'GERENTE_SISTEMAS'
      ORDER BY COALESCE(nome_completo, nome, login)
      `
    )

    const data = await Promise.all(
      users.map(async (user) => ({
        ...user,
        role: "GERENTE_SISTEMAS",
        organizacoes: await listSystemManagerOrganizations(user.id_usuario),
      }))
    )

    return res.json({ data })
  } catch (error) {
    return handleError(res, error, "Erro ao listar Gerentes de Sistemas.")
  }
})

router.post("/superadmin/gerentes-sistemas", async (req, res) => {
  if (!guard(req, res)) return

  const login = String(req.body?.login ?? "").trim()
  const senha = String(req.body?.senha ?? "")
  const nome = String(req.body?.nome ?? "").trim()
  const cpf = normalizeCPF(req.body?.cpf ?? login)
  const organizacoes = normalizeOrganizationIds(req.body?.organizacoes ?? req.body?.empresaIds)

  if (!login) return res.status(400).json({ error: "Login e obrigatorio." })
  if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." })
  if (!organizacoes.length) return res.status(400).json({ error: "Informe pelo menos uma organizacao." })

  try {
    const [orgRows] = await centralPool.query(
      `SELECT id_organizacao FROM organizacoes_auth WHERE id_organizacao IN (${organizacoes.map(() => "?").join(",")}) AND ativo = 'S'`,
      organizacoes
    )
    if (orgRows.length !== organizacoes.length) {
      return res.status(422).json({ error: "Uma ou mais organizacoes nao existem ou estao inativas." })
    }

    const [duplicates] = await centralPool.query(
      "SELECT id_usuario, role FROM usuarios_auth WHERE login = ? LIMIT 1",
      [login]
    )
    if (duplicates.length && String(duplicates[0].role ?? "").toUpperCase() !== "GERENTE_SISTEMAS") {
      return res.status(409).json({ error: "Ja existe um usuario com esse login em outro perfil." })
    }

    const hash = await bcrypt.hash(senha, 10)
    let idUsuario = duplicates[0]?.id_usuario ?? null

    if (idUsuario) {
      await centralPool.query(
        `
        UPDATE usuarios_auth
        SET senha_hash = ?,
            nome = COALESCE(NULLIF(?, ''), nome),
            nome_completo = COALESCE(NULLIF(?, ''), nome_completo),
            cpf = COALESCE(NULLIF(?, ''), cpf),
            ativo = 'S',
            senha_temporaria = 'N',
            token_version = token_version + 1
        WHERE id_usuario = ?
        `,
        [hash, nome, nome, cpf, idUsuario]
      )
    } else {
      const [result] = await centralPool.query(
        `
        INSERT INTO usuarios_auth
          (login, senha_hash, role, nome, nome_completo, cpf, ativo, senha_temporaria)
        VALUES (?, ?, 'GERENTE_SISTEMAS', ?, ?, ?, 'S', 'N')
        `,
        [login, hash, nome || login, nome || login, cpf || null]
      )
      idUsuario = result.insertId
    }

    await replaceSystemManagerOrganizations({ idUsuario, empresaIds: organizacoes })
    auditAction(req, "UPSERT_GERENTE_SISTEMAS", `id:${idUsuario} orgs:${organizacoes.join(",")}`)

    return res.status(duplicates.length ? 200 : 201).json({
      message: duplicates.length ? "Gerente de Sistemas atualizado com sucesso." : "Gerente de Sistemas cadastrado com sucesso.",
      id_usuario: idUsuario,
      role: "GERENTE_SISTEMAS",
      organizacoes,
    })
  } catch (error) {
    return handleError(res, error, "Erro ao salvar Gerente de Sistemas.")
  }
})

router.patch("/superadmin/gerentes-sistemas/:id", async (req, res) => {
  if (!guard(req, res)) return

  const { id } = req.params
  const nome = req.body?.nome === undefined ? undefined : String(req.body.nome ?? "").trim()
  const novaSenha = req.body?.novaSenha ? String(req.body.novaSenha) : null
  const organizacoes = req.body?.organizacoes === undefined && req.body?.empresaIds === undefined
    ? null
    : normalizeOrganizationIds(req.body?.organizacoes ?? req.body?.empresaIds)

  if (novaSenha && novaSenha.length < 6) {
    return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." })
  }
  if (organizacoes && !organizacoes.length) {
    return res.status(400).json({ error: "Informe pelo menos uma organizacao." })
  }

  try {
    const [users] = await centralPool.query(
      "SELECT id_usuario FROM usuarios_auth WHERE id_usuario = ? AND role = 'GERENTE_SISTEMAS' LIMIT 1",
      [id]
    )
    if (!users.length) return res.status(404).json({ error: "Gerente de Sistemas nao encontrado." })

    const updates = []
    const params = []

    if (nome !== undefined) {
      updates.push("nome = ?", "nome_completo = ?")
      params.push(nome || null, nome || null)
    }

    if (novaSenha) {
      updates.push("senha_hash = ?", "senha_temporaria = 'N'", "token_version = token_version + 1")
      params.push(await bcrypt.hash(novaSenha, 10))
    }

    if (updates.length) {
      params.push(id)
      await centralPool.query(`UPDATE usuarios_auth SET ${updates.join(", ")} WHERE id_usuario = ?`, params)
    }

    if (organizacoes) {
      const [orgRows] = await centralPool.query(
        `SELECT id_organizacao FROM organizacoes_auth WHERE id_organizacao IN (${organizacoes.map(() => "?").join(",")}) AND ativo = 'S'`,
        organizacoes
      )
      if (orgRows.length !== organizacoes.length) {
        return res.status(422).json({ error: "Uma ou mais organizacoes nao existem ou estao inativas." })
      }
      await replaceSystemManagerOrganizations({ idUsuario: id, empresaIds: organizacoes })
    }

    auditAction(req, "UPDATE_GERENTE_SISTEMAS", `id:${id}`)
    return res.json({ message: "Gerente de Sistemas atualizado com sucesso." })
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar Gerente de Sistemas.")
  }
})

router.patch("/superadmin/gerentes-sistemas/:id/status", async (req, res) => {
  if (!guard(req, res)) return

  const { id } = req.params
  const ativo = String(req.body?.ativo ?? "").toUpperCase()
  if (!["S", "N"].includes(ativo)) return res.status(400).json({ error: "ativo deve ser S ou N." })

  try {
    const [result] = await centralPool.query(
      "UPDATE usuarios_auth SET ativo = ?, token_version = token_version + 1 WHERE id_usuario = ? AND role = 'GERENTE_SISTEMAS'",
      [ativo, id]
    )
    if (!Number(result?.affectedRows ?? 0)) {
      return res.status(404).json({ error: "Gerente de Sistemas nao encontrado." })
    }

    auditAction(req, ativo === "S" ? "ACTIVATE_GERENTE_SISTEMAS" : "DEACTIVATE_GERENTE_SISTEMAS", `id:${id}`)
    return res.json({ message: `Gerente de Sistemas ${ativo === "S" ? "ativado" : "desativado"} com sucesso.` })
  } catch (error) {
    return handleError(res, error, "Erro ao alterar status do Gerente de Sistemas.")
  }
})

async function testOracleConnection(oracleUser, oraclePassword, oracleConnectString) {
  let conn = null
  const runtime = getOracleRuntimeInfo()
  try {
    conn = await oracledb.getConnection({
      user: oracleUser,
      password: oraclePassword,
      connectString: oracleConnectString,
    })
    await conn.execute("SELECT 1 FROM DUAL")
    return {
      ok: true,
      message: "Conexao Oracle realizada com sucesso.",
      oracleMode: runtime.mode,
      oracleClientVersion: runtime.oracleClientVersion,
    }
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message ?? "").split("\n")[0],
      oracleMode: runtime.mode,
      oracleClientVersion: runtime.oracleClientVersion,
    }
  } finally {
    if (conn) try { await conn.close() } catch {}
  }
}

// ── Sync vendedores de Oracle para tenant MySQL ────────────────────────────────
async function tryDropOracleViewsForDelete(org) {
  if (!org?.oracle_user || !org?.oracle_password || !org?.oracle_connect_string) {
    return { skipped: true, reason: "Organizacao sem credenciais Oracle completas." }
  }

  try {
    return await dropOracleProvisionedViews({
      user: org.oracle_user,
      password: await getOraclePasswordForOrg(org),
      connectString: org.oracle_connect_string,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("Cleanup Oracle ignorado ao excluir organizacao:", {
      id_organizacao: org.id_organizacao,
      error: message,
    })
    return {
      skipped: true,
      warning: "Nao foi possivel limpar as views Oracle; a organizacao foi removida do sistema.",
      error: message,
    }
  }
}

async function syncVendedoresOrg(org) {
  const { id_organizacao, oracle_user, oracle_password, oracle_connect_string, db_name } = org

  if (!oracle_user || !oracle_password || !oracle_connect_string || !db_name) {
    return { skipped: true, reason: "Organizacao sem credenciais Oracle ou database tenant" }
  }

  const plainPwd = await getOraclePasswordForOrg(org)
  let oracleConn = null
  let oracleRows = []

  try {
    oracleConn = await oracledb.getConnection({
      user: oracle_user,
      password: plainPwd,
      connectString: oracle_connect_string,
    })

    // Tenta queries candidatas para buscar vendedores (fallback entre schemas)
    const queries = [
      `SELECT sk_vendedor,
              nome_vendedor AS nome,
              REGEXP_REPLACE(cpf_cnpj_sem_pontos, '[^0-9]', '') AS cpf
       FROM DM_VENDAS.VW_RANKING_VENDEDORES
       WHERE REGEXP_REPLACE(cpf_cnpj_sem_pontos, '[^0-9]', '') IS NOT NULL
         AND LENGTH(REGEXP_REPLACE(cpf_cnpj_sem_pontos, '[^0-9]', '')) = 11`,
      `SELECT v.sk_vendedor, v.nome_vendedor AS nome,
              REGEXP_REPLACE(f.cpf, '[^0-9]', '') AS cpf
       FROM CRM_VW_RANKING_VENDEDORES r
       JOIN DIM_VENDEDOR v ON v.sk_vendedor = r.sk_vendedor
       LEFT JOIN DIM_FUNCIONARIO f ON f.sk_funcionario = v.sk_funcionario
       WHERE REGEXP_REPLACE(f.cpf, '[^0-9]', '') IS NOT NULL
         AND LENGTH(REGEXP_REPLACE(f.cpf, '[^0-9]', '')) = 11`,
      `SELECT f.id_funcionario AS sk_vendedor,
              f.nome_funcionario AS nome,
              REGEXP_REPLACE(f.cpf, '[^0-9]', '') AS cpf
       FROM fato_funcionarios_acessos f
       WHERE f.ativo = 'S'
         AND REGEXP_REPLACE(f.cpf, '[^0-9]', '') IS NOT NULL
         AND LENGTH(REGEXP_REPLACE(f.cpf, '[^0-9]', '')) = 11`,
      `SELECT sk_vendedor,
              nome_vendedor AS nome,
              REGEXP_REPLACE(cpf, '[^0-9]', '') AS cpf
       FROM DIM_VENDEDOR
       WHERE REGEXP_REPLACE(cpf, '[^0-9]', '') IS NOT NULL
         AND LENGTH(REGEXP_REPLACE(cpf, '[^0-9]', '')) = 11`,
    ]

    for (const sql of queries) {
      try {
        oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
        const result = await oracleConn.execute(sql)
        oracleRows = result.rows ?? []
        if (oracleRows.length) break
      } catch {}
    }
  } finally {
    if (oracleConn) try { await oracleConn.close() } catch {}
  }

  const tenantVendedoresAntes = (
    await queryTenantByEmpresaId(id_organizacao, "SELECT COUNT(*) AS cnt FROM usuarios_auth WHERE role = 'VENDEDOR'")
  )[0]?.cnt ?? 0

  // Migra legados do banco central para tenant
  const migrados = await migrateGlobalVendedoresToTenant(id_organizacao)

  const defaultHash = await bcrypt.hash(VENDOR_DEFAULT_PASSWORD, 10)
  let inseridos = 0, atualizados = 0, desativados = 0, ignorados = 0
  const cpfsOracle = new Set()

  for (const row of oracleRows) {
    const cpf = normalizeCPF(row.CPF ?? row.cpf)
    const nome = String(row.NOME ?? row.nome ?? "").trim()
    const skVendedor = Number(row.SK_VENDEDOR ?? row.sk_vendedor ?? 0) || null
    if (!cpf || cpf.length !== 11) { ignorados++; continue }
    cpfsOracle.add(cpf)

    try {
      const existing = await queryTenantByEmpresaId(
        id_organizacao,
        "SELECT id_usuario FROM usuarios_auth WHERE cpf = ? OR (sk_vendedor IS NOT NULL AND sk_vendedor = ?) LIMIT 1",
        [cpf, skVendedor]
      )

      if (existing.length) {
        await queryTenantByEmpresaId(
          id_organizacao,
          "UPDATE usuarios_auth SET nome = ?, nome_completo = ?, sk_vendedor = ?, ativo = 'S' WHERE id_usuario = ?",
          [nome, nome, skVendedor, existing[0].id_usuario]
        )
        atualizados++
      } else {
        await queryTenantByEmpresaId(
          id_organizacao,
          `INSERT INTO usuarios_auth (login, senha_hash, role, empresa_id, sk_vendedor, nome, nome_completo, cpf, ativo, senha_temporaria)
           VALUES (?, ?, 'VENDEDOR', ?, ?, ?, ?, ?, 'S', 'S')`,
          [cpf, defaultHash, id_organizacao, skVendedor, nome, nome, cpf]
        )
        inseridos++
      }
    } catch { ignorados++ }
  }

  // Desativa vendedores que nao estao mais no Oracle
  if (cpfsOracle.size > 0) {
    const cpfList = [...cpfsOracle].map(() => "?").join(",")
    const result = await queryTenantByEmpresaId(
      id_organizacao,
      `UPDATE usuarios_auth SET ativo = 'N' WHERE role = 'VENDEDOR' AND cpf NOT IN (${cpfList}) AND ativo = 'S'`,
      [...cpfsOracle]
    )
    desativados = result?.affectedRows ?? 0
  }

  const tenantVendedoresDepois = (
    await queryTenantByEmpresaId(id_organizacao, "SELECT COUNT(*) AS cnt FROM usuarios_auth WHERE role = 'VENDEDOR'")
  )[0]?.cnt ?? 0

  return {
    vendedores_lidos: oracleRows.length,
    inseridos,
    atualizados,
    desativados_sem_meta: desativados,
    ignorados_conflito: ignorados,
    migrados_do_global: migrados,
    tenant_vendedores_antes: Number(tenantVendedoresAntes),
    tenant_vendedores_depois: Number(tenantVendedoresDepois),
    database_destino: db_name,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE ORGANIZAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /superadmin/organizacoes/test-conexao
router.post("/superadmin/organizacoes/test-conexao", async (req, res) => {
  if (!guard(req, res)) return
  const { oracleUser, oraclePassword, oracleConnectString } = req.body
  if (!oracleUser || !oraclePassword || !oracleConnectString) {
    return res.status(400).json({ error: "oracleUser, oraclePassword e oracleConnectString sao obrigatorios" })
  }
  try {
    const result = await testOracleConnection(oracleUser, oraclePassword, normalizeConnectString(oracleConnectString))
    return res.json(result)
  } catch (error) {
    return handleError(res, error, "Erro ao testar conexao Oracle.")
  }
})

// GET /superadmin/organizacoes
router.get("/superadmin/organizacoes", async (req, res) => {
  if (!guard(req, res)) return
  try {
    const [rows] = await centralPool.query(
      "SELECT id_organizacao, nome, codigo, ativo, oracle_user, oracle_connect_string, db_name, criado_em, atualizado_em FROM organizacoes_auth ORDER BY nome"
    )
    return res.json(rows)
  } catch (error) {
    return handleError(res, error, "Erro ao listar organizacoes.")
  }
})

// POST /superadmin/organizacoes
router.post("/superadmin/organizacoes", async (req, res) => {
  if (!guard(req, res)) return

  const { nome, codigo, oracleUser, oraclePassword, oracleConnectString, ativo = "S" } = req.body

  if (!nome || !codigo || !oracleUser || !oraclePassword || !oracleConnectString) {
    return res.status(400).json({ error: "nome, codigo, oracleUser, oraclePassword e oracleConnectString sao obrigatorios" })
  }

  try {
    const [dup] = await centralPool.query("SELECT id_organizacao FROM organizacoes_auth WHERE nome = ?", [nome])
    if (dup.length) return res.status(409).json({ error: "Ja existe uma organizacao com esse nome." })

    const connectString = normalizeConnectString(oracleConnectString)
    const testeConn = await testOracleConnection(oracleUser, oraclePassword, connectString)
    if (!testeConn.ok) {
      return res.status(422).json({ error: `Falha na conexao Oracle: ${testeConn.error}` })
    }

    const oracleSchema = await provisionOracleSchemaObjects({
      user: oracleUser,
      password: oraclePassword,
      connectString,
    })

    const oracleViews = await provisionOracleViews({
      user: oracleUser,
      password: oraclePassword,
      connectString,
    })

    const encPwd = encryptSecret(oraclePassword)
    const [insert] = await centralPool.query(
      "INSERT INTO organizacoes_auth (nome, codigo, ativo, oracle_user, oracle_password, oracle_connect_string) VALUES (?, ?, ?, ?, ?, ?)",
      [nome, codigo, ativo, oracleUser, encPwd, connectString]
    )
    const orgId = insert.insertId

    let dbName = null
    try {
      dbName = await ensureTenantDatabaseForOrg(orgId, nome)
    } catch (provErr) {
      await centralPool.query("DELETE FROM organizacoes_auth WHERE id_organizacao = ?", [orgId])
      return res.status(500).json({ error: describeTenantProvisioningError(provErr) })
    }

    // Tenta sync de vendedores (nao bloqueia)
    let vendorSync = null
    let vendorSyncWarning = null
    try {
      const [orgRow] = await centralPool.query("SELECT * FROM organizacoes_auth WHERE id_organizacao = ?", [orgId])
      vendorSync = await syncVendedoresOrg(orgRow[0])
    } catch (syncErr) {
      vendorSyncWarning = String(syncErr?.message ?? "Falha no sync de vendedores (nao critico)")
    }

    auditAction(req, "CREATE_ORG", `org:${orgId}:${nome}`)
    return res.status(201).json({
      message: "Organizacao criada com sucesso.",
      db_name: dbName,
      oracle_schema: oracleSchema,
      oracle_views: oracleViews,
      vendor_sync: vendorSync,
      vendor_sync_warning: vendorSyncWarning,
    })
  } catch (error) {
    return handleError(res, error, "Erro ao criar organizacao.")
  }
})

// PATCH /superadmin/organizacoes/:id
router.patch("/superadmin/organizacoes/:id", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params
  const { nome, codigo, oracleUser, oraclePassword, oracleConnectString, ativo } = req.body

  if (!nome || !codigo || !oracleUser || !oracleConnectString) {
    return res.status(400).json({ error: "nome, codigo, oracleUser e oracleConnectString sao obrigatorios" })
  }

  try {
    const [existing] = await centralPool.query("SELECT * FROM organizacoes_auth WHERE id_organizacao = ?", [id])
    if (!existing.length) return res.status(404).json({ error: "Organizacao nao encontrada" })

    const [dup] = await centralPool.query(
      "SELECT id_organizacao FROM organizacoes_auth WHERE nome = ? AND id_organizacao != ?",
      [nome, id]
    )
    if (dup.length) return res.status(409).json({ error: "Ja existe outra organizacao com esse nome." })

    const connectString = normalizeConnectString(oracleConnectString)
    const current = existing[0]

    // Valida conexao com a senha (nova ou existente decriptada)
    const passwordToTest = oraclePassword ? oraclePassword : await getOraclePasswordForOrg(current)
    const testeConn = await testOracleConnection(oracleUser, passwordToTest, connectString)
    if (!testeConn.ok) {
      return res.status(422).json({ error: `Falha na conexao Oracle: ${testeConn.error}` })
    }

    const oracleSchema = await provisionOracleSchemaObjects({
      user: oracleUser,
      password: passwordToTest,
      connectString,
    })

    const oracleViews = await provisionOracleViews({
      user: oracleUser,
      password: passwordToTest,
      connectString,
    })

    const encPwd = oraclePassword ? encryptSecret(oraclePassword) : current.oracle_password

    await centralPool.query(
      "UPDATE organizacoes_auth SET nome = ?, codigo = ?, ativo = ?, oracle_user = ?, oracle_password = ?, oracle_connect_string = ? WHERE id_organizacao = ?",
      [nome, codigo, ativo ?? current.ativo, oracleUser, encPwd, connectString, id]
    )

    auditAction(req, "UPDATE_ORG", `org:${id}:${nome}`)
    return res.json({
      message: "Organizacao atualizada com sucesso.",
      oracle_schema: oracleSchema,
      oracle_views: oracleViews,
    })
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar organizacao.")
  }
})

// DELETE /superadmin/organizacoes/:id
router.delete("/superadmin/organizacoes/:id", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params

  try {
    const [existing] = await centralPool.query("SELECT * FROM organizacoes_auth WHERE id_organizacao = ?", [id])
    if (!existing.length) return res.status(404).json({ error: "Organizacao nao encontrada" })
    const org = existing[0]

    if (ALLOW_DESTRUCTIVE) {
      const { confirmacao } = req.body
      if (confirmacao !== `EXCLUIR_ORGANIZACAO_${id}`) {
        return res.status(400).json({ error: `Para excluir, envie body: { confirmacao: "EXCLUIR_ORGANIZACAO_${id}" }` })
      }
    }

    const oracleCleanup = await tryDropOracleViewsForDelete(org)

    const [removedUsers] = await centralPool.query(
      "DELETE FROM usuarios_auth WHERE empresa_id = ?",
      [id]
    )
    const usuariosRemovidosCentral = removedUsers.affectedRows ?? 0

    const databaseRemovido = ALLOW_DESTRUCTIVE
      ? await dropTenantDatabaseByEmpresaId(id).catch(() => null)
      : null
    await centralPool.query("DELETE FROM organizacoes_auth WHERE id_organizacao = ?", [id])

    auditAction(req, "DELETE_ORG", `org:${id}`)
    return res.json({
      message: "Organizacao removida com sucesso.",
      oracle_cleanup: oracleCleanup,
      database_removido: databaseRemovido,
      database_preservado: !ALLOW_DESTRUCTIVE ? org.db_name ?? null : null,
      usuarios_removidos_central: usuariosRemovidosCentral,
    })
  } catch (error) {
    return handleError(res, error, "Erro ao remover organizacao.")
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE GERENTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /superadmin/gerentes
router.get("/superadmin/gerentes", async (req, res) => {
  if (!guard(req, res)) return
  try {
    const [orgs] = await centralPool.query(
      "SELECT id_organizacao, nome, ativo, db_name FROM organizacoes_auth ORDER BY nome"
    )

    const result = []
    for (const org of orgs) {
      const seen = new Set()
      const pushGerente = async (g, source) => {
        const key = normalizeCPF(g.cpf || g.login) || String(g.login || g.id_usuario)
        if (seen.has(key)) return
        seen.add(key)

        const gerente = await resolveAuthUserDisplayName({
          ...g,
          role: "GERENTE",
          empresa_id: org.id_organizacao,
          source,
        })
        result.push({
          ...gerente,
          empresa_id: org.id_organizacao,
          organizacao_nome: org.nome,
          source,
        })
      }

      if (org.db_name) {
        try {
          const gerentes = await queryTenantByEmpresaId(
            org.id_organizacao,
            "SELECT id_usuario, nome, nome_completo, login, cpf, ativo, empresa_id, ultimo_login FROM usuarios_auth WHERE role = 'GERENTE' ORDER BY COALESCE(nome_completo, nome, login)"
          )
          for (const g of gerentes) {
            await pushGerente(g, "tenant")
          }
        } catch (error) {
          console.warn(
            `[superadmin] Falha ao listar gerentes do tenant da organizacao ${org.id_organizacao}:`,
            error?.message ?? error
          )
        }
      }

      try {
        const [gerentesCentrais] = await centralPool.query(
          "SELECT id_usuario, nome, nome_completo, login, cpf, ativo, empresa_id, ultimo_login FROM usuarios_auth WHERE role = 'GERENTE' AND empresa_id = ? ORDER BY COALESCE(nome_completo, nome, login)",
          [org.id_organizacao]
        )
        for (const g of gerentesCentrais) {
          const gerente = await resolveAuthUserDisplayName({
            ...g,
            role: "GERENTE",
            empresa_id: org.id_organizacao,
            source: "central",
          })
          const key = normalizeCPF(gerente.cpf || gerente.login) || String(gerente.login || gerente.id_usuario)
          if (seen.has(key)) continue
          seen.add(key)
          result.push({ ...gerente, empresa_id: org.id_organizacao, organizacao_nome: org.nome, source: "central" })
        }
      } catch (error) {
        console.warn(
          `[superadmin] Falha ao listar gerentes centrais da organizacao ${org.id_organizacao}:`,
          error?.message ?? error
        )
      }
    }

    result.sort((a, b) => String(a.organizacao_nome).localeCompare(String(b.organizacao_nome)) || String(a.nome_completo ?? "").localeCompare(String(b.nome_completo ?? "")))
    return res.json(result)
  } catch (error) {
    return handleError(res, error, "Erro ao listar gerentes.")
  }
})

// POST /superadmin/funcionario-lookup
router.post("/superadmin/funcionario-lookup", async (req, res) => {
  if (!guard(req, res)) return
  const { cpf, empresaId } = req.body
  const cpfNorm = normalizeCPF(cpf)

  if (cpfNorm.length !== 11) {
    return res.status(400).json({ error: "CPF deve ter 11 digitos" })
  }
  if (!empresaId) {
    return res.status(400).json({ error: "Selecione a organizacao para validar o CPF." })
  }

  try {
    const { org, funcionario } = await resolveFuncionarioByCpf(cpfNorm, empresaId)
    return res.json(formatFuncionarioPreview(funcionario, org, cpfNorm))
  } catch (error) {
    return handleError(res, error, "Erro ao buscar funcionario no Oracle.")
  }
})

// POST /superadmin/gerentes
router.post("/superadmin/gerentes", async (req, res) => {
  if (!guard(req, res)) return
  const { cpf, senha, empresaId: requestedEmpresaId, nome } = req.body
  const cpfNorm = normalizeCPF(cpf)
  const nomeManual = String(nome ?? "").trim()

  if (cpfNorm.length !== 11) return res.status(400).json({ error: "CPF deve ter 11 digitos" })
  if (!senha || String(senha).length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" })

  try {
    let org = null
    let funcionario = null

    if (requestedEmpresaId) {
      org = await getActiveOrgById(requestedEmpresaId)
      if (!org) return res.status(404).json({ error: "Organizacao nao encontrada ou inativa" })

      funcionario = await lookupFuncionarioInOrg(org, cpfNorm).catch((error) => {
        console.warn("Falha ao validar CPF no Oracle da organizacao:", org.id_organizacao, error?.message ?? error)
        return null
      })

      if (!funcionario && !nomeManual) {
        return res.status(422).json({ error: "CPF nao encontrado no Oracle desta organizacao. Informe o nome para cadastro manual." })
      }
    } else {
      const resolved = await resolveFuncionarioByCpf(cpfNorm)
      org = resolved.org
      funcionario = resolved.funcionario
    }

    const empresaId = org.id_organizacao

    const dbName = await getTenantDbNameByEmpresaId(empresaId)
    if (!dbName) return res.status(422).json({ error: "Database tenant nao provisionado para esta organizacao" })

    // Verifica duplicata no tenant
    const dup = await queryTenantByEmpresaId(
      empresaId,
      "SELECT id_usuario, role FROM usuarios_auth WHERE login = ? OR cpf = ? LIMIT 1",
      [cpfNorm, cpfNorm]
    )

    const hash = await bcrypt.hash(senha, 10)
    const nomeGerente = nomeManual || (funcionario ? formatFuncionarioPreview(funcionario, org, cpfNorm).nome : null) || await findEmployeeNameByCpf(empresaId, cpfNorm) || null

    if (dup.length) {
      const existingRole = String(dup[0].role ?? "").toUpperCase()

      if (existingRole === "VENDEDOR") {
        return res.status(409).json({
          error: "Este CPF ja esta cadastrado como vendedor nesta organizacao. Nao e possivel transforma-lo em gerente pelo cadastro administrativo.",
        })
      }

      // Reativa/atualiza gerente ja existente sem alterar vendedores.
      await queryTenantByEmpresaId(
        empresaId,
        "UPDATE usuarios_auth SET role = 'GERENTE', senha_hash = ?, nome = COALESCE(?, nome), nome_completo = COALESCE(?, nome_completo), ativo = 'S', senha_temporaria = 'N' WHERE id_usuario = ?",
        [hash, nomeGerente, nomeGerente, dup[0].id_usuario]
      )
      auditAction(req, "PROMOTE_GERENTE", `cpf:${cpfNorm} empresa:${empresaId}`)
      return res.json({ message: "Usuario promovido a GERENTE com sucesso.", role: "GERENTE", empresa_id: empresaId, database_destino: dbName })
    }

    await queryTenantByEmpresaId(
      empresaId,
      "INSERT INTO usuarios_auth (login, senha_hash, role, empresa_id, cpf, nome, nome_completo, ativo, senha_temporaria) VALUES (?, ?, 'GERENTE', ?, ?, ?, ?, 'S', 'N')",
      [cpfNorm, hash, empresaId, cpfNorm, nomeGerente ?? cpfNorm, nomeGerente ?? cpfNorm]
    )

    auditAction(req, "CREATE_GERENTE", `cpf:${cpfNorm} empresa:${empresaId}`)
    return res.status(201).json({ message: "Gerente cadastrado com sucesso.", role: "GERENTE", empresa_id: empresaId, database_destino: dbName })
  } catch (error) {
    return handleError(res, error, "Erro ao cadastrar gerente.")
  }
})

// PATCH /superadmin/gerentes/:id
router.patch("/superadmin/gerentes/:id", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params
  const empresaId = req.query.empresa_id
  const source = req.query.source === "central" ? "central" : "tenant"
  const { empresaId: novaEmpresaId, novaSenha } = req.body

  if (!empresaId && source !== "central") return res.status(400).json({ error: "empresa_id obrigatorio como query param" })

  try {
    const gerenteRows = source === "central"
      ? (await centralPool.query("SELECT * FROM usuarios_auth WHERE id_usuario = ? AND role = 'GERENTE' LIMIT 1", [id]))[0]
      : await queryTenantByEmpresaId(
          empresaId,
          "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
          [id]
        )
    if (!gerenteRows.length) return res.status(404).json({ error: "Gerente nao encontrado" })
    const gerente = gerenteRows[0]
    const origemEmpresaId = empresaId ?? gerente.empresa_id

    // Mover de organizacao
    if (novaEmpresaId && String(novaEmpresaId) !== String(origemEmpresaId)) {
      const destDb = await getTenantDbNameByEmpresaId(novaEmpresaId)
      if (!destDb) return res.status(422).json({ error: "Database tenant de destino nao provisionado" })

      const dupDest = await queryTenantByEmpresaId(
        novaEmpresaId,
        "SELECT id_usuario FROM usuarios_auth WHERE login = ? LIMIT 1",
        [gerente.login]
      )
      if (dupDest.length) return res.status(409).json({ error: "Ja existe um usuario com esse login na organizacao de destino" })

      const hash = novaSenha ? await bcrypt.hash(novaSenha, 10) : gerente.senha_hash
      await queryTenantByEmpresaId(
        novaEmpresaId,
        "INSERT INTO usuarios_auth (login, senha_hash, role, empresa_id, cpf, nome, nome_completo, ativo, senha_temporaria) VALUES (?, ?, 'GERENTE', ?, ?, ?, ?, 'S', 'N')",
        [gerente.login, hash, novaEmpresaId, gerente.cpf, gerente.nome, gerente.nome_completo]
      )
      if (source === "central") {
        await centralPool.query("DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
      } else {
        await queryTenantByEmpresaId(empresaId, "DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
      }
      auditAction(req, "MOVE_GERENTE", `id:${id} de:${origemEmpresaId} para:${novaEmpresaId}`)
      return res.json({ message: "Gerente movido para nova organizacao." })
    }

    if (novaSenha) {
      const hash = await bcrypt.hash(novaSenha, 10)
      if (source === "central") {
        await centralPool.query(
          "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
          [hash, id]
        )
      } else {
        await queryTenantByEmpresaId(
          empresaId,
          "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
          [hash, id]
        )
      }
    }

    auditAction(req, "UPDATE_GERENTE", `id:${id} empresa:${origemEmpresaId} source:${source}`)
    return res.json({ message: "Gerente atualizado com sucesso." })
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar gerente.")
  }
})

// PATCH /superadmin/gerentes/:id/status
router.patch("/superadmin/gerentes/:id/status", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params
  const empresaId = req.query.empresa_id
  const source = req.query.source === "central" ? "central" : "tenant"
  const { ativo } = req.body

  if (!empresaId && source !== "central") return res.status(400).json({ error: "empresa_id obrigatorio" })
  if (!["S", "N"].includes(ativo)) return res.status(400).json({ error: "ativo deve ser S ou N" })

  try {
    if (source === "central") {
      await centralPool.query(
        "UPDATE usuarios_auth SET ativo = ? WHERE id_usuario = ?",
        [ativo, id]
      )
    } else {
      await queryTenantByEmpresaId(
        empresaId,
        "UPDATE usuarios_auth SET ativo = ? WHERE id_usuario = ?",
        [ativo, id]
      )
    }
    auditAction(req, ativo === "S" ? "ACTIVATE_GERENTE" : "DEACTIVATE_GERENTE", `id:${id} empresa:${empresaId ?? "central"} source:${source}`)
    return res.json({ message: `Gerente ${ativo === "S" ? "ativado" : "desativado"} com sucesso.` })
  } catch (error) {
    return handleError(res, error, "Erro ao alterar status do gerente.")
  }
})

// DELETE /superadmin/gerentes/:id
router.delete("/superadmin/gerentes/:id", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params
  const empresaId = req.query.empresa_id
  const source = req.query.source === "central" ? "central" : "tenant"

  try {
    if (source === "central" || !empresaId) {
      await centralPool.query("DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
    } else {
      await queryTenantByEmpresaId(empresaId, "DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
    }
    auditAction(req, "DELETE_GERENTE", `id:${id} empresa:${empresaId ?? "central"} source:${source}`)
    return res.json({ message: "Gerente removido com sucesso." })
  } catch (error) {
    return handleError(res, error, "Erro ao remover gerente.")
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE SINCRONIZACAO DE VENDEDORES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /superadmin/organizacoes/:id/provisionar-schema
router.post("/superadmin/organizacoes/:id/provisionar-schema", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params

  try {
    const [orgRows] = await centralPool.query("SELECT * FROM organizacoes_auth WHERE id_organizacao = ?", [id])
    if (!orgRows.length) return res.status(404).json({ error: "Organizacao nao encontrada" })
    const org = orgRows[0]

    const password = await getOraclePasswordForOrg(org)
    const connectString = normalizeConnectString(org.oracle_connect_string)

    const oracleSchema = await provisionOracleSchemaObjects({
      user: org.oracle_user,
      password,
      connectString,
    })
    const oracleViews = await provisionOracleViews({
      user: org.oracle_user,
      password,
      connectString,
    })

    auditAction(req, "PROVISION_ORG_SCHEMA", `org:${id}:${org.nome}`)
    return res.json({
      message: "Verificacao concluida.",
      oracle_schema: oracleSchema,
      oracle_views: oracleViews,
    })
  } catch (error) {
    return handleError(res, error, "Erro ao provisionar schema Oracle da organizacao.")
  }
})

// POST /superadmin/organizacoes/:id/sync-vendedores
router.post("/superadmin/organizacoes/:id/sync-vendedores", async (req, res) => {
  if (!guard(req, res)) return
  const { id } = req.params

  try {
    const [orgRows] = await centralPool.query("SELECT * FROM organizacoes_auth WHERE id_organizacao = ? AND ativo = 'S'", [id])
    if (!orgRows.length) return res.status(404).json({ error: "Organizacao nao encontrada ou inativa" })

    const result = await syncVendedoresOrg(orgRows[0])
    auditAction(req, "SYNC_VENDEDORES", `org:${id}`)
    return res.json(result)
  } catch (error) {
    return handleError(res, error, "Erro ao sincronizar vendedores.")
  }
})

// POST /superadmin/sync-vendedores (todas as orgs)
router.post("/superadmin/sync-vendedores", async (req, res) => {
  if (!guard(req, res)) return
  try {
    const [orgs] = await centralPool.query(
      "SELECT * FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL"
    )
    const results = []
    for (const org of orgs) {
      try {
        const r = await syncVendedoresOrg(org)
        results.push({ id_organizacao: org.id_organizacao, nome: org.nome, ...r })
      } catch (err) {
        results.push({ id_organizacao: org.id_organizacao, nome: org.nome, error: String(err?.message ?? err) })
      }
    }
    auditAction(req, "SYNC_ALL_VENDEDORES", `orgs:${orgs.length}`)
    return res.json({ total_orgs: orgs.length, results })
  } catch (error) {
    return handleError(res, error, "Erro ao sincronizar vendedores em massa.")
  }
})

export default router
