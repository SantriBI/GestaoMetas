import { query } from "../db/oracle.js"

function textValue(value) {
  const text = String(value ?? "").trim()
  return text || null
}

async function nextId() {
  const rows = await query("SELECT TB_FEEDBACK_SEQ.NEXTVAL AS id FROM dual")
  return Number(rows[0]?.ID ?? rows[0]?.id ?? 0)
}

export async function postFeedback(req, res) {
  try {
    const { sk_vendedor, nome, feedback, tipo_usuario } = req.body

    const textoFeedback = textValue(feedback)
    if (!textoFeedback) {
      return res.status(400).json({ error: "O campo feedback é obrigatório." })
    }

    const id = await nextId()
    await query(
      `INSERT INTO TB_FEEDBACK (ID_FEEDBACK, SK_VENDEDOR, NOME_VENDEDOR, TIPO_USUARIO, FEEDBACK, DT_CRIACAO)
       VALUES (:id, :sk_vendedor, :nome_vendedor, :tipo_usuario, :feedback, SYSDATE)`,
      {
        id,
        sk_vendedor: sk_vendedor != null ? Number(sk_vendedor) : null,
        nome_vendedor: textValue(nome),
        tipo_usuario: String(tipo_usuario ?? "VENDEDOR").toUpperCase().slice(0, 20),
        feedback: textoFeedback.slice(0, 2000),
      }
    )

    return res.json({ ok: true })
  } catch (err) {
    console.error("Erro ao salvar feedback:", err)
    return res.status(500).json({ error: "Erro ao registrar feedback." })
  }
}
