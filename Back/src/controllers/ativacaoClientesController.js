import {
  atualizarTemplate,
  criarCampanha,
  criarTemplate,
  enviarCampanha,
  listarSegmentos,
  listarTemplates,
  obterPreviewCampanha,
  obterResumoCampanha,
} from "../services/ativacaoClientesService.js"

function getScopeFromRequest(req) {
  const source = req.method === "GET" ? req.query : req.body
  return {
    role: source.role,
    sk_vendedor: source.sk_vendedor ?? source.vendedor_id ?? null,
    empresa_id: source.empresa_id ?? null,
  }
}

export async function getSegmentos(_req, res) {
  try {
    res.json({ data: await listarSegmentos() })
  } catch (error) {
    console.error("Erro ao listar segmentos de ativação:", error)
    res.status(500).json({ error: "Erro ao listar segmentos de ativação." })
  }
}

export async function getResumo(req, res) {
  try {
    const payload = {
      segmento: req.query.segmento,
      messageBase: req.query.mensagem_base ?? null,
      ...getScopeFromRequest(req),
    }
    res.json({ data: await obterResumoCampanha(payload) })
  } catch (error) {
    console.error("Erro ao buscar resumo da ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar resumo." })
  }
}

export async function getPreview(req, res) {
  try {
    const payload = {
      segmento: req.query.segmento,
      messageBase: req.query.mensagem_base ?? null,
      search: req.query.search ?? "",
      sortBy: req.query.sort_by ?? "valor_potencial",
      sortDir: req.query.sort_dir ?? "desc",
      ...getScopeFromRequest(req),
    }
    res.json({ data: await obterPreviewCampanha(payload) })
  } catch (error) {
    console.error("Erro ao buscar preview da ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar preview." })
  }
}

export async function postCampanha(req, res) {
  try {
    const payload = { ...req.body, ...getScopeFromRequest(req) }
    res.status(201).json(await criarCampanha(payload))
  } catch (error) {
    console.error("Erro ao criar campanha de ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar campanha." })
  }
}

export async function postEnviarCampanha(req, res) {
  try {
    const campanhaId = Number(req.params.id)
    res.json(await enviarCampanha(campanhaId, { ...req.body, ...getScopeFromRequest(req) }))
  } catch (error) {
    console.error("Erro ao enviar campanha de ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao enviar campanha." })
  }
}

export async function getTemplates(req, res) {
  try {
    res.json({ data: await listarTemplates(getScopeFromRequest(req)) })
  } catch (error) {
    console.error("Erro ao listar templates:", error)
    res.status(500).json({ error: "Erro ao listar templates." })
  }
}

export async function postTemplate(req, res) {
  try {
    res.status(201).json(await criarTemplate(req.body))
  } catch (error) {
    console.error("Erro ao criar template:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar template." })
  }
}

export async function putTemplate(req, res) {
  try {
    const id = Number(req.params.id)
    res.json(await atualizarTemplate(id, req.body))
  } catch (error) {
    console.error("Erro ao atualizar template:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar template." })
  }
}
