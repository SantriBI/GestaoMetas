export function getRequestedEmpresaId(req) {
  return req.query?.empresa_id ?? req.query?.empresaId ?? req.body?.empresa_id ?? req.body?.empresaId ?? null
}

export function getScopedEmpresaId(req) {
  const authEmpresaId = req.auth?.empresa_id ?? null
  const requestedEmpresaId = getRequestedEmpresaId(req)

  if (canUseGlobalEmpresaScope(req)) {
    return requestedEmpresaId ?? authEmpresaId ?? null
  }

  return authEmpresaId ?? null
}

export function canUseGlobalEmpresaScope(req) {
  const role = String(req.auth?.role ?? "").toUpperCase()
  return role === "SUPERADMIN" || role === "ADMIN"
}
