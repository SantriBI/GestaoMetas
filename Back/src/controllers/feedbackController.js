import centralPool from "../db/mysql.js"

function textValue(value) {
  const text = String(value ?? "").trim()
  return text || null
}

let feedbackSchemaReady = false

const FEEDBACK_STATUSES = ["novo", "lido", "resolvido"]

async function ensureFeedbackStatusColumn() {
  const [rows] = await centralPool.query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'feedback_usuarios'
      AND column_name = 'status'
  `)

  if (Number(rows[0]?.cnt ?? 0) === 0) {
    await centralPool.query(`
      ALTER TABLE feedback_usuarios
      ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'novo' AFTER feedback,
      ADD INDEX idx_feedback_status_criado (status, criado_em)
    `)
  }
}

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
      status         VARCHAR(20) NOT NULL DEFAULT 'novo',
      criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_feedback),
      KEY idx_feedback_criado_em (criado_em),
      KEY idx_feedback_empresa_criado (empresa_id, criado_em),
      KEY idx_feedback_tipo_criado (tipo_usuario, criado_em),
      KEY idx_feedback_status_criado (status, criado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await ensureFeedbackStatusColumn()

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

    const pageRaw = Number(req.query?.page ?? 1)
    const page = Number.isFinite(pageRaw) ? Math.max(Math.trunc(pageRaw), 1) : 1

    const limitRaw = Number(req.query?.limit ?? 20)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 20

    const empresaId = textValue(req.query?.empresa_id)
    const tipoUsuario = textValue(req.query?.tipo_usuario)
    const status = textValue(req.query?.status)
    const busca = textValue(req.query?.busca)

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

    if (status) {
      where.push("f.status = ?")
      params.push(status.toLowerCase().slice(0, 20))
    }

    if (busca) {
      where.push("(f.feedback LIKE ? OR f.nome_usuario LIKE ? OR f.login_usuario LIKE ?)")
      const termo = `%${busca.slice(0, 200)}%`
      params.push(termo, termo, termo)
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const [statsRows] = await centralPool.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN DATE(f.criado_em) = CURDATE() THEN 1 ELSE 0 END) AS hoje,
        SUM(CASE WHEN f.empresa_id IS NOT NULL THEN 1 ELSE 0 END) AS com_organizacao
      FROM feedback_usuarios f
      ${whereSql}
      `,
      params
    )

    const total = Number(statsRows[0]?.total ?? 0)
    const hoje = Number(statsRows[0]?.hoje ?? 0)
    const comOrganizacao = Number(statsRows[0]?.com_organizacao ?? 0)
    const totalPages = Math.max(Math.ceil(total / limit), 1)
    const offset = (page - 1) * limit

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
        f.status,
        f.feedback,
        f.criado_em
      FROM feedback_usuarios f
      LEFT JOIN organizacoes_auth o
        ON o.id_organizacao = f.empresa_id
      ${whereSql}
      ORDER BY f.criado_em DESC, f.id_feedback DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    return res.json({ data: rows, total, hoje, comOrganizacao, page, limit, totalPages })
  } catch (err) {
    console.error("Erro ao listar feedbacks:", err)
    return res.status(500).json({ error: "Erro ao listar feedbacks." })
  }
}

export async function updateFeedbackStatus(req, res) {
  try {
    await ensureFeedbackSchema()

    const id = Number(req.params?.id)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID de feedback inválido." })
    }

    const status = String(req.body?.status ?? "").toLowerCase().trim()
    if (!FEEDBACK_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status deve ser um de: ${FEEDBACK_STATUSES.join(", ")}.` })
    }

    const [result] = await centralPool.query(
      "UPDATE feedback_usuarios SET status = ? WHERE id_feedback = ?",
      [status, id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Feedback não encontrado." })
    }

    return res.json({ ok: true, status })
  } catch (err) {
    console.error("Erro ao atualizar status do feedback:", err)
    return res.status(500).json({ error: "Erro ao atualizar status do feedback." })
  }
}
