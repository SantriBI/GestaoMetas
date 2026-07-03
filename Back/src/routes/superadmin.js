import express from "express"
import bcrypt from "bcrypt"
import oracledb, { getOracleRuntimeInfo } from "../db/oracleClient.js"
import { requireAuth } from "../middleware/auth.js"
import { auditAction } from "../audit.js"
import { encryptSecret, decryptSecret } from "../security/secrets.js"
import { dropOracleProvisionedViews, provisionOracleViews } from "../services/oracleProvisioningService.js"
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

const router = express.Router()

router.use(requireAuth)

const IS_PROD = process.env.NODE_ENV === "production"
const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE_ORG_DELETE === "true"
const VENDOR_DEFAULT_PASSWORD = "sip123"

function guard(req, res) {
  if (req.auth?.role !== "SUPERADMIN") {
    res.status(403).json({ error: "Acesso restrito a SUPERADMIN." })
    return false
  }
  return true
}

function handleError(res, error, fallback) {
  console.error(fallback, error)
  const msg = error instanceof Error ? error.message : fallback
  return res.status(Number(error?.status) || 500).json({ error: msg })
}

function normalizeCPF(v) {
  return String(v ?? "").replace(/\D/g, "")
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

// ── Oracle connection test util ────────────────────────────────────────────────
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
      password: decryptSecret(org.oracle_password),
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

  const plainPwd = decryptSecret(oracle_password)
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
    return res.status(201).json({ message: "Organizacao criada com sucesso.", db_name: dbName, oracle_views: oracleViews, vendor_sync: vendorSync, vendor_sync_warning: vendorSyncWarning })
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
    const passwordToTest = oraclePassword ? oraclePassword : decryptSecret(current.oracle_password)
    const testeConn = await testOracleConnection(oracleUser, passwordToTest, connectString)
    if (!testeConn.ok) {
      return res.status(422).json({ error: `Falha na conexao Oracle: ${testeConn.error}` })
    }

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
    return res.json({ message: "Organizacao atualizada com sucesso.", oracle_views: oracleViews })
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
      "SELECT id_organizacao, nome FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL ORDER BY nome"
    )

    const result = []
    for (const org of orgs) {
      try {
        const gerentes = await queryTenantByEmpresaId(
          org.id_organizacao,
          "SELECT id_usuario, nome, nome_completo, login, cpf, ativo, empresa_id, ultimo_login FROM usuarios_auth WHERE role = 'GERENTE' ORDER BY COALESCE(nome_completo, nome, login)"
        )
        for (const g of gerentes) {
          const gerente = await resolveAuthUserDisplayName({
            ...g,
            role: "GERENTE",
            empresa_id: org.id_organizacao,
            source: "tenant",
          })
          result.push({ ...gerente, empresa_id: org.id_organizacao, organizacao_nome: org.nome })
        }
      } catch {}
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

  try {
    const [orgRows] = await centralPool.query(
      "SELECT * FROM organizacoes_auth WHERE id_organizacao = ? AND ativo = 'S'",
      [empresaId]
    )
    if (!orgRows.length) return res.status(404).json({ error: "Organizacao nao encontrada ou inativa" })

    const org = orgRows[0]
    if (!org.oracle_user) return res.status(422).json({ error: "Organizacao sem credenciais Oracle" })

    const plainPwd = decryptSecret(org.oracle_password)
    let oracleConn = null
    let funcionario = null

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
      const cargoExpr = oracleTextExpr(
        columns,
        "cargo",
        ["NOME_CARGO", "CARGO", "CARGO_FUNCIONARIO", "DESCRICAO_CARGO", "DESC_CARGO", "FUNCAO", "NOME_FUNCAO", "FUNCAO_FUNCIONARIO", "DESCRICAO_FUNCAO"],
        "NULL"
      )

      const queries = [
        `SELECT ${nomeExpr}, ${lojaExpr}, ${cargoExpr}, cpf_cnpj_sem_pontos, 'S' AS ativo FROM fato_funcionarios_acessos WHERE TRIM(cpf_cnpj_sem_pontos) = :cpf AND ROWNUM = 1`,
        `SELECT ${nomeExpr}, ${lojaExpr}, ${cargoExpr}, cpf_cnpj_sem_pontos, 'S' AS ativo FROM fato_funcionarios_acessos WHERE REGEXP_REPLACE(cpf_cnpj_sem_pontos,'[^0-9]','') = :cpf AND ROWNUM = 1`,
      ]

      for (const sql of queries) {
        try {
          const r = await oracleConn.execute(sql, { cpf: cpfNorm })
          if (r.rows?.length) { funcionario = r.rows[0]; break }
        } catch {}
      }
    } finally {
      if (oracleConn) try { await oracleConn.close() } catch {}
    }

    if (!funcionario) return res.status(404).json({ error: "Funcionario nao encontrado no Oracle" })

    return res.json({
      cpf: cpfNorm,
      nome: funcionario.NOME ?? funcionario.nome ?? "Funcionario encontrado",
      loja: funcionario.LOJA ?? funcionario.loja ?? null,
      cargo: funcionario.CARGO ?? funcionario.cargo ?? null,
      ativo: funcionario.ATIVO ?? funcionario.ativo ?? "S",
      role_sugerido: "GERENTE",
    })
  } catch (error) {
    return handleError(res, error, "Erro ao buscar funcionario no Oracle.")
  }
})

// POST /superadmin/gerentes
router.post("/superadmin/gerentes", async (req, res) => {
  if (!guard(req, res)) return
  const { cpf, senha, empresaId, nome } = req.body
  const cpfNorm = normalizeCPF(cpf)

  if (cpfNorm.length !== 11) return res.status(400).json({ error: "CPF deve ter 11 digitos" })
  if (!senha || String(senha).length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" })
  if (!empresaId) return res.status(400).json({ error: "empresaId obrigatorio" })

  try {
    const [orgRows] = await centralPool.query(
      "SELECT * FROM organizacoes_auth WHERE id_organizacao = ? AND ativo = 'S'",
      [empresaId]
    )
    if (!orgRows.length) return res.status(404).json({ error: "Organizacao nao encontrada ou inativa" })

    const dbName = await getTenantDbNameByEmpresaId(empresaId)
    if (!dbName) return res.status(422).json({ error: "Database tenant nao provisionado para esta organizacao" })

    // Verifica duplicata no tenant
    const dup = await queryTenantByEmpresaId(
      empresaId,
      "SELECT id_usuario, role FROM usuarios_auth WHERE login = ? OR cpf = ? LIMIT 1",
      [cpfNorm, cpfNorm]
    )

    const hash = await bcrypt.hash(senha, 10)
    const nomeGerente = String(nome ?? "").trim() || await findEmployeeNameByCpf(empresaId, cpfNorm) || null

    if (dup.length) {
      // Converte para GERENTE se tiver outra role
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
  const { empresaId: novaEmpresaId, novaSenha } = req.body

  if (!empresaId) return res.status(400).json({ error: "empresa_id obrigatorio como query param" })

  try {
    const gerenteRows = await queryTenantByEmpresaId(
      empresaId,
      "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
      [id]
    )
    if (!gerenteRows.length) return res.status(404).json({ error: "Gerente nao encontrado" })
    const gerente = gerenteRows[0]

    // Mover de organizacao
    if (novaEmpresaId && String(novaEmpresaId) !== String(empresaId)) {
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
      await queryTenantByEmpresaId(empresaId, "DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
      auditAction(req, "MOVE_GERENTE", `id:${id} de:${empresaId} para:${novaEmpresaId}`)
      return res.json({ message: "Gerente movido para nova organizacao." })
    }

    if (novaSenha) {
      const hash = await bcrypt.hash(novaSenha, 10)
      await queryTenantByEmpresaId(
        empresaId,
        "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
        [hash, id]
      )
    }

    auditAction(req, "UPDATE_GERENTE", `id:${id} empresa:${empresaId}`)
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
  const { ativo } = req.body

  if (!empresaId) return res.status(400).json({ error: "empresa_id obrigatorio" })
  if (!["S", "N"].includes(ativo)) return res.status(400).json({ error: "ativo deve ser S ou N" })

  try {
    await queryTenantByEmpresaId(
      empresaId,
      "UPDATE usuarios_auth SET ativo = ? WHERE id_usuario = ?",
      [ativo, id]
    )
    auditAction(req, ativo === "S" ? "ACTIVATE_GERENTE" : "DEACTIVATE_GERENTE", `id:${id} empresa:${empresaId}`)
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

  try {
    if (empresaId) {
      await queryTenantByEmpresaId(empresaId, "DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
    } else {
      await centralPool.query("DELETE FROM usuarios_auth WHERE id_usuario = ?", [id])
    }
    auditAction(req, "DELETE_GERENTE", `id:${id} empresa:${empresaId ?? "central"}`)
    return res.json({ message: "Gerente removido com sucesso." })
  } catch (error) {
    return handleError(res, error, "Erro ao remover gerente.")
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE SINCRONIZACAO DE VENDEDORES
// ═══════════════════════════════════════════════════════════════════════════════

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
