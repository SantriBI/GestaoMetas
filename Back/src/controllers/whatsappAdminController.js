import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { findAuthUserBySkVendedor, listManagedUsersByEmpresaId } from "../services/authUsersService.js"
import {
  createInstance,
  deleteInstance,
  getInstanceQrCode,
  getInstanceStatus,
} from "../services/evolutionApiService.js"
import { canUseGlobalEmpresaScope } from "../services/requestScope.js"

function getScopedQuery(empresaId) {
  if (!empresaId) {
    throw new Error("empresa_id e obrigatorio para administrar WhatsApp.")
  }
  return (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options)
}

function getRequestedEmpresaId(req) {
  return req.query?.empresa_id ?? req.query?.empresaId ?? req.body?.empresa_id ?? req.body?.empresaId ?? null
}

function getScopedEmpresaId(req) {
  const role = String(req.auth?.role ?? "").toUpperCase()
  if (role === "GERENTE") return req.auth?.empresa_id ?? null
  return getRequestedEmpresaId(req) ?? req.auth?.empresa_id ?? null
}

async function getAllowedSellerSet(req, res) {
  const role = String(req.auth?.role ?? "").toUpperCase()
  const empresaId = getScopedEmpresaId(req)

  if (role === "GERENTE" && !empresaId) {
    res.status(403).json({ error: "Empresa do gerente nao encontrada." })
    return { allowed: false, empresaId: null, sellerSet: null }
  }

  if (!empresaId && canUseGlobalEmpresaScope(req)) {
    res.status(400).json({ error: "empresa_id e obrigatorio para administrar WhatsApp." })
    return { allowed: false, empresaId: null, sellerSet: null }
  }

  if (!empresaId) {
    res.status(403).json({ error: "Empresa do usuario nao encontrada." })
    return { allowed: false, empresaId: null, sellerSet: null }
  }

  const users = await listManagedUsersByEmpresaId(empresaId, { roles: ["VENDEDOR"] })
  const sellerSet = new Set(
    users
      .map((user) => String(user.sk_vendedor ?? "").trim())
      .filter(Boolean)
  )

  return { allowed: true, empresaId, sellerSet }
}

async function assertSellerInScope(req, res, skVendedor) {
  const scope = await getAllowedSellerSet(req, res)
  if (!scope.allowed) return null
  if (!scope.empresaId) return scope

  const sellerUser = await findAuthUserBySkVendedor(skVendedor, scope.empresaId)
  if (!sellerUser) {
    res.status(403).json({ error: "Vendedor fora da organizacao informada." })
    return null
  }

  return scope
}

async function getInstanceNameOrThrow(sk_vendedor, empresaId) {
  const rows = await getScopedQuery(empresaId)(
    `SELECT instance_name FROM TB_WHATSAPP_INSTANCIAS WHERE sk_vendedor = :sk_vendedor`,
    { sk_vendedor }
  )

  const instanceName = rows[0]?.INSTANCE_NAME ?? rows[0]?.instance_name ?? null
  if (!instanceName) {
    throw new Error("Nenhuma instância WhatsApp encontrada para este vendedor.")
  }

  return instanceName
}

export async function getInstancias(req, res) {
  try {
    const scope = await getAllowedSellerSet(req, res)
    if (!scope.allowed) return
    const dbQuery = getScopedQuery(scope.empresaId)

    const rows = await dbQuery(
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
    const data = scope.sellerSet
      ? rows.filter((row) => scope.sellerSet.has(String(row.SK_VENDEDOR ?? row.sk_vendedor ?? "")))
      : rows

    res.json({ data })
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

    const scope = await assertSellerInScope(req, res, sk_vendedor)
    if (!scope) return
    const dbQuery = getScopedQuery(scope.empresaId)

    const instanceName = req.body.instance_name || `vendedor_${sk_vendedor}`
    const data = await createInstance(instanceName)

    await dbQuery(
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
    const scope = await assertSellerInScope(req, res, req.params.sk_vendedor)
    if (!scope) return

    const instanceName = await getInstanceNameOrThrow(req.params.sk_vendedor, scope.empresaId)
    res.json(await getInstanceStatus(instanceName))
  } catch (error) {
    console.error("Erro ao buscar status da instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar status." })
  }
}

export async function getQrCode(req, res) {
  try {
    const scope = await assertSellerInScope(req, res, req.params.sk_vendedor)
    if (!scope) return

    const instanceName = await getInstanceNameOrThrow(req.params.sk_vendedor, scope.empresaId)
    const data = await getInstanceQrCode(instanceName)
    res.json({ instance_name: instanceName, base64: data.base64 })
  } catch (error) {
    console.error("Erro ao buscar QR Code da instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar QR Code." })
  }
}

export async function deleteInstancia(req, res) {
  try {
    const scope = await assertSellerInScope(req, res, req.params.sk_vendedor)
    if (!scope) return

    const instanceName = await getInstanceNameOrThrow(req.params.sk_vendedor, scope.empresaId)
    await deleteInstance(instanceName)
    const dbQuery = getScopedQuery(scope.empresaId)

    await dbQuery(
      `UPDATE TB_WHATSAPP_INSTANCIAS SET ativo = 0 WHERE sk_vendedor = :sk_vendedor`,
      { sk_vendedor: req.params.sk_vendedor }
    )

    res.json({ removed: true, instance_name: instanceName })
  } catch (error) {
    console.error("Erro ao remover instância WhatsApp:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao remover instância." })
  }
}
