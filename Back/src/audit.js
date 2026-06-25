export function auditAction(req, acao, alvo, detalhes = null) {
  const ip = req?.headers?.["x-forwarded-for"] ?? req?.socket?.remoteAddress ?? "unknown"
  const usuario = req?.auth?.login ?? req?.headers?.["x-user-login"] ?? "anonimo"
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      ip,
      usuario,
      acao,
      alvo,
      detalhes,
    })
  )
}
