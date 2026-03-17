import express from 'express'
import bcrypt from 'bcrypt'
import { query } from '../db/oracle.js'

const router = express.Router()
let fotoUrlColumnExists = null

function normalizarCPF(valor) {
  return String(valor).trim().replace(/\D/g, '')
}

async function hasFotoUrlColumn() {
  if (fotoUrlColumnExists !== null) {
    return fotoUrlColumnExists
  }

  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'USUARIOS_APP'
      AND COLUMN_NAME = 'FOTO_URL'
    `
  )

  fotoUrlColumnExists = Number(rows[0]?.TOTAL ?? 0) > 0
  return fotoUrlColumnExists
}

// POST /api/login
router.post('/login', async (req, res) => {
  const { login, senha } = req.body

  if (!login || !senha) {
    return res.status(400).json({
      error: 'Login e senha são obrigatórios'
    })
  }

  try {
    const loginDigitado = String(login).trim()
    const loginNormalizado = normalizarCPF(loginDigitado)
    const fotoColumnSql = (await hasFotoUrlColumn())
      ? 'foto_url'
      : 'CAST(NULL AS VARCHAR2(500)) AS foto_url'

    const rows = await query(
      `
      SELECT *
      FROM (
        SELECT
          id_usuario,
          nome as nome,
          login,
          senha_hash,
          role,
          empresa_id,
          sk_vendedor,
          ${fotoColumnSql},
          senha_temporaria,
          ativo
        FROM usuarios_app
        WHERE TRIM(login) = :loginDigitado
           OR (:loginNormalizado <> '' AND REGEXP_REPLACE(login, '[^0-9]', '') = :loginNormalizado)
      )
      WHERE ROWNUM = 1
      `,
      {
        loginDigitado,
        loginNormalizado
      }
    )

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

    const user = rows[0]

    if (user.ATIVO !== 'S') {
      return res.status(403).json({ error: 'Usuário inativo' })
    }

    const senhaOk = await bcrypt.compare(senha, user.SENHA_HASH)

    if (!senhaOk) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

  res.json({
    id_usuario: user.ID_USUARIO,
    nome: user.NOME,
    login: user.LOGIN,
    role: user.ROLE,
    empresa_id: user.EMPRESA_ID,
    sk_vendedor: user.SK_VENDEDOR,
    foto_url: user.FOTO_URL ?? null,
    senha_temporaria: user.SENHA_TEMPORARIA
  })

  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ error: 'Erro interno no servidor' })
  }
})


// POST /api/alterar-senha
router.post('/alterar-senha', async (req, res) => {
  const { login, senhaAtual, novaSenha } = req.body

  if (!login || !senhaAtual || !novaSenha) {
    return res.status(400).json({
      error: 'Login, senha atual e nova senha são obrigatórios'
    })
  }

  try {
    const loginDigitado = String(login).trim()
    const loginNormalizado = normalizarCPF(loginDigitado)
    const fotoColumnSql = (await hasFotoUrlColumn())
      ? 'foto_url'
      : 'CAST(NULL AS VARCHAR2(500)) AS foto_url'

    const rows = await query(
      `
      SELECT *
      FROM (
        SELECT id_usuario, senha_hash
        FROM usuarios_app
        WHERE TRIM(login) = :loginDigitado
           OR (:loginNormalizado <> '' AND REGEXP_REPLACE(login, '[^0-9]', '') = :loginNormalizado)
      )
      WHERE ROWNUM = 1
      `,
      {
        loginDigitado,
        loginNormalizado
      }
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    const user = rows[0]

    const senhaOk = await bcrypt.compare(senhaAtual, user.SENHA_HASH)
    if (!senhaOk) {
      return res.status(401).json({ error: 'Senha atual inválida' })
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10)

    await query(
      `
      UPDATE usuarios_app
      SET senha_hash = :novaSenhaHash,
          senha_temporaria = 'N',
          atualizado_em = SYSDATE
      WHERE id_usuario = :id
      `,
      {
        novaSenhaHash,
        id: user.ID_USUARIO
      }
    )

    res.json({ message: 'Senha alterada com sucesso' })

  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

// POST /api/resetar-senhas-temporarias
router.post('/resetar-senhas-temporarias', async (req, res) => {
  const { adminToken } = req.body

  if (!process.env.ADMIN_RESET_TOKEN) {
    return res.status(500).json({ error: 'ADMIN_RESET_TOKEN não configurado' })
  }

  if (adminToken !== process.env.ADMIN_RESET_TOKEN) {
    return res.status(403).json({ error: 'Token inválido' })
  }

  try {
    const hashTemporario = '$2a$12$1cXgi9XcQ0GF8NH9PaEtN.adhzylBin.SvRgd0dqv2S1nOysgsWJy'

    await query(
      `
      UPDATE usuarios_app
      SET senha_hash = :hashTemporario,
          senha_temporaria = 'S',
          atualizado_em = SYSDATE
      `
      ,
      { hashTemporario }
    )

    res.json({
      message: 'Senhas redefinidas com sucesso para senha temporária'
    })
  } catch (error) {
    console.error('Erro ao resetar senhas temporárias:', error)
    res.status(500).json({ error: 'Erro interno no servidor' })
  }
})

export default router
