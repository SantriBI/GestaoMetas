// Interruptor do simulador de premiacao (minha-premiacao/simulador, simulador/grupos e
// contadores). Desligado por padrao desde o incidente NJS-040 (2026-10-01): as consultas do
// simulador varrem FATO_VENDAS_LUCRATIVIDADE e seguravam conexoes do pool. Liga com
// SIMULADOR_PREMIACAO_HABILITADO=true, depois do checklist "Religar o simulador" em
// DOCUMENTACAO_COMISSAO.md. Lido a cada request (sem cache), entao basta reiniciar o backend.
export function isSimuladorPremiacaoHabilitado(env = process.env) {
  const valor = String(env.SIMULADOR_PREMIACAO_HABILITADO ?? "").trim().toLowerCase()
  return valor === "true" || valor === "1"
}

// Vai ANTES de requireAuth na rota: com o simulador desligado responde na hora, sem tocar em
// MySQL nem Oracle.
export function requireSimuladorPremiacao(req, res, next) {
  if (!isSimuladorPremiacaoHabilitado()) {
    return res.status(404).json({ error: "Simulador de premiacao desabilitado.", desabilitado: true })
  }

  next()
}
