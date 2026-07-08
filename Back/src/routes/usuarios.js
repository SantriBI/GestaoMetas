import express from "express"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import {
  findAuthUserById,
  findManagedUserById,
  listManagedUsersByEmpresaId,
  revokeManagedUserSession,
  revokeManagedUsersByEmpresaId,
  resolveAuthUserDisplayName,
  setManagedUserActive,
  setManagedUserPassword,
  updateAuthUserPassword,
  updateAuthUserPhoto,
} from "../services/authUsersService.js"
import { requireAuth } from "../middleware/auth.js"
import { getRequestedEmpresaId } from "../services/requestScope.js"
import centralPool from "../db/mysql.js"

const router = express.Router()
const uploadDir = path.resolve(process.cwd(), "uploads", "usuarios")

function obterExtensao(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return null
  }
}

function normalizePublicUser(usuario) {
  return {
    id_usuario: usuario.id_usuario,
    nome: usuario.nome,
    login: usuario.login,
    role: usuario.role,
    empresa_id: usuario.empresa_id,
    sk_vendedor: usuario.sk_vendedor,
    foto_url: usuario.foto_url ?? null,
    senha_temporaria: usuario.senha_temporaria ?? "N",
  }
}

function actorRole(req) {
  return String(req.auth?.role ?? "").toUpperCase()
}

function isGlobalAdmin(req) {
  return actorRole(req) === "SUPERADMIN" || actorRole(req) === "ADMIN"
}

function getSelfLookupEmpresaId(req) {
  if (actorRole(req) === "GERENTE_SISTEMAS") {
    return req.auth?.empresa_id_original ?? null
  }

  return req.auth?.empresa_id ?? null
}

function getManagementScope(req, res, { requireEmpresa = true } = {}) {
  const role = actorRole(req)

  if (role === "GERENTE" || role === "GERENTE_SISTEMAS") {
    const empresaId = req.auth?.empresa_id ?? null
    if (!empresaId) {
      res.status(403).json({ error: "Empresa do gerente nao encontrada." })
      return null
    }

    return {
      empresaId,
      roles: ["VENDEDOR"],
      excludeUserId: req.auth?.id_usuario ?? null,
      canManage: (user) => user?.role === "VENDEDOR",
    }
  }

  if (isGlobalAdmin(req)) {
    const empresaId = getRequestedEmpresaId(req)
    if (requireEmpresa && !empresaId) {
      res.status(400).json({ error: "empresa_id e obrigatorio." })
      return null
    }

    return {
      empresaId: empresaId ?? null,
      roles: ["GERENTE", "VENDEDOR", "PAINEL", "INDUSTRIA"],
      excludeUserId: null,
      canManage: (user) => ["GERENTE", "VENDEDOR", "PAINEL", "INDUSTRIA"].includes(String(user?.role ?? "").toUpperCase()),
    }
  }

  res.status(403).json({ error: "Acesso negado." })
  return null
}

async function getActiveOrganizations() {
  const [rows] = await centralPool.query(
    "SELECT id_organizacao, nome FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL ORDER BY nome"
  )
  return rows
}

async function loadTargetUser(req, res) {
  const scope = getManagementScope(req, res)
  if (!scope) return null

  const target = await findManagedUserById({
    idUsuario: req.params.id_usuario,
    empresaId: scope.empresaId,
  })

  if (!target) {
    res.status(404).json({ error: "Usuario nao encontrado." })
    return null
  }

  if (scope.excludeUserId && String(target.id_usuario) === String(scope.excludeUserId)) {
    res.status(403).json({ error: "Esta acao nao pode ser feita sobre seu proprio usuario." })
    return null
  }

  if (!scope.canManage(target)) {
    res.status(403).json({ error: "Usuario fora do seu escopo de gestao." })
    return null
  }

  return { scope, target }
}

async function alterarSenha(req, res) {
  // id_usuario e empresa_id vêm do token autenticado, nunca do body
  const id_usuario = req.auth.id_usuario
  const empresa_id = getSelfLookupEmpresaId(req)

  const {
    senha_atual,
    senhaAtual,
    nova_senha,
    novaSenha,
    confirmar_senha,
    confirmarSenha,
  } = req.body

  const senhaAtualFinal = senha_atual ?? senhaAtual
  const novaSenhaFinal = nova_senha ?? novaSenha
  const confirmarSenhaFinal = confirmar_senha ?? confirmarSenha ?? novaSenhaFinal

  if (!senhaAtualFinal || !novaSenhaFinal) {
    return res.status(400).json({
      error: "Senha atual e nova senha sao obrigatorios",
    })
  }

  if (String(novaSenhaFinal).length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" })
  }

  if (novaSenhaFinal !== confirmarSenhaFinal) {
    return res.status(400).json({ error: "A confirmacao da senha nao confere" })
  }

  try {
    const result = await updateAuthUserPassword({
      idUsuario: id_usuario,
      empresaId: empresa_id,
      senhaAtual: senhaAtualFinal,
      novaSenha: novaSenhaFinal,
    })

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    return res.json({ message: "Senha alterada com sucesso" })
  } catch (error) {
    console.error("Erro ao alterar senha:", error)
    return res.status(500).json({ error: "Erro interno no servidor" })
  }
}

router.get("/usuarios/perfil/me", requireAuth, async (req, res) => {
  try {
    const usuario = await findAuthUserById(req.auth?.id_usuario, getSelfLookupEmpresaId(req))

    if (!usuario || usuario.ativo !== "S") {
      return res.status(404).json({ error: "Usuario nao encontrado" })
    }

    return res.json(normalizePublicUser(await resolveAuthUserDisplayName(usuario)))
  } catch (error) {
    console.error("Erro ao buscar perfil autenticado:", error)
    return res.status(500).json({ error: "Erro ao buscar perfil do usuario" })
  }
})

router.get("/usuarios/perfil/:id_usuario", requireAuth, async (req, res) => {
  const callerRole = actorRole(req)
  const callerId = String(req.auth?.id_usuario ?? "")
  const targetId = String(req.params.id_usuario)
  const isAdmin = ["ADMIN", "SUPERADMIN"].includes(callerRole)
  const isSystemManager = callerRole === "GERENTE_SISTEMAS"
  const isSelfLookup = callerId === targetId
  // Um GERENTE_SISTEMAS na visao emprestada de gerente pode ver o time da organizacao liberada;
  // a propria consulta a si mesmo continua indo por getSelfLookupEmpresaId (sem empresa fixa).
  const isGerente = callerRole === "GERENTE" || (isSystemManager && !isSelfLookup)

  if (!isAdmin && !isGerente && !isSelfLookup) {
    return res.status(403).json({ error: "Acesso negado." })
  }

  try {
    const empresaId = isAdmin
      ? (req.query.empresa_id ?? req.query.empresaId ?? req.auth?.empresa_id ?? null)
      : isSystemManager && isSelfLookup
        ? getSelfLookupEmpresaId(req)
        : (req.auth?.empresa_id ?? null)

    if (isGerente) {
      if (!empresaId) return res.status(403).json({ error: "Empresa do gerente nao encontrada." })
      const managedUser = await findManagedUserById({ idUsuario: req.params.id_usuario, empresaId })
      if (!managedUser || !["VENDEDOR", "GERENTE"].includes(String(managedUser.role ?? "").toUpperCase())) {
        return res.status(404).json({ error: "Usuario nao encontrado" })
      }
    }

    const usuario = await findAuthUserById(req.params.id_usuario, empresaId)

    if (!usuario || usuario.ativo !== "S") {
      return res.status(404).json({ error: "Usuario nao encontrado" })
    }

    return res.json(normalizePublicUser(await resolveAuthUserDisplayName(usuario)))
  } catch (error) {
    console.error("Erro ao buscar perfil do usuario:", error)
    return res.status(500).json({ error: "Erro ao buscar perfil do usuario" })
  }
})

router.get("/usuarios/gerenciamento", requireAuth, async (req, res) => {
  try {
    const scope = getManagementScope(req, res, { requireEmpresa: false })
    if (!scope) return

    if (scope.empresaId) {
      const users = await listManagedUsersByEmpresaId(scope.empresaId, { roles: scope.roles })
      return res.json({ data: users })
    }

    const organizations = await getActiveOrganizations()
    const data = []
    for (const org of organizations) {
      try {
        const users = await listManagedUsersByEmpresaId(org.id_organizacao, {
          roles: scope.roles,
          organizacaoNome: org.nome,
        })
        data.push(...users)
      } catch {}
    }

    return res.json({ data })
  } catch (error) {
    console.error("Erro ao listar usuarios gerenciaveis:", error)
    return res.status(500).json({ error: "Erro ao listar usuarios." })
  }
})

router.patch("/usuarios/gerenciamento/:id_usuario/senha", requireAuth, async (req, res) => {
  const novaSenha = req.body?.nova_senha ?? req.body?.novaSenha
  if (!novaSenha || String(novaSenha).length < 6) {
    return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres." })
  }

  try {
    const loaded = await loadTargetUser(req, res)
    if (!loaded) return

    await setManagedUserPassword({
      idUsuario: loaded.target.id_usuario,
      empresaId: loaded.scope.empresaId,
      novaSenha,
    })

    return res.json({ message: "Senha alterada e sessoes antigas desconectadas." })
  } catch (error) {
    console.error("Erro ao alterar senha gerenciada:", error)
    return res.status(500).json({ error: "Erro ao alterar senha." })
  }
})

router.patch("/usuarios/gerenciamento/:id_usuario/status", requireAuth, async (req, res) => {
  const ativo = req.body?.ativo
  if (!["S", "N"].includes(ativo)) {
    return res.status(400).json({ error: "ativo deve ser S ou N." })
  }

  try {
    const loaded = await loadTargetUser(req, res)
    if (!loaded) return

    await setManagedUserActive({
      idUsuario: loaded.target.id_usuario,
      empresaId: loaded.scope.empresaId,
      ativo,
    })

    return res.json({ message: `Usuario ${ativo === "S" ? "ativado" : "inativado"} com sucesso.` })
  } catch (error) {
    console.error("Erro ao alterar status gerenciado:", error)
    return res.status(500).json({ error: "Erro ao alterar status." })
  }
})

router.post("/usuarios/gerenciamento/:id_usuario/logoff", requireAuth, async (req, res) => {
  try {
    const loaded = await loadTargetUser(req, res)
    if (!loaded) return

    await revokeManagedUserSession({
      idUsuario: loaded.target.id_usuario,
      empresaId: loaded.scope.empresaId,
    })

    return res.json({ message: "Usuario desconectado com sucesso." })
  } catch (error) {
    console.error("Erro ao desconectar usuario:", error)
    return res.status(500).json({ error: "Erro ao desconectar usuario." })
  }
})

router.post("/usuarios/gerenciamento/logoff-geral", requireAuth, async (req, res) => {
  if (["GERENTE", "GERENTE_SISTEMAS"].includes(actorRole(req))) {
    return res.status(403).json({ error: "Logoff geral nao permitido para gerente." })
  }

  try {
    const scope = getManagementScope(req, res)
    if (!scope) return

    const total = await revokeManagedUsersByEmpresaId({
      empresaId: scope.empresaId,
      roles: scope.roles,
      excludeUserId: scope.excludeUserId,
    })

    return res.json({ message: "Usuarios desconectados com sucesso.", total })
  } catch (error) {
    console.error("Erro no logoff geral:", error)
    return res.status(500).json({ error: "Erro ao desconectar usuarios." })
  }
})

router.get("/usuarios/foto/:arquivo", async (req, res) => {
  const arquivo = path.basename(req.params.arquivo)
  const caminho = path.join(uploadDir, arquivo)

  try {
    await fs.access(caminho)
    return res.sendFile(caminho)
  } catch {
    return res.status(404).json({ error: "Foto nao encontrada" })
  }
})

router.post("/usuarios/upload-foto", requireAuth, async (req, res) => {
  const { id_usuario, empresa_id, arquivo_base64, arquivoBase64, mime_type, mimeType } = req.body
  const conteudoBase64 = arquivo_base64 ?? arquivoBase64
  const tipoMime = mime_type ?? mimeType
  const callerRole = actorRole(req)
  const callerId = String(req.auth?.id_usuario ?? "")
  const isAdmin = ["ADMIN", "SUPERADMIN"].includes(callerRole)
  const targetUserId = isAdmin ? id_usuario : req.auth?.id_usuario
  const targetEmpresaId = isAdmin ? (empresa_id ?? req.auth?.empresa_id ?? null) : getSelfLookupEmpresaId(req)

  if (!targetUserId || !conteudoBase64 || !tipoMime) {
    return res.status(400).json({ error: "Usuario, arquivo e tipo da imagem sao obrigatorios" })
  }

  if (!isAdmin && callerId !== String(targetUserId)) {
    return res.status(403).json({ error: "Acesso negado." })
  }

  const extensao = obterExtensao(tipoMime)
  if (!extensao) {
    return res.status(400).json({ error: "Formato de imagem invalido. Use PNG, JPG ou WEBP." })
  }

  try {
    const usuario = await findAuthUserById(targetUserId, targetEmpresaId)
    if (!usuario || usuario.ativo !== "S") {
      return res.status(404).json({ error: "Usuario nao encontrado" })
    }

    const base64Limpo = String(conteudoBase64)
      .replace(/^data:[^;]+;base64,/, "")
      .trim()

    const buffer = Buffer.from(base64Limpo, "base64")
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "A imagem deve ter ate 5 MB" })
    }

    await fs.mkdir(uploadDir, { recursive: true })
    const nomeArquivo = `${targetUserId}-${randomUUID()}.${extensao}`
    await fs.writeFile(path.join(uploadDir, nomeArquivo), buffer)

    const fotoUrl = `/api/usuarios/foto/${nomeArquivo}`
    await updateAuthUserPhoto({ idUsuario: targetUserId, empresaId: targetEmpresaId, fotoUrl })

    return res.json({ foto_url: fotoUrl })
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error)
    return res.status(500).json({ error: "Erro ao salvar foto do usuario" })
  }
})

router.put("/usuarios/atualizar-cpf", requireAuth, async (req, res) => {
  return res.status(403).json({
    error: "A alteracao de CPF nao esta disponivel para o usuario. Atualize esse dado pelo cadastro administrativo.",
  })
})

router.put("/usuarios/alterar-senha", requireAuth, alterarSenha)

export default router
