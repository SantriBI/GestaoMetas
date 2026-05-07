import express from "express"
import bcrypt from "bcrypt"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { query } from "../db/oracle.js"
import { getUsersTableName } from "../db/oracleObjectNames.js"

const router = express.Router()
const uploadDir = path.resolve(process.cwd(), "uploads", "usuarios")
let fotoUrlColumnExists = null

function normalizarCPF(valor) {
  return String(valor ?? "").replace(/\D/g, "")
}

function formatarCPF(valor) {
  const cpf = normalizarCPF(valor)
  if (cpf.length !== 11) return String(valor ?? "").trim()
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function cpfValido(valor) {
  const cpf = normalizarCPF(valor)

  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  let soma = 0
  for (let i = 0; i < 9; i += 1) {
    soma += Number(cpf[i]) * (10 - i)
  }

  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== Number(cpf[9])) return false

  soma = 0
  for (let i = 0; i < 10; i += 1) {
    soma += Number(cpf[i]) * (11 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  return resto === Number(cpf[10])
}

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

async function hasFotoUrlColumn() {
  if (fotoUrlColumnExists !== null) {
    return fotoUrlColumnExists
  }

  const userTable = await getUsersTableName()
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = :tableName
      AND COLUMN_NAME = 'FOTO_URL'
    `,
    { tableName: userTable.split(".").pop() }
  )

  fotoUrlColumnExists = Number(rows[0]?.TOTAL ?? 0) > 0
  return fotoUrlColumnExists
}

async function buscarUsuarioPorId(idUsuario) {
  const userTable = await getUsersTableName()
  const fotoColumnSql = (await hasFotoUrlColumn())
    ? "foto_url"
    : "CAST(NULL AS VARCHAR2(500)) AS foto_url"

  const rows = await query(
    `
    SELECT
      id_usuario,
      nome,
      login,
      role,
      empresa_id,
      sk_vendedor,
      ${fotoColumnSql},
      senha_hash,
      senha_temporaria,
      ativo
    FROM ${userTable}
    WHERE id_usuario = :id_usuario
    `,
    { id_usuario: idUsuario }
  )

  return rows[0] ?? null
}

async function alterarSenha(req, res) {
  const {
    id_usuario,
    login,
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

  if ((!id_usuario && !login) || !senhaAtualFinal || !novaSenhaFinal) {
    return res.status(400).json({
      error: "Usuário, senha atual e nova senha são obrigatórios",
    })
  }

  if (novaSenhaFinal.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" })
  }

  if (novaSenhaFinal !== confirmarSenhaFinal) {
    return res.status(400).json({ error: "A confirmação da senha não confere" })
  }

  try {
    const userTable = await getUsersTableName()
    const rows = id_usuario
      ? await query(
          `
          SELECT id_usuario, senha_hash
          FROM ${userTable}
          WHERE id_usuario = :id_usuario
          `,
          { id_usuario }
        )
      : await query(
          `
          SELECT *
          FROM (
            SELECT id_usuario, senha_hash
            FROM ${userTable}
            WHERE TRIM(login) = :loginDigitado
               OR (:loginNormalizado <> '' AND REGEXP_REPLACE(login, '[^0-9]', '') = :loginNormalizado)
          )
          WHERE ROWNUM = 1
          `,
          {
            loginDigitado: String(login).trim(),
            loginNormalizado: normalizarCPF(login),
          }
        )

    if (!rows.length) {
      return res.status(404).json({ error: "Usuário não encontrado" })
    }

    const user = rows[0]
    const senhaOk = await bcrypt.compare(senhaAtualFinal, user.SENHA_HASH)

    if (!senhaOk) {
      return res.status(401).json({ error: "Senha atual inválida" })
    }

    const novaSenhaHash = await bcrypt.hash(novaSenhaFinal, 10)

    await query(
      `
      UPDATE ${userTable}
      SET senha_hash = :novaSenhaHash,
          senha_temporaria = 'N',
          atualizado_em = SYSDATE
      WHERE id_usuario = :id_usuario
      `,
      {
        novaSenhaHash,
        id_usuario: user.ID_USUARIO,
      }
    )

    return res.json({ message: "Senha alterada com sucesso" })
  } catch (error) {
    console.error("Erro ao alterar senha:", error)
    return res.status(500).json({ error: "Erro interno no servidor" })
  }
}

router.get("/usuarios/perfil/:id_usuario", async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorId(req.params.id_usuario)

    if (!usuario || usuario.ATIVO !== "S") {
      return res.status(404).json({ error: "Usuário não encontrado" })
    }

    return res.json({
      id_usuario: usuario.ID_USUARIO,
      nome: usuario.NOME,
      login: usuario.LOGIN,
      role: usuario.ROLE,
      empresa_id: usuario.EMPRESA_ID,
      sk_vendedor: usuario.SK_VENDEDOR,
      foto_url: usuario.FOTO_URL ?? null,
      senha_temporaria: usuario.SENHA_TEMPORARIA,
    })
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error)
    return res.status(500).json({ error: "Erro ao buscar perfil do usuário" })
  }
})

router.get("/usuarios/foto/:arquivo", async (req, res) => {
  const arquivo = path.basename(req.params.arquivo)
  const caminho = path.join(uploadDir, arquivo)

  try {
    await fs.access(caminho)
    return res.sendFile(caminho)
  } catch {
    return res.status(404).json({ error: "Foto não encontrada" })
  }
})

router.post("/usuarios/upload-foto", async (req, res) => {
  const { id_usuario, arquivo_base64, arquivoBase64, mime_type, mimeType } = req.body
  const conteudoBase64 = arquivo_base64 ?? arquivoBase64
  const tipoMime = mime_type ?? mimeType

  if (!id_usuario || !conteudoBase64 || !tipoMime) {
    return res.status(400).json({ error: "Usuário, arquivo e tipo da imagem são obrigatórios" })
  }

  const extensao = obterExtensao(tipoMime)
  if (!extensao) {
    return res.status(400).json({ error: "Formato de imagem inválido. Use PNG, JPG ou WEBP." })
  }

  try {
    if (!(await hasFotoUrlColumn())) {
      return res.status(503).json({
        error: "O banco ainda não possui a coluna FOTO_URL. Execute a migração antes de enviar fotos.",
      })
    }

    const userTable = await getUsersTableName()
    const usuario = await buscarUsuarioPorId(id_usuario)
    if (!usuario || usuario.ATIVO !== "S") {
      return res.status(404).json({ error: "Usuário não encontrado" })
    }

    const base64Limpo = String(conteudoBase64)
      .replace(/^data:[^;]+;base64,/, "")
      .trim()

    const buffer = Buffer.from(base64Limpo, "base64")
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "A imagem deve ter até 5 MB" })
    }

    await fs.mkdir(uploadDir, { recursive: true })
    const nomeArquivo = `${id_usuario}-${randomUUID()}.${extensao}`
    await fs.writeFile(path.join(uploadDir, nomeArquivo), buffer)

    const fotoUrl = `/api/usuarios/foto/${nomeArquivo}`

    await query(
      `
      UPDATE ${userTable}
      SET foto_url = :fotoUrl,
          atualizado_em = SYSDATE
      WHERE id_usuario = :id_usuario
      `,
      {
        fotoUrl,
        id_usuario,
      }
    )

    return res.json({ foto_url: fotoUrl })
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error)
    return res.status(500).json({ error: "Erro ao salvar foto do usuário" })
  }
})

router.put("/usuarios/atualizar-cpf", async (req, res) => {
  return res.status(403).json({
    error: "A alteraÃ§Ã£o de CPF nÃ£o estÃ¡ disponÃ­vel para o usuÃ¡rio. Atualize esse dado pelo cadastro administrativo.",
  })

  const { id_usuario, novo_cpf, novoCpf } = req.body
  const cpfInformado = novo_cpf ?? novoCpf

  if (!id_usuario || !cpfInformado) {
    return res.status(400).json({ error: "Usuário e novo CPF são obrigatórios" })
  }

  if (!cpfValido(cpfInformado)) {
    return res.status(400).json({ error: "CPF inválido" })
  }

  try {
    const usuario = await buscarUsuarioPorId(id_usuario)
    if (!usuario || usuario.ATIVO !== "S") {
      return res.status(404).json({ error: "Usuário não encontrado" })
    }

    const userTable = await getUsersTableName()
    const cpfNormalizado = normalizarCPF(cpfInformado)
    const duplicados = await query(
      `
      SELECT id_usuario
      FROM ${userTable}
      WHERE id_usuario <> :id_usuario
        AND REGEXP_REPLACE(login, '[^0-9]', '') = :cpf
      `,
      {
        id_usuario,
        cpf: cpfNormalizado,
      }
    )

    if (duplicados.length > 0) {
      return res.status(409).json({ error: "Já existe um usuário com esse CPF" })
    }

    const loginFormatado = formatarCPF(cpfNormalizado)

    await query(
      `
      UPDATE ${userTable}
      SET login = :login,
          atualizado_em = SYSDATE
      WHERE id_usuario = :id_usuario
      `,
      {
        login: loginFormatado,
        id_usuario,
      }
    )

    return res.json({
      message: "CPF atualizado com sucesso",
      login: loginFormatado,
    })
  } catch (error) {
    console.error("Erro ao atualizar CPF:", error)
    return res.status(500).json({ error: "Erro ao atualizar CPF" })
  }
})

router.put("/usuarios/alterar-senha", alterarSenha)
router.post("/alterar-senha", alterarSenha)

export default router
