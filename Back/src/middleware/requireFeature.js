// Mapeia o nome logico da feature (usado nas rotas) para o campo correspondente em req.auth,
// preenchido por requireAuth a partir de organizacoes_auth (ver services/featureFlagsService.js).
const FEATURE_FIELDS = {
  COMISSOES: "featureComissoesHabilitada",
  PREMIACAO: "featurePremiacaoHabilitada",
}

export function requireFeature(nomeFeature) {
  const campo = FEATURE_FIELDS[nomeFeature]
  if (!campo) {
    throw new Error(`Feature flag desconhecida: ${nomeFeature}`)
  }

  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Nao autenticado." })

    if (!req.auth[campo]) {
      return res.status(403).json({ error: "Esta funcionalidade nao esta disponivel para a sua organizacao." })
    }

    next()
  }
}
