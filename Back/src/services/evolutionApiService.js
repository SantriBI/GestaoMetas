import { query } from "../db/oracle.js"

async function tableExists(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: String(tableName ?? "").toUpperCase() }
  )

  return Number(rows[0]?.TOTAL ?? rows[0]?.total ?? 0) > 0
}

async function evolutionFetch(path, options = {}) {
  const baseUrl = process.env.EVOLUTION_API_URL
  if (!baseUrl) {
    throw new Error("EVOLUTION_API_URL não está configurada.")
  }

  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        apikey: process.env.EVOLUTION_API_KEY,
        ...(options.headers ?? {}),
      },
    })
  } catch (err) {
    throw new Error(`Falha de rede ao comunicar com a Evolution API: ${err.message}`)
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      `Evolution API retornou status ${response.status}: ${JSON.stringify(body)}`
    )
  }

  return body
}

export async function getInstanceNameByVendedor(sk_vendedor) {
  if (!(await tableExists("TB_WHATSAPP_INSTANCIAS"))) {
    return null
  }

  if (sk_vendedor === null || sk_vendedor === undefined) {
    const rows = await query(
      `
      SELECT instance_name
      FROM TB_WHATSAPP_INSTANCIAS
      WHERE ativo = 1 AND instancia_default = 1 AND rownum = 1
      `
    )
    return rows[0]?.INSTANCE_NAME ?? rows[0]?.instance_name ?? null
  }

  const rows = await query(
    `
    SELECT instance_name
    FROM TB_WHATSAPP_INSTANCIAS
    WHERE sk_vendedor = :sk_vendedor AND ativo = 1
    `,
    { sk_vendedor }
  )

  const instanceName = rows[0]?.INSTANCE_NAME ?? rows[0]?.instance_name ?? null
  if (!instanceName) {
    throw new Error("Nenhuma instância WhatsApp configurada para este vendedor.")
  }

  return instanceName
}

export async function getInstanceStatus(instanceName) {
  return evolutionFetch(`/instance/connectionState/${instanceName}`, { method: "GET" })
}

export async function sendTextMessage(instanceName, number, text) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number, text }),
  })
}

export async function createInstance(instanceName) {
  return evolutionFetch("/instance/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  })
}

export async function getInstanceQrCode(instanceName) {
  return evolutionFetch(`/instance/connect/${instanceName}`, { method: "GET" })
}

export async function deleteInstance(instanceName) {
  return evolutionFetch(`/instance/delete/${instanceName}`, { method: "DELETE" })
}
