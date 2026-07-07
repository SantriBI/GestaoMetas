import crypto from "node:crypto"
import express from "express"
import bcrypt from "bcrypt"
import { issueAuthToken, setAuthCookie, clearAuthCookie, AUTH_COOKIE_NAME, verifyAuthToken } from "../auth/token.js"
import { requireAuth, requireRole } from "../middleware/auth.js"
import centralPool, { describeMysqlTarget, formatDbError } from "../db/mysql.js"
import { queryTenantByEmpresaId } from "../db/mysql-tenants.js"

const router = express.Router()

function normalizarCPF(valor) {
  return String(valor).trim().replace(/\D/g, "")
}

// Busca usuario no banco central MySQL (SUPERADMIN/ADMIN)
async function findUserCentral(login) {
  const loginNorm = normalizarCPF(login)
  const [rows] = await centralPool.query(
    "SELECT * FROM usuarios_auth WHERE (login = ? OR (? != '' AND REPLACE(login, ' ', '') = ?)) AND ativo = 'S' LIMIT 1",
    [login.trim(), loginNorm, loginNorm]
  )
  return rows[0] ?? null
}

// Busca usuario em todos os tenants MySQL
async function findUserInTenants(login) {
  const loginNorm = normalizarCPF(login)
  const [orgs] = await centralPool.query(
    "SELECT id_organizacao, db_name FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL"
  )

  const matches = []
  for (const org of orgs) {
    try {
      const rows = await queryTenantByEmpresaId(
        org.id_organizacao,
        "SELECT * FROM usuarios_auth WHERE (login = ? OR (? != '' AND cpf = ?)) AND ativo = 'S' LIMIT 1",
        [login.trim(), loginNorm, loginNorm]
      )
      if (rows.length) matches.push({ user: rows[0], empresa_id: org.id_organizacao })
    } catch {}
  }
  return matches
}

// POST /api/login
router.post("/login", async (req, res) => {
  const { login, senha } = req.body

  if (!login || !senha) {
    return res.status(400).json({ error: "Login e senha sao obrigatorios" })
  }

  try {
    // 1. Tenta banco central (SUPERADMIN/ADMIN)
    let mysqlAuthUnavailable = false
    let centralUser = null

    try {
      centralUser = await findUserCentral(login)
    } catch (error) {
      mysqlAuthUnavailable = true
      console.warn(
        `MySQL central indisponivel no login (${describeMysqlTarget()}):`,
        formatDbError(error)
      )
    }

    if (centralUser) {
      const ok = await bcrypt.compare(senha, centralUser.senha_hash)
      if (!ok) return res.status(401).json({ error: "Usuario ou senha invalidos" })

      await centralPool.query(
        "UPDATE usuarios_auth SET ultimo_login = NOW() WHERE id_usuario = ?",
        [centralUser.id_usuario]
      )

      const token = issueAuthToken(centralUser)
      setAuthCookie(res, token)

      return res.json({
        id_usuario: centralUser.id_usuario,
        nome: centralUser.nome ?? centralUser.nome_completo,
        login: centralUser.login,
        role: centralUser.role,
        empresa_id: centralUser.empresa_id ?? null,
        sk_vendedor: centralUser.sk_vendedor ?? null,
        foto_url: centralUser.foto_url ?? null,
        senha_temporaria: centralUser.senha_temporaria ?? "N",
      })
    }

    // 2. Tenta tenants MySQL
    let tenantMatches = []

    try {
      tenantMatches = await findUserInTenants(login)
    } catch (error) {
      mysqlAuthUnavailable = true
      console.warn(
        `MySQL tenants indisponivel no login (${describeMysqlTarget()}):`,
        formatDbError(error)
      )
    }

    if (tenantMatches.length) {
      const validMatches = []
      for (const match of tenantMatches) {
        const ok = await bcrypt.compare(senha, match.user.senha_hash)
        if (ok) validMatches.push(match)
      }

      if (!validMatches.length) return res.status(401).json({ error: "Usuario ou senha invalidos" })

      if (validMatches.length > 1) {
        return res.status(409).json({
          error:
            "Este login esta vinculado a mais de uma organizacao. " +
            "Remova o usuario duplicado ou altere o login para evitar acesso na organizacao errada.",
        })
      }

      const { user, empresa_id } = validMatches[0]

      await queryTenantByEmpresaId(
        empresa_id,
        "UPDATE usuarios_auth SET ultimo_login = NOW() WHERE id_usuario = ?",
        [user.id_usuario]
      )

      const token = issueAuthToken({ ...user, empresa_id })
      setAuthCookie(res, token)

      return res.json({
        id_usuario: user.id_usuario,
        nome: user.nome ?? user.nome_completo,
        login: user.login,
        role: user.role,
        empresa_id,
        sk_vendedor: user.sk_vendedor ?? null,
        foto_url: user.foto_url ?? null,
        senha_temporaria: user.senha_temporaria ?? "N",
      })
    }

    if (mysqlAuthUnavailable) {
      return res.status(503).json({
        error: "Banco de autenticacao local indisponivel. Inicie o MySQL.",
      })
    }

    return res.status(401).json({ error: "Usuario ou senha invalidos" })
  } catch (error) {
    console.error("Erro no login:", error)
    return res.status(500).json({ error: "Erro interno no servidor" })
  }
})

// POST /api/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res)
  return res.json({ ok: true })
})

// POST /api/alterar-senha
router.post("/alterar-senha", requireAuth, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body
  const { id_usuario, empresa_id } = req.auth

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: "senhaAtual e novaSenha sao obrigatorios" })
  }

  if (String(novaSenha).length < 6) {
    return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres" })
  }

  try {
    // Busca usuario no banco correto
    let user = null
    let source = null

    const centralRow = await centralPool.query(
      "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
      [id_usuario]
    )
    if (centralRow[0]?.length) {
      user = centralRow[0][0]
      source = "central"
    } else if (empresa_id) {
      const rows = await queryTenantByEmpresaId(
        empresa_id,
        "SELECT * FROM usuarios_auth WHERE id_usuario = ? LIMIT 1",
        [id_usuario]
      )
      if (rows.length) {
        user = rows[0]
        source = "tenant"
      }
    }

    if (!user) return res.status(404).json({ error: "Usuario nao encontrado" })

    const ok = await bcrypt.compare(senhaAtual, user.senha_hash)
    if (!ok) return res.status(401).json({ error: "Senha atual invalida" })

    const novoHash = await bcrypt.hash(novaSenha, 10)

    if (source === "central") {
      await centralPool.query(
        "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
        [novoHash, id_usuario]
      )
    } else {
      await queryTenantByEmpresaId(
        empresa_id,
        "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'N' WHERE id_usuario = ?",
        [novoHash, id_usuario]
      )
    }

    return res.json({ message: "Senha alterada com sucesso" })
  } catch (error) {
    console.error("Erro ao alterar senha:", error)
    return res.status(500).json({ error: "Erro interno" })
  }
})

router.post("/resetar-senhas-temporarias", requireAuth, requireRole("SUPERADMIN"), async (req, res) => {
  try {
    const senhaTemporaria = crypto.randomBytes(10).toString("base64url").slice(0, 14)
    const hashTemporario = await bcrypt.hash(senhaTemporaria, 12)

    const [centralResult] = await centralPool.query(
      "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'S'",
      [hashTemporario]
    )

    const [orgs] = await centralPool.query(
      "SELECT id_organizacao FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL"
    )
    let tenantsAtualizados = 0

    for (const org of orgs) {
      try {
        const result = await queryTenantByEmpresaId(
          org.id_organizacao,
          "UPDATE usuarios_auth SET senha_hash = ?, senha_temporaria = 'S'",
          [hashTemporario]
        )
        tenantsAtualizados += result?.affectedRows ?? 0
      } catch (tenantError) {
        console.warn("Falha ao resetar senhas no tenant:", org.id_organizacao, tenantError?.message ?? tenantError)
      }
    }

    return res.json({
      message: "Senhas redefinidas com sucesso para senha temporaria",
      senha_temporaria: senhaTemporaria,
      usuarios_atualizados: (centralResult?.affectedRows ?? 0) + tenantsAtualizados,
    })
  } catch (error) {
    console.error("Erro ao resetar senhas temporarias:", error)
    return res.status(500).json({ error: "Erro interno no servidor" })
  }
})

export default router
