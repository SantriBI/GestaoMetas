import centralPool from "../db/mysql.js"

function textValue(value) {
  const text = String(value ?? "").trim()
  return text || null
}

let feedbackSchemaReady = false

async function ensureFeedbackSchema() {
  if (feedbackSchemaReady) return

  await centralPool.query(`
    CREATE TABLE IF NOT EXISTS feedback_usuarios (
      id_feedback    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      id_usuario     INT UNSIGNED,
      empresa_id     INT UNSIGNED,
      sk_vendedor    INT,
      nome_usuario   VARCHAR(300),
      login_usuario  VARCHAR(200),
      tipo_usuario   VARCHAR(20) NOT NULL,
      feedback       TEXT NOT NULL,
      criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_feedback),
      KEY idx_feedback_criado_em (criado_em),
      KEY idx_feedback_empresa_criado (empresa_id, criado_em),
      KEY idx_feedback_tipo_criado (tipo_usuario, criado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  feedbackSchemaReady = true
}

export async function postFeedback(req, res) {
  try {
    const { feedback } = req.body
    const id_usuario = req.auth?.id_usuario ?? req.auth?.sub ?? null
    const sk_vendedor = req.auth?.sk_vendedor ?? null
    const nome = req.auth?.nome ?? req.auth?.nome_completo ?? req.auth?.login ?? null
    const tipo_usuario = req.auth?.role ?? "USUARIO"
    const empresaId = req.auth?.empresa_id ?? null
    const login = req.auth?.login ?? null

    const textoFeedback = textValue(feedback)
    if (!textoFeedback) {
      return res.status(400).json({ error: "O campo feedback é obrigatório." })
    }

    await ensureFeedbackSchema()

    await centralPool.query(
      `INSERT INTO feedback_usuarios
       (id_usuario, empresa_id, sk_vendedor, nome_usuario, login_usuario, tipo_usuario, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_usuario != null ? Number(id_usuario) : null,
        empresaId != null ? Number(empresaId) : null,
        sk_vendedor != null ? Number(sk_vendedor) : null,
        textValue(nome),
        textValue(login),
        String(tipo_usuario ?? "USUARIO").toUpperCase().slice(0, 20),
        textoFeedback.slice(0, 2000),
      ]
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error("Erro ao salvar feedback:", err)
    return res.status(500).json({ error: "Erro ao registrar feedback." })
  }
}

export async function listFeedbacks(req, res) {
  try {
    await ensureFeedbackSchema()

    const limitRaw = Number(req.query?.limit ?? 200)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 200
    const empresaId = textValue(req.query?.empresa_id)
    const tipoUsuario = textValue(req.query?.tipo_usuario)

    const where = []
    const params = []

    if (empresaId) {
      where.push("f.empresa_id = ?")
      params.push(Number(empresaId))
    }

    if (tipoUsuario) {
      where.push("f.tipo_usuario = ?")
      params.push(tipoUsuario.toUpperCase().slice(0, 20))
    }

    params.push(limit)

    const [rows] = await centralPool.query(
      `
      SELECT
        f.id_feedback,
        f.id_usuario,
        f.empresa_id,
        o.nome AS organizacao_nome,
        f.sk_vendedor,
        f.nome_usuario,
        f.login_usuario,
        f.tipo_usuario,
        f.feedback,
        f.criado_em
      FROM feedback_usuarios f
      LEFT JOIN organizacoes_auth o
        ON o.id_organizacao = f.empresa_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY f.criado_em DESC, f.id_feedback DESC
      LIMIT ?
      `,
      params
    )

    return res.json({ data: rows })
  } catch (err) {
    console.error("Erro ao listar feedbacks:", err)
    return res.status(500).json({ error: "Erro ao listar feedbacks." })
  }
}
