import centralPool from "../db/mysql.js"

/**
 * Feature flags por organizacao, cadastradas em organizacoes_auth (MySQL central). Uma unica
 * leitura por request (chamada em requireAuth), reaproveitada por requireFeature em todas as
 * rotas - evita uma consulta redundante por rota gated.
 */
export async function getOrganizacaoFeatureFlags(empresaId) {
  if (!empresaId) {
    return { featureComissoesHabilitada: false, featurePremiacaoHabilitada: false }
  }

  const [rows] = await centralPool.query(
    `SELECT
       FEATURE_COMISSOES_HABILITADA AS feature_comissoes_habilitada,
       FEATURE_PREMIACAO_HABILITADA AS feature_premiacao_habilitada
     FROM organizacoes_auth
     WHERE id_organizacao = ?
     LIMIT 1`,
    [empresaId]
  )

  return {
    featureComissoesHabilitada: Number(rows[0]?.feature_comissoes_habilitada ?? 0) === 1,
    featurePremiacaoHabilitada: Number(rows[0]?.feature_premiacao_habilitada ?? 0) === 1,
  }
}
