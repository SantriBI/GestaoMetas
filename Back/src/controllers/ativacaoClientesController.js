import {
  atualizarTemplate,
  criarCampanha,
  criarTemplate,
  enviarCampanha,
  gerarExcelCampanha,
  gerarNomeArquivo,
  listarSegmentos,
  listarTemplates,
  obterPreviewCampanha,
  obterResumoCampanha,
} from "../services/ativacaoClientesService.js"
import { getScopedLojaScope } from "../services/requestScope.js"

async function getScopeFromRequest(req, res) {
  // Ativacao de Clientes agrega todas as lojas do vendedor - so o Painel/Jornada e o Ranking
  // exigem selecao de loja.
  const lojaScope = await getScopedLojaScope(req, { required: false })
  if (lojaScope.error) {
    res.status(lojaScope.error.status).json({ error: lojaScope.error.message })
    return null
  }

  return {
    role: req.auth?.role,
    sk_vendedor: req.auth?.sk_vendedor ?? null,
    empresa_id: req.auth?.empresa_id ?? null,
    id_usuario: req.auth?.id_usuario ?? null,
    nome_usuario: req.auth?.nome ?? req.auth?.nome_completo ?? req.auth?.login ?? null,
    lojaScope,
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
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    const payload = {
      segmento: req.query.segmento,
      messageBase: req.query.mensagem_base ?? null,
      ...scope,
    }
    res.json({ data: await obterResumoCampanha(payload) })
  } catch (error) {
    console.error("Erro ao buscar resumo da ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar resumo." })
  }
}

export async function getPreview(req, res) {
  try {
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    const payload = {
      segmento: req.query.segmento,
      messageBase: req.query.mensagem_base ?? null,
      search: req.query.search ?? "",
      sortBy: req.query.sort_by ?? "valor_potencial",
      sortDir: req.query.sort_dir ?? "desc",
      ...scope,
    }
    res.json({ data: await obterPreviewCampanha(payload) })
  } catch (error) {
    console.error("Erro ao buscar preview da ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar preview." })
  }
}

export async function postCampanha(req, res) {
  try {
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    const payload = { ...req.body, ...scope }
    const result = await criarCampanha(payload)

    console.log("Campanha criada:", result.campanha.id)
    console.log("Clientes:", result.campanha.clientes.length)

    try {
      const clientes = result.campanha.clientes ?? []
      const buffer = await gerarExcelCampanha(clientes, result.campanha)
      const fileName = gerarNomeArquivo(result.campanha.segmento)

      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Disposition, X-Campaign-Id, X-Campaign-Persisted, X-Campaign-Segmento"
      )
      res.setHeader("X-Campaign-Id", String(result.campanha.id ?? ""))
      res.setHeader("X-Campaign-Persisted", String(Boolean(result.persisted)))
      res.setHeader("X-Campaign-Segmento", String(result.campanha.segmento ?? ""))
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )

      return res.status(201).send(buffer)
    } catch (error) {
      console.error("Erro ao gerar excel da campanha:", error)
      return res.status(201).json(result)
    }
  } catch (error) {
    console.error("Erro ao criar campanha de ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar campanha." })
  }
}

export async function postEnviarCampanha(req, res) {
  try {
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    const campanhaId = Number(req.params.id)
    res.json(await enviarCampanha(campanhaId, { ...req.body, ...scope }))
  } catch (error) {
    console.error("Erro ao enviar campanha de ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao enviar campanha." })
  }
}

export async function getTemplates(req, res) {
  try {
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    res.json({ data: await listarTemplates(scope) })
  } catch (error) {
    console.error("Erro ao listar templates:", error)
    res.status(500).json({ error: "Erro ao listar templates." })
  }
}

export async function postTemplate(req, res) {
  try {
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    res.status(201).json(await criarTemplate({ ...req.body, ...scope }))
  } catch (error) {
    console.error("Erro ao criar template:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar template." })
  }
}

export async function putTemplate(req, res) {
  try {
    const scope = await getScopeFromRequest(req, res)
    if (!scope) return
    const id = Number(req.params.id)
    res.json(await atualizarTemplate(id, { ...req.body, ...scope }))
  } catch (error) {
    console.error("Erro ao atualizar template:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar template." })
  }
}
