import { query } from "../db/oracle.js"
import {
  createInstance,
  deleteInstance,
  getInstanceQrCode,
  getInstanceStatus,
} from "../services/evolutionApiService.js"

async function getInstanceNameOrThrow(sk_vendedor) {
  const rows = await query(
    `SELECT instance_name FROM TB_WHATSAPP_INSTANCIAS WHERE sk_vendedor = :sk_vendedor`,
    { sk_vendedor }
  )

  const instanceName = rows[0]?.INSTANCE_NAME ?? rows[0]?.instance_name ?? null
  if (!instanceName) {
    throw new Error("Nenhuma instância WhatsApp encontrada para este vendedor.")
  }

  return instanceName
}

export async function getInstancias(_req, res) {
  try {
    const rows = await query(
      `
      SELECT
        i.sk_vendedor,
        i.instance_name,
        i.ativo,
        i.instancia_default,
        i.data_criacao,
        i.data_atualizacao
      FROM TB_WHATSAPP_INSTANCIAS i
      ORDER BY i.data_criacao DESC
      `
    )
    res.json({ data: rows })
  } catch (error) {
    console.error("Erro ao listar instâncias WhatsApp:", error)
    res.status(500).json({ error: "Erro ao listar instâncias WhatsApp." })
  }
}

export async function postInstancia(req, res) {
  try {
    const { sk_vendedor } = req.body
    if (!sk_vendedor) {
      throw new Error("sk_vendedor é obrigatório.")
    }

    const instanceName = req.body.instance_name || `vendedor_${sk_vendedor}`
    const data = await createInstance(instanceName)

    await query(
      `
      INSERT INTO TB_WHATSAPP_INSTANCIAS (sk_vendedor, instance_name, ativo, instancia_default, data_criacao)
      VALUES (:sk_vendedor, :instance_name, 1, 0, SYSDATE)
      `,
      { sk_vendedor, instance_name: instanceName }
    )

    res.status(201).json({ instance_name: instanceName, qrcode: data.qrcode })
  } catch (error) {
    console.error("Erro ao criar instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar instância." })
  }
}

export async function getStatus(req, res) {
  try {
    const instanceName = await getInstanceNameOrThrow(req.params.sk_vendedor)
    res.json(await getInstanceStatus(instanceName))
  } catch (error) {
    console.error("Erro ao buscar status da instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar status." })
  }
}

export async function getQrCode(req, res) {
  try {
    const instanceName = await getInstanceNameOrThrow(req.params.sk_vendedor)
    const data = await getInstanceQrCode(instanceName)
    res.json({ instance_name: instanceName, base64: data.base64 })
  } catch (error) {
    console.error("Erro ao buscar QR Code da instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar QR Code." })
  }
}

export async function deleteInstancia(req, res) {
  try {
    const instanceName = await getInstanceNameOrThrow(req.params.sk_vendedor)
    await deleteInstance(instanceName)

    await query(
      `UPDATE TB_WHATSAPP_INSTANCIAS SET ativo = 0 WHERE sk_vendedor = :sk_vendedor`,
      { sk_vendedor: req.params.sk_vendedor }
    )

    res.json({ removed: true, instance_name: instanceName })
  } catch (error) {
    console.error("Erro ao remover instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao remover instância." })
  }
}
