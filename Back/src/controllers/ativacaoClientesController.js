import {
  atualizarTemplate,
  criarCampanha,
  criarTemplate,
  enviarCampanha,
  gerarExcelCampanha,
  gerarNomeArquivo,
  listarSegmentos,
  listarTemplates,
  obterCentralNegociacao,
  obterDashboardCampanha,
  obterPreviewCampanha,
  obterResumoCampanha,
  registrarEventoCentralNegociacao,
} from "../services/ativacaoClientesService.js"
import { processZapiWebhook } from "../services/zapi/zapiWebhook.js"

function getScopeFromRequest(req) {
  const source = req.method === "GET" ? req.query : req.body
  return {
    role: source.role,
    sk_vendedor: source.sk_vendedor ?? source.vendedor_id ?? null,
    empresa_id: source.empresa_id ?? null,
    id_usuario: source.id_usuario ?? source.usuario_id ?? null,
    nome_usuario: source.nome_usuario ?? source.usuario_nome ?? null,
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
    const campanhaId = Number(req.params.id)
    res.json(await enviarCampanha(campanhaId, { ...req.body, ...getScopeFromRequest(req) }))
  } catch (error) {
    console.error("Erro ao enviar campanha de ativação:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao enviar campanha." })
  }
}

export async function getCampanhaDashboard(req, res) {
  try {
    const campanhaId = Number(req.params.id)
    res.json({ data: await obterDashboardCampanha(campanhaId) })
  } catch (error) {
    console.error("Erro ao buscar dashboard da campanha de ativaÃ§Ã£o:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao buscar dashboard da campanha." })
  }
}

export async function getCentralNegociacao(req, res) {
  try {
    res.json({ data: await obterCentralNegociacao(req.params.token) })
  } catch (error) {
    console.error("Erro ao carregar a Central de NegociaÃ§Ã£o:", error)
    res.status(404).json({ error: error instanceof Error ? error.message : "Link de negociaÃ§Ã£o nÃ£o encontrado." })
  }
}

export async function postCentralNegociacaoEvento(req, res) {
  try {
    res.json({
      data: await registrarEventoCentralNegociacao(req.params.token, req.body?.action, {
        button: req.body?.button ?? null,
        source: req.body?.source ?? "central-publica",
      }),
    })
  } catch (error) {
    console.error("Erro ao registrar evento da Central de NegociaÃ§Ã£o:", error)
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao registrar evento da Central." })
  }
}

export async function postZapiWebhook(req, res) {
  try {
    const data = await processZapiWebhook(req.body ?? {})
    res.json({ success: true, data })
  } catch (error) {
    console.error("Erro ao processar webhook da Z-API:", error)
    res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao processar webhook da Z-API." })
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
